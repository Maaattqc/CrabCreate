import { emitTicketLog, emitTicketStatus, emitTicketUpdated, emitNotification, emitSubtaskProgress } from '../socket';
import * as repo from '../db/repositories';
import * as dependencyChecker from './dependency-checker';
import * as fileLocker from './file-locker';
import * as aiCoder from './ai-coder';
import * as aiReviewer from './ai-reviewer';
import * as testGenerator from './test-generator';
import * as deployer from './deployer';
import logger from './logger';
import db from '../db/sqlite';
import type { Ticket, CodingResult, CodeFile } from '../types';

const PIPELINE_ACTIVE_STATUSES = new Set(['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying']);

/** Create a timeout promise that rejects after the given duration. */
function createPipelineTimeout(timeoutMs: number): { promise: Promise<never>; clear: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Pipeline timeout after ${Math.round(timeoutMs / 60000)} minutes`)), timeoutMs);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

export interface PipelineLaunchResult {
  launched: boolean;
  reason?: string;
}

/** Check that the ticket still exists and is still in an active pipeline status. */
function pipelineAborted(ticketId: number): boolean {
  const fresh = repo.findTicketById(ticketId);
  if (!fresh) {
    logger.info(`[PIPELINE-ABORT] ticket=#${ticketId} deleted during pipeline`);
    return true;
  }
  if (!PIPELINE_ACTIVE_STATUSES.has(fresh.status)) {
    logger.info(`[PIPELINE-ABORT] ticket=#${ticketId} status changed to "${fresh.status}" externally`);
    return true;
  }
  return false;
}

/**
 * Run the full AI pipeline for a ticket.
 * Handles CAS status check, dependency/file-lock checks, AI coding, review, tests, deploy.
 * Returns once the pipeline finishes (or is queued/rejected).
 */
export async function runPipeline(
  ticket: Ticket, projectId: number,
  options?: { skipEstimation?: boolean }
): Promise<PipelineLaunchResult> {
  logger.info(`[PIPELINE-START] ticket=#${ticket.id} "${ticket.title}" previousStatus="${ticket.status}" project=${projectId}`);

  // Atomic CAS: only proceed if ticket is NOT already active
  const previousStatus = ticket.status;
  const colPos = repo.getNextColumnPosition('estimating', projectId);
  const statusCas = db.prepare(
    "UPDATE kanban_tickets SET status = 'estimating', progress = 0, column_position = ? WHERE id = ? AND status NOT IN ('estimating','ai_coding','ai_review','testing','deploying')"
  ).run(colPos, ticket.id);
  if (statusCas.changes === 0) {
    logger.info(`[PIPELINE-START] ticket=#${ticket.id} CAS failed — pipeline already running`);
    return { launched: false, reason: 'Pipeline already running' };
  }
  logger.info(`[PIPELINE-START] ticket=#${ticket.id} CAS OK → estimating col_pos=${colPos}`);
  repo.insertStatusTransition(ticket.id, previousStatus, 'estimating');

  // Pipeline timeout: reject if pipeline exceeds configured duration
  const timeoutMinutes = parseInt(repo.getConfig('pipeline_timeout_minutes') || '30', 10);
  const { promise: timeoutPromise, clear: clearPipelineTimeout } = createPipelineTimeout(timeoutMinutes * 60 * 1000);

  /** Helper: race an async step against the pipeline timeout. */
  async function withTimeout<T>(step: Promise<T>): Promise<T> {
    return Promise.race([step, timeoutPromise]) as Promise<T>;
  }

  try {
    // Step 0: Pipeline launched — record start time for crash recovery
    repo.updateTicketFields(ticket.id, { pipeline_step: 0, pipeline_started_at: new Date().toISOString() });

    // 1. Dependency check
    const depResult = dependencyChecker.check(ticket);
    if (!depResult.ok) {
      logger.info(`[PIPELINE] ticket=#${ticket.id} → queued (dependency: ${depResult.message})`);
      repo.updateTicketStatus(ticket.id, 'queued', 0);
      emitTicketStatus(ticket.id, 'queued', 0, projectId);
      emitTicketLog(ticket.id, depResult.message!, 'warning', 'dependency', projectId);
      repo.insertLog(ticket.id, depResult.message!, 'warning', 'dependency');
      return { launched: false, reason: 'queued:dependency' };
    }
    repo.updateTicketFields(ticket.id, { pipeline_step: 1 });

    // 2. File lock check
    const lockResult = fileLocker.checkAndLock(ticket);
    if (!lockResult.ok) {
      logger.info(`[PIPELINE] ticket=#${ticket.id} → queued (file lock: ${lockResult.message})`);
      repo.updateTicketStatus(ticket.id, 'queued', 0);
      emitTicketStatus(ticket.id, 'queued', 0, projectId);
      emitTicketLog(ticket.id, lockResult.message!, 'warning', 'locking', projectId);
      repo.insertLog(ticket.id, lockResult.message!, 'warning', 'locking');
      return { launched: false, reason: 'queued:filelock' };
    }
    repo.updateTicketFields(ticket.id, { pipeline_step: 2 });

    // --- Skip coding shortcut: for testing deploy without AI calls ---
    const skipCoding = repo.getConfig('skip_coding') === '1';
    let codingResult: import('../types').CodingResult;

    if (skipCoding) {
      logger.info(`[PIPELINE] ticket=#${ticket.id} skip_coding=1 — skipping AI steps`);
      emitTicketLog(ticket.id, '[TEST] skip_coding=1 — étapes IA ignorées', 'warning', 'estimating', projectId);
      repo.insertLog(ticket.id, '[TEST] skip_coding=1 — étapes IA ignorées', 'warning', 'estimating');

      const testHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test deploy — Ticket #${ticket.id}</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:3rem auto;padding:0 1rem;color:#e4e4e7;background:#18181b}
h1{color:#f59e0b}code{background:#27272a;padding:2px 6px;border-radius:4px;font-size:0.9em}</style></head>
<body>
<h1>CrabCreate — Deploy test</h1>
<p>Ticket <code>#${ticket.id}</code> — <strong>${ticket.title.replace(/[<>&"]/g, '')}</strong></p>
<p>Deployed at <code>${new Date().toISOString()}</code></p>
</body></html>`;

      codingResult = {
        files: [{ path: 'index.html', content: testHtml }],
        baseFiles: [],
        summary: 'Test deploy (skip_coding)',
        diff: '',
        linesAdded: 10,
        linesRemoved: 0,
        tokensUsed: 0,
        costUsd: 0,
        branchName: `crab-test-${ticket.id}`,
        repoDir: '',
        previewPath: '',
      };

      repo.updateTicketFields(ticket.id, {
        lines_added: codingResult.linesAdded,
        complexity: 'test',
        ai_review_score: 100,
        progress: 70,
        pipeline_step: 5,
      });
      emitTicketStatus(ticket.id, 'ai_review', 70, projectId);

    } else {
      // 3. Complexity estimation + decomposition
      let decomposition: { single: boolean; subtasks: { title: string; description: string }[] } | null = null;

      if (options?.skipEstimation && ticket.complexity) {
        // Crash recovery: estimation already done, skip to coding
        logger.info(`[PIPELINE] ticket=#${ticket.id} → skip estimation (crash recovery, complexity=${ticket.complexity})`);
        emitTicketLog(ticket.id, `Reprise après crash — estimation déjà faite (${ticket.complexity})`, 'info', 'estimating', projectId);
        repo.insertLog(ticket.id, `Reprise après crash — estimation déjà faite (${ticket.complexity})`, 'info', 'estimating');
      } else {
        logger.info(`[PIPELINE] ticket=#${ticket.id} → estimating (step 3)`);
        repo.updateTicketStatus(ticket.id, 'estimating', 10);
        emitTicketStatus(ticket.id, 'estimating', 10, projectId);
        emitTicketLog(ticket.id, 'Estimation de la complexité...', 'info', 'estimating', projectId);
        repo.insertLog(ticket.id, 'Estimation de la complexité...', 'info', 'estimating');

        const estimation = await withTimeout(aiCoder.estimateComplexity(ticket));
        if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }
        repo.updateTicketFields(ticket.id, { complexity: estimation.complexity, pipeline_step: 3 });
        emitTicketLog(ticket.id, `Complexité estimée : ${estimation.complexity}`, 'success', 'estimating', projectId);
        repo.insertLog(ticket.id, `Complexité estimée : ${estimation.complexity}`, 'success', 'estimating');
        repo.insertActivity(ticket.id, `Complexité estimée : ${estimation.complexity}`, 'estimate');

        // 3.5. Decomposition — check if ticket has multiple subjects
        logger.info(`[PIPELINE] ticket=#${ticket.id} → decomposing`);
        emitTicketLog(ticket.id, 'Analyse de la décomposition...', 'info', 'estimating', projectId);
        repo.insertLog(ticket.id, 'Analyse de la décomposition...', 'info', 'estimating');

        decomposition = await withTimeout(aiCoder.decomposeTicket(ticket));
        if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }
      }

      // Determine single vs multi-subtask mode
      // If skipEstimation, check existing AI subtasks in DB; otherwise use decomposition result
      const existingAiSubtasks = options?.skipEstimation
        ? repo.findSubtasksByTicketId(ticket.id).filter(s => s.ai_generated)
        : [];
      const isSingleTopic = options?.skipEstimation
        ? existingAiSubtasks.length === 0
        : decomposition!.single;

      // 4. AI Coding
      logger.info(`[PIPELINE] ticket=#${ticket.id} → ai_coding (step 4)`);
      repo.updateTicketStatus(ticket.id, 'ai_coding', 25);
      emitTicketStatus(ticket.id, 'ai_coding', 25, projectId);

      if (isSingleTopic) {
        // Single topic — normal code generation
        emitTicketLog(ticket.id, 'Génération du code par IA...', 'info', 'coding', projectId);
        repo.insertLog(ticket.id, 'Génération du code par IA...', 'info', 'coding');

        codingResult = await withTimeout(aiCoder.generateCode(ticket));
        if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }
      } else {
        // Multiple topics — create subtasks and code each sequentially
        let createdSubtasks: import('../types').Subtask[];
        let subtaskDefs: { title: string; description: string }[];

        if (options?.skipEstimation) {
          // Crash recovery: reuse existing AI subtasks from DB
          createdSubtasks = existingAiSubtasks;
          subtaskDefs = createdSubtasks.map(s => ({ title: s.title, description: s.description }));
          // Reset completed status so they get re-coded
          for (const s of createdSubtasks) {
            repo.updateSubtask(s.id, { completed: 0 });
          }
          emitTicketLog(ticket.id, `Reprise après crash — ${createdSubtasks.length} sous-tâches existantes`, 'info', 'coding', projectId);
          repo.insertLog(ticket.id, `Reprise après crash — ${createdSubtasks.length} sous-tâches existantes`, 'info', 'coding');
        } else {
          const subtaskCount = decomposition!.subtasks.length;
          emitTicketLog(ticket.id, `Décomposé en ${subtaskCount} sous-tâches`, 'info', 'coding', projectId);
          repo.insertLog(ticket.id, `Décomposé en ${subtaskCount} sous-tâches`, 'info', 'coding');
          repo.insertActivity(ticket.id, `Décomposé en ${subtaskCount} sous-tâches`, 'ai');

          // Clean up any previous AI subtasks and create new ones
          repo.deleteAiSubtasksByTicketId(ticket.id);
          createdSubtasks = decomposition!.subtasks.map(s =>
            repo.createSubtask(ticket.id, s.title, s.description, true)
          );
          subtaskDefs = decomposition!.subtasks;
        }

        const subtaskCount = createdSubtasks.length;

        // Notify client about new subtasks
        emitTicketUpdated(ticket.id, { subtasks_updated: true }, projectId);

        // Code each subtask sequentially, accumulating files
        let previousFiles: CodeFile[] = [];
        const firstResult = await withTimeout(aiCoder.generateCode(ticket)); // get repoDir/existingFiles from initial clone
        const repoDir = firstResult.repoDir;
        const baseFiles = firstResult.baseFiles;

        // We need to regenerate per subtask — discard firstResult coding, just use its repo setup
        // Re-read existing files from the clone result
        const existingFilesForSubtasks = firstResult.baseFiles;

        codingResult = {
          files: [],
          baseFiles: baseFiles,
          summary: '',
          diff: '',
          linesAdded: 0,
          linesRemoved: 0,
          tokensUsed: 0,
          costUsd: 0,
          branchName: firstResult.branchName,
          repoDir,
          previewPath: firstResult.previewPath,
        };

        for (let i = 0; i < createdSubtasks.length; i++) {
          const subtask = createdSubtasks[i];
          const subtaskDef = subtaskDefs[i];

          emitTicketLog(ticket.id, `Codage sous-tâche ${i + 1}/${subtaskCount}: ${subtaskDef.title}`, 'info', 'coding', projectId);
          repo.insertLog(ticket.id, `Codage sous-tâche ${i + 1}/${subtaskCount}: ${subtaskDef.title}`, 'info', 'coding');
          emitSubtaskProgress(ticket.id, subtask.id, 'coding', projectId);

          if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

          const subResult = await withTimeout(aiCoder.generateCodeForSubtask(
            ticket,
            subtaskDef.title,
            subtaskDef.description,
            previousFiles,
            repoDir,
            existingFilesForSubtasks,
          ));

          // Mark subtask completed
          repo.updateSubtask(subtask.id, { completed: 1 });
          emitSubtaskProgress(ticket.id, subtask.id, 'completed', projectId);

          // Accumulate files
          previousFiles = mergeFiles(previousFiles, subResult.files);

          // Merge coding result
          codingResult = mergeCodingResults(codingResult, subResult);

          // Progress proportional
          const progress = 25 + Math.round(((i + 1) / subtaskCount) * 25);
          repo.updateTicketFields(ticket.id, { progress });
          emitTicketStatus(ticket.id, 'ai_coding', progress, projectId);
        }

        // Notify client about subtask completion
        emitTicketUpdated(ticket.id, { subtasks_updated: true }, projectId);
      }

      repo.updateTicketFields(ticket.id, {
        lines_added: codingResult.linesAdded,
        lines_removed: codingResult.linesRemoved,
        tokens_used: codingResult.tokensUsed,
        cost_usd: codingResult.costUsd,
        branch_name: codingResult.branchName,
        progress: 50,
        pipeline_step: 4,
      });

      // Store diff
      if (codingResult.diff) {
        repo.insertLog(ticket.id, codingResult.diff, 'diff', 'coding');
      }

      emitTicketLog(ticket.id, `Code généré : +${codingResult.linesAdded} -${codingResult.linesRemoved} lignes`, 'success', 'coding', projectId);
      repo.insertLog(ticket.id, `Code généré : +${codingResult.linesAdded} -${codingResult.linesRemoved} lignes`, 'success', 'coding');
      repo.insertActivity(ticket.id, `Code généré par ${ticket.ai_model}`, 'ai');

      // Guard: if AI generated 0 lines, fail early instead of reviewing nothing
      if (codingResult.linesAdded === 0 && codingResult.linesRemoved === 0) {
        logger.info(`[PIPELINE] ticket=#${ticket.id} → rejected (0 lines generated)`);
        repo.updateTicketStatus(ticket.id, 'rejected', 0);
        repo.updateTicketFields(ticket.id, { pipeline_step: 0 });
        emitTicketStatus(ticket.id, 'rejected', 0, projectId);
        emitTicketLog(ticket.id, 'Aucun code généré — vérifiez la description ou les fichiers cibles', 'error', 'coding', projectId);
        repo.insertLog(ticket.id, 'Aucun code généré — vérifiez la description ou les fichiers cibles', 'error', 'coding');
        fileLocker.unlock(ticket.id);
        emitNotification(`Ticket #${ticket.id} : aucun code généré`, 'error', projectId);
        return { launched: false, reason: 'no_code_generated' };
      }

      // 5. AI Review
      logger.info(`[PIPELINE] ticket=#${ticket.id} → ai_review (step 5)`);
      repo.updateTicketStatus(ticket.id, 'ai_review', 60);
      emitTicketStatus(ticket.id, 'ai_review', 60, projectId);
      emitTicketLog(ticket.id, 'Review du code par IA...', 'info', 'reviewing', projectId);
      repo.insertLog(ticket.id, 'Review du code par IA...', 'info', 'reviewing');

      const reviewResult = await withTimeout(aiReviewer.review(ticket, codingResult));
      if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

      repo.updateTicketFields(ticket.id, {
        ai_review_score: reviewResult.score,
        ai_review_data: JSON.stringify(reviewResult),
        progress: 70,
        pipeline_step: 5,
      });

      const reviewLogType = reviewResult.score >= 50 ? 'success' : 'error';
      emitTicketLog(ticket.id, `Review score: ${reviewResult.score}/100`, reviewLogType, 'reviewing', projectId);
      repo.insertLog(ticket.id, `Review score: ${reviewResult.score}/100`, reviewLogType, 'reviewing');
      repo.insertActivity(ticket.id, `AI Review: ${reviewResult.score}/100`, 'ai_review');

      // Auto-reject if score below threshold
      const threshold = parseInt(repo.getConfig('ai_review_threshold') || '50', 10);
      if (reviewResult.score < threshold) {
        logger.info(`[PIPELINE] ticket=#${ticket.id} → rejected (score ${reviewResult.score} < threshold ${threshold})`);
        repo.updateTicketStatus(ticket.id, 'rejected', 0);
        emitTicketStatus(ticket.id, 'rejected', 0, projectId);
        emitTicketLog(ticket.id, 'Auto-rejeté : score trop bas', 'error', 'reviewing', projectId);
        fileLocker.unlock(ticket.id);
        emitNotification(`Ticket #${ticket.id} auto-rejeté (score : ${reviewResult.score}/100)`, 'error', projectId);
        return { launched: false, reason: 'auto_rejected' };
      }
    }

    // 6. Auto Tests
    const autoTestEnabled = repo.getConfig('auto_test_enabled') !== '0';
    if (autoTestEnabled) {
      logger.info(`[PIPELINE] ticket=#${ticket.id} → testing (step 6)`);
      repo.updateTicketStatus(ticket.id, 'testing', 75);
      emitTicketStatus(ticket.id, 'testing', 75, projectId);
      emitTicketLog(ticket.id, 'Exécution des tests...', 'info', 'testing', projectId);
      repo.insertLog(ticket.id, 'Exécution des tests...', 'info', 'testing');

      const testResults = await withTimeout(testGenerator.runTests(ticket, codingResult));
      if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

      repo.updateTicketFields(ticket.id, {
        test_results: JSON.stringify(testResults),
        progress: 85,
        pipeline_step: 6,
      });

      const testStatus = testResults.passed === testResults.total ? 'success' : 'warning';
      emitTicketLog(ticket.id, `Tests: ${testResults.passed}/${testResults.total} passed`, testStatus, 'testing', projectId);
      repo.insertLog(ticket.id, `Tests: ${testResults.passed}/${testResults.total} passed`, testStatus, 'testing');
      repo.insertActivity(ticket.id, `Tests: ${testResults.passed}/${testResults.total}`, 'test');
    } else {
      emitTicketLog(ticket.id, 'Tests automatiques désactivés, étape ignorée', 'warning', 'testing', projectId);
      repo.insertLog(ticket.id, 'Tests automatiques désactivés, étape ignorée', 'warning', 'testing');
      repo.updateTicketFields(ticket.id, { progress: 85 });
    }

    // 7. Deploy to staging
    const autoDeployEnabled = repo.getConfig('auto_deploy_enabled') !== '0';
    if (autoDeployEnabled) {
      logger.info(`[PIPELINE] ticket=#${ticket.id} → deploying (step 7)`);
      repo.updateTicketStatus(ticket.id, 'deploying', 90);
      emitTicketStatus(ticket.id, 'deploying', 90, projectId);
      emitTicketLog(ticket.id, 'Déploiement...', 'info', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déploiement...', 'info', 'deploying');

      const deployResult = await withTimeout(deployer.deployToStaging(ticket, codingResult));
      if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

      // Save coding files + base files to filesystem for later use (approve → 3-way merge)
      if (codingResult.files && codingResult.files.length > 0) {
        deployer.saveTicketFiles(ticket.id, codingResult.files, codingResult.baseFiles || []);
      }

      // Append preview path so the iframe opens on the right page/section
      let stagingUrl = deployResult.stagingUrl;
      if (stagingUrl && codingResult.previewPath) {
        const pp = codingResult.previewPath.startsWith('/') || codingResult.previewPath.startsWith('#')
          ? codingResult.previewPath
          : `/${codingResult.previewPath}`;
        stagingUrl = stagingUrl.replace(/\/+$/, '') + pp;
      }

      logger.info(`[PIPELINE] ticket=#${ticket.id} → review (deploy done)`);
      repo.updateTicketFields(ticket.id, {
        status: 'review',
        pr_url: deployResult.prUrl,
        pr_id: deployResult.prId,
        staging_url: stagingUrl,
        progress: 100,
        pipeline_step: 7,
        pipeline_started_at: null,
      });

      emitTicketStatus(ticket.id, 'review', 100, projectId);
      emitTicketUpdated(ticket.id, { staging_url: stagingUrl, pr_url: deployResult.prUrl }, projectId);
      emitTicketLog(ticket.id, 'Déployé avec succès', 'success', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déployé avec succès', 'success', 'deploying');
      repo.insertActivity(ticket.id, 'Déployé en staging', 'push');

      emitNotification(`Ticket #${ticket.id} prêt pour review`, 'success', projectId);
    } else {
      // Skip deploy, go straight to review
      logger.info(`[PIPELINE] ticket=#${ticket.id} → review (deploy skipped)`);
      repo.updateTicketFields(ticket.id, { status: 'review', progress: 100, pipeline_started_at: null });
      emitTicketStatus(ticket.id, 'review', 100, projectId);
      emitTicketLog(ticket.id, 'Déploiement automatique désactivé, passage en review', 'warning', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déploiement automatique désactivé, passage en review', 'warning', 'deploying');
      emitNotification(`Ticket #${ticket.id} prêt pour review (sans déploiement)`, 'success', projectId);
    }

    logger.info(`[PIPELINE-END] ticket=#${ticket.id} completed successfully`);
    clearPipelineTimeout();
    return { launched: true };

  } catch (err: unknown) {
    clearPipelineTimeout();
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[Pipeline] Error for ticket #${ticket.id}:`, err);
    fileLocker.unlock(ticket.id);
    // Don't try to update a deleted ticket
    if (!repo.findTicketById(ticket.id)) {
      logger.info(`[PIPELINE] ticket=#${ticket.id} deleted — skipping error recovery`);
      return { launched: false, reason: 'deleted' };
    }
    logger.info(`[PIPELINE] ticket=#${ticket.id} → backlog (error caught)`);
    repo.updateTicketStatus(ticket.id, 'backlog', 0);
    repo.updateTicketFields(ticket.id, { pipeline_started_at: null });
    emitTicketStatus(ticket.id, 'backlog', 0, projectId);
    emitTicketLog(ticket.id, `Erreur pipeline: ${errMsg}`, 'error', 'error', projectId);
    repo.insertLog(ticket.id, `Erreur pipeline: ${errMsg}`, 'error', 'error');
    return { launched: false, reason: errMsg };
  }
}

/**
 * Compute a simple unified-style diff between base files and modified files.
 * Returns { diff, linesAdded, linesRemoved }.
 */
function computeSimpleDiff(baseFiles: CodeFile[], codingFiles: CodeFile[]): { diff: string; linesAdded: number; linesRemoved: number } {
  const baseMap = new Map(baseFiles.map(f => [f.path, f.content]));
  const parts: string[] = [];
  let added = 0;
  let removed = 0;

  for (const file of codingFiles) {
    const baseContent = baseMap.get(file.path) || '';
    const baseLines = baseContent.split('\n');
    const newLines = file.content.split('\n');

    // Simple line-by-line comparison
    const diffLines: string[] = [];
    const maxLen = Math.max(baseLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const baseLine = i < baseLines.length ? baseLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;
      if (baseLine === newLine) continue;
      if (baseLine !== undefined && newLine !== undefined) {
        diffLines.push(`-${baseLine}`);
        diffLines.push(`+${newLine}`);
        added++;
        removed++;
      } else if (baseLine === undefined) {
        diffLines.push(`+${newLine}`);
        added++;
      } else {
        diffLines.push(`-${baseLine}`);
        removed++;
      }
    }

    if (diffLines.length > 0) {
      parts.push(`--- a/${file.path}\n+++ b/${file.path}\n${diffLines.join('\n')}`);
    }
  }

  return { diff: parts.join('\n\n'), linesAdded: added, linesRemoved: removed };
}

/**
 * Resume pipeline from ai_review after a chat modification is applied.
 * Reads the updated coding files and runs: ai_review → testing → deploying → review.
 */
export async function resumePipeline(
  ticket: Ticket, projectId: number,
  options?: { startFromStep?: number }
): Promise<PipelineLaunchResult> {
  const startFrom = options?.startFromStep ?? 5; // default: start from review
  logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} "${ticket.title}" from ai_coding (startFromStep=${startFrom})`);

  // Read the coding files that were updated by the chat modification
  const { codingFiles, baseFiles } = deployer.readTicketFiles(ticket.id);
  if (codingFiles.length === 0) {
    logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} no coding files found`);
    return { launched: false, reason: 'no_files' };
  }

  // Compute actual diff between base files and modified files
  const { diff, linesAdded, linesRemoved } = computeSimpleDiff(baseFiles, codingFiles);
  logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} diff: +${linesAdded} -${linesRemoved} lines`);

  // Find the last user chat message to pass as modification context
  const chatHistory = repo.findChatHistory(ticket.id);
  const lastUserMessage = chatHistory.filter(m => m.role === 'user').pop();

  // Build a CodingResult from the stored files
  const codingResult: CodingResult = {
    files: codingFiles,
    baseFiles,
    summary: 'Chat modification applied',
    diff,
    linesAdded,
    linesRemoved,
    tokensUsed: ticket.tokens_used || 0,
    costUsd: ticket.cost_usd || 0,
    branchName: ticket.branch_name || '',
    repoDir: '',
    previewPath: '',
    modificationPrompt: lastUserMessage?.message,
  };

  try {
    // Update ticket to ai_coding status briefly — record start time for crash recovery
    repo.updateTicketStatus(ticket.id, 'ai_coding', 50);
    repo.updateTicketFields(ticket.id, { pipeline_started_at: new Date().toISOString() });
    emitTicketStatus(ticket.id, 'ai_coding', 50, projectId);
    emitTicketLog(ticket.id, 'Modification chat appliquée — reprise du pipeline...', 'info', 'coding', projectId);
    repo.insertLog(ticket.id, 'Modification chat appliquée — reprise du pipeline', 'info', 'coding');
    repo.insertActivity(ticket.id, 'Modification appliquée via chat IA', 'chat');

    repo.updateTicketFields(ticket.id, {
      lines_added: codingResult.linesAdded,
      progress: 50,
      pipeline_step: 4,
    });

    // 5. AI Review
    if (startFrom <= 5) {
      logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} → ai_review`);
      repo.updateTicketStatus(ticket.id, 'ai_review', 60);
      emitTicketStatus(ticket.id, 'ai_review', 60, projectId);
      emitTicketLog(ticket.id, 'Review du code par IA...', 'info', 'reviewing', projectId);
      repo.insertLog(ticket.id, 'Review du code par IA...', 'info', 'reviewing');

      const reviewResult = await aiReviewer.review(ticket, codingResult);
      if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

      repo.updateTicketFields(ticket.id, {
        ai_review_score: reviewResult.score,
        ai_review_data: JSON.stringify(reviewResult),
        progress: 70,
        pipeline_step: 5,
      });

      const reviewLogType = reviewResult.score >= 50 ? 'success' : 'error';
      emitTicketLog(ticket.id, `Review score: ${reviewResult.score}/100`, reviewLogType, 'reviewing', projectId);
      repo.insertLog(ticket.id, `Review score: ${reviewResult.score}/100`, reviewLogType, 'reviewing');
      repo.insertActivity(ticket.id, `AI Review: ${reviewResult.score}/100`, 'ai_review');

      const threshold = parseInt(repo.getConfig('ai_review_threshold') || '50', 10);
      if (reviewResult.score < threshold) {
        logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} → rejected (score ${reviewResult.score} < threshold ${threshold})`);
        repo.updateTicketStatus(ticket.id, 'rejected', 0);
        emitTicketStatus(ticket.id, 'rejected', 0, projectId);
        emitTicketLog(ticket.id, 'Auto-rejeté : score trop bas', 'error', 'reviewing', projectId);
        fileLocker.unlock(ticket.id);
        emitNotification(`Ticket #${ticket.id} auto-rejeté (score : ${reviewResult.score}/100)`, 'error', projectId);
        return { launched: false, reason: 'auto_rejected' };
      }
    } else {
      emitTicketLog(ticket.id, 'Review déjà faite — reprise après crash', 'info', 'reviewing', projectId);
      repo.insertLog(ticket.id, 'Review déjà faite — reprise après crash', 'info', 'reviewing');
    }

    // 6. Auto Tests
    if (startFrom <= 6) {
      const autoTestEnabled = repo.getConfig('auto_test_enabled') !== '0';
      if (autoTestEnabled) {
        logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} → testing`);
        repo.updateTicketStatus(ticket.id, 'testing', 75);
        emitTicketStatus(ticket.id, 'testing', 75, projectId);
        emitTicketLog(ticket.id, 'Exécution des tests...', 'info', 'testing', projectId);
        repo.insertLog(ticket.id, 'Exécution des tests...', 'info', 'testing');

        const testResults = await testGenerator.runTests(ticket, codingResult);
        if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

        repo.updateTicketFields(ticket.id, {
          test_results: JSON.stringify(testResults),
          progress: 85,
          pipeline_step: 6,
        });

        const testStatus = testResults.passed === testResults.total ? 'success' : 'warning';
        emitTicketLog(ticket.id, `Tests: ${testResults.passed}/${testResults.total} passed`, testStatus, 'testing', projectId);
        repo.insertLog(ticket.id, `Tests: ${testResults.passed}/${testResults.total} passed`, testStatus, 'testing');
        repo.insertActivity(ticket.id, `Tests: ${testResults.passed}/${testResults.total}`, 'test');
      } else {
        emitTicketLog(ticket.id, 'Tests automatiques désactivés, étape ignorée', 'warning', 'testing', projectId);
        repo.insertLog(ticket.id, 'Tests automatiques désactivés, étape ignorée', 'warning', 'testing');
        repo.updateTicketFields(ticket.id, { progress: 85 });
      }
    } else {
      emitTicketLog(ticket.id, 'Tests déjà faits — reprise après crash', 'info', 'testing', projectId);
      repo.insertLog(ticket.id, 'Tests déjà faits — reprise après crash', 'info', 'testing');
    }

    // 7. Deploy to staging
    const autoDeployEnabled = repo.getConfig('auto_deploy_enabled') !== '0';
    if (autoDeployEnabled) {
      logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} → deploying`);
      repo.updateTicketStatus(ticket.id, 'deploying', 90);
      emitTicketStatus(ticket.id, 'deploying', 90, projectId);
      emitTicketLog(ticket.id, 'Déploiement...', 'info', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déploiement...', 'info', 'deploying');

      const deployResult = await deployer.deployToStaging(ticket, codingResult);
      if (pipelineAborted(ticket.id)) { fileLocker.unlock(ticket.id); return { launched: false, reason: 'aborted' }; }

      if (codingResult.files && codingResult.files.length > 0) {
        deployer.saveTicketFiles(ticket.id, codingResult.files, codingResult.baseFiles || []);
      }

      let stagingUrl = deployResult.stagingUrl;
      if (stagingUrl && codingResult.previewPath) {
        const pp = codingResult.previewPath.startsWith('/') || codingResult.previewPath.startsWith('#')
          ? codingResult.previewPath
          : `/${codingResult.previewPath}`;
        stagingUrl = stagingUrl.replace(/\/+$/, '') + pp;
      }

      logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} → review (deploy done)`);
      repo.updateTicketFields(ticket.id, {
        status: 'review',
        pr_url: deployResult.prUrl,
        pr_id: deployResult.prId,
        staging_url: stagingUrl,
        progress: 100,
        pipeline_step: 7,
        pipeline_started_at: null,
      });

      emitTicketStatus(ticket.id, 'review', 100, projectId);
      emitTicketUpdated(ticket.id, { staging_url: stagingUrl, pr_url: deployResult.prUrl }, projectId);
      emitTicketLog(ticket.id, 'Déployé avec succès', 'success', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déployé avec succès', 'success', 'deploying');
      repo.insertActivity(ticket.id, 'Déployé en staging', 'push');
      emitNotification(`Ticket #${ticket.id} prêt pour review`, 'success', projectId);
    } else {
      logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} → review (deploy skipped)`);
      repo.updateTicketFields(ticket.id, { status: 'review', progress: 100, pipeline_started_at: null });
      emitTicketStatus(ticket.id, 'review', 100, projectId);
      emitTicketLog(ticket.id, 'Déploiement automatique désactivé, passage en review', 'warning', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déploiement automatique désactivé, passage en review', 'warning', 'deploying');
      emitNotification(`Ticket #${ticket.id} prêt pour review (sans déploiement)`, 'success', projectId);
    }

    logger.info(`[PIPELINE-RESUME-END] ticket=#${ticket.id} completed successfully`);
    return { launched: true };

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[Pipeline-Resume] Error for ticket #${ticket.id}:`, err);
    fileLocker.unlock(ticket.id);
    if (!repo.findTicketById(ticket.id)) {
      logger.info(`[PIPELINE-RESUME] ticket=#${ticket.id} deleted — skipping error recovery`);
      return { launched: false, reason: 'deleted' };
    }
    repo.updateTicketStatus(ticket.id, 'backlog', 0);
    repo.updateTicketFields(ticket.id, { pipeline_started_at: null });
    emitTicketStatus(ticket.id, 'backlog', 0, projectId);
    emitTicketLog(ticket.id, `Erreur pipeline: ${errMsg}`, 'error', 'error', projectId);
    repo.insertLog(ticket.id, `Erreur pipeline: ${errMsg}`, 'error', 'error');
    return { launched: false, reason: errMsg };
  }
}

/**
 * Resume pipeline after a server crash/restart.
 * Reads the pipeline_step saved in DB and decides:
 * - step < 4 (before coding): nothing expensive done → restart from beginning via runPipeline()
 * - step >= 4 (coding done, files on filesystem): resume from review via resumePipeline()
 */
export async function resumePipelineFromCrash(ticket: Ticket, projectId: number): Promise<PipelineLaunchResult> {
  const step = ticket.pipeline_step || 0;
  logger.info(`[PIPELINE-CRASH-RESUME] ticket=#${ticket.id} recovery from step ${step}`);

  if (step < 3) {
    // Before estimation — restart from scratch (deps + locks always re-checked)
    return runPipeline(ticket, projectId);
  }

  if (step === 3) {
    // Estimation done, coding not done — skip estimation, go straight to coding
    return runPipeline(ticket, projectId, { skipEstimation: true });
  }

  // step >= 4: coding files exist on filesystem
  // step=4 → startFromStep=5 (review)
  // step=5 → startFromStep=6 (tests)
  // step=6 → startFromStep=7 (deploy)
  return resumePipeline(ticket, projectId, { startFromStep: step + 1 });
}

// ── Helpers for subtask merging ──────────────────────────────────────────────

/** Merge file arrays: newer files override existing ones by path. */
export function mergeFiles(existing: CodeFile[], newFiles: CodeFile[]): CodeFile[] {
  const map = new Map<string, CodeFile>();
  for (const f of existing) map.set(f.path, f);
  for (const f of newFiles) map.set(f.path, f);
  return Array.from(map.values());
}

/** Merge two CodingResults: additive for metrics, concatenate diffs/summaries, merge files. */
export function mergeCodingResults(a: CodingResult, b: CodingResult): CodingResult {
  return {
    files: mergeFiles(a.files, b.files),
    baseFiles: a.baseFiles.length > 0 ? a.baseFiles : b.baseFiles,
    summary: [a.summary, b.summary].filter(Boolean).join('\n'),
    diff: [a.diff, b.diff].filter(Boolean).join('\n'),
    linesAdded: a.linesAdded + b.linesAdded,
    linesRemoved: a.linesRemoved + b.linesRemoved,
    tokensUsed: a.tokensUsed + b.tokensUsed,
    costUsd: Math.round((a.costUsd + b.costUsd) * 10000) / 10000,
    branchName: a.branchName || b.branchName,
    repoDir: a.repoDir || b.repoDir,
    previewPath: a.previewPath || b.previewPath,
  };
}
