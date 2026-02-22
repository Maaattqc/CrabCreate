import * as dependencyChecker from './dependency-checker';
import * as fileLocker from './file-locker';
import * as repo from '../db/repositories';
import { resumePipelineFromCrash } from './pipeline-runner';
import { isTicketRepoValidForProject } from '../security/project-repo';
import { emitTicketLog, emitTicketStatus, emitTicketUpdated } from '../socket';
import logger from './logger';

let interval: ReturnType<typeof setInterval> | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let queueRunning = false;

/**
 * Recover tickets stuck in active pipeline statuses after a server crash.
 * Called once at startup, before the queue starts polling.
 */
function recoverStuckTickets(): void {
  try {
    const stuck = repo.findStuckPipelineTickets();
    if (stuck.length === 0) return;

    for (const ticket of stuck) {
      // Release orphaned file locks
      fileLocker.unlock(ticket.id);
      const step = ticket.pipeline_step || 0;
      repo.insertLog(ticket.id, `Pipeline interrompu par un crash serveur — reprise directe (était ${ticket.status}, step ${step})`, 'warning', 'recovery');
      repo.insertActivity(ticket.id, `Récupéré après crash serveur — relance auto (step ${step})`, 'recovery');
      logger.info(`[Recovery] ticket=#${ticket.id} "${ticket.title}" direct resume from "${ticket.status}" (step=${step})`);

      // Launch pipeline directly instead of going through queued state
      // This avoids the ticket flashing to "En attente" in the UI
      // Reset status to backlog so CAS in runPipeline passes (no socket emit = no UI flash)
      if (ticket.project_id) {
        repo.updateTicketFields(ticket.id, { status: 'backlog', progress: 0, pipeline_started_at: null });
        resumePipelineFromCrash(ticket, ticket.project_id).catch(err => {
          logger.error(`[Recovery] Resume failed for ticket #${ticket.id}, falling back to queue:`, err);
          // Fallback: re-queue so the polling picks it up later
          repo.requeueStuckTicket(ticket.id);
          if (ticket.project_id) {
            emitTicketStatus(ticket.id, 'queued', 0, ticket.project_id);
          }
        });
      } else {
        // No project — can't run pipeline, just re-queue
        repo.requeueStuckTicket(ticket.id);
      }
    }

    logger.info(`[Recovery] ${stuck.length} stuck ticket(s) recovered at startup`);
  } catch (err) {
    logger.error('[Recovery] Error recovering stuck tickets:', err);
  }
}

/**
 * Periodic cleanup of orphaned file locks and stale pipelines.
 * Runs every 5 minutes while the queue is active.
 */
function startStaleCleanup(): void {
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  cleanupInterval = setInterval(() => {
    try {
      // 1. Clean orphaned file locks: locks whose ticket is NOT in an active pipeline or queued state
      const allLocks = fileLocker.getAll();
      let orphanedCount = 0;
      for (const lock of allLocks) {
        const ticket = repo.findTicketById(lock.ticket_id);
        if (!ticket) {
          // Ticket deleted — clean lock
          fileLocker.unlock(lock.ticket_id);
          orphanedCount++;
          continue;
        }
        const activePipelineOrQueued = ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying', 'queued'];
        if (!activePipelineOrQueued.includes(ticket.status)) {
          fileLocker.unlock(lock.ticket_id);
          orphanedCount++;
        }
      }
      if (orphanedCount > 0) {
        logger.info(`[Cleanup] Removed ${orphanedCount} orphaned file lock(s)`);
      }

      // 2. Reset stale pipelines that exceeded the timeout
      const timeoutMinutes = parseInt(repo.getConfig('pipeline_timeout_minutes') || '30', 10);
      const stale = repo.findStalePipelineTickets(timeoutMinutes);
      for (const ticket of stale) {
        fileLocker.unlock(ticket.id);
        repo.resetStuckTicket(ticket.id);
        repo.insertLog(ticket.id, `Pipeline expiré après ${timeoutMinutes} min — ticket remis en backlog`, 'warning', 'recovery');
        repo.insertActivity(ticket.id, `Pipeline expiré (timeout ${timeoutMinutes} min)`, 'recovery');
        if (ticket.project_id) {
          emitTicketStatus(ticket.id, 'backlog', 0, ticket.project_id);
        }
        logger.info(`[Cleanup] ticket=#${ticket.id} pipeline timed out (>${timeoutMinutes}min), reset to backlog`);
      }
      if (stale.length > 0) {
        logger.info(`[Cleanup] Reset ${stale.length} stale pipeline(s)`);
      }
    } catch (err) {
      logger.error('[Cleanup] Periodic cleanup error:', err);
    }
  }, CLEANUP_INTERVAL_MS);

  logger.info('[Cleanup] Stale pipeline cleanup started (every 5min)');
}

function stopStaleCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Poll queued tickets and auto-relaunch when all blockers are resolved.
 * Checks: dependencies, file locks, repo validity, concurrency limit.
 */
function startQueue(): void {
  const pollingMs = parseInt(repo.getConfig('queue_polling_interval_ms') || '5000', 10);
  let isPolling = false;

  interval = setInterval(async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      const queued = repo.findQueuedTickets();
      const launchedProjects = new Set<number>();

      for (const ticket of queued) {
        if (!ticket.project_id) continue;
        if (launchedProjects.has(ticket.project_id)) continue;

        // 1. Check dependencies
        if (!dependencyChecker.check(ticket).ok) continue;

        // 2. Check file locks (read-only, no acquire)
        if (!fileLocker.check(ticket).ok) continue;

        // 3. Check repo validity
        if (!isTicketRepoValidForProject(ticket, ticket.project_id)) continue;

        // 4. Check concurrency limit
        const max = parseInt(repo.getConfig('max_concurrent_pipelines') || '2', 10);
        if (repo.countActivePipelines(ticket.project_id) >= max) continue;

        // All clear — re-fetch to confirm still queued (avoid stale data)
        const fresh = repo.findTicketById(ticket.id);
        if (!fresh || fresh.status !== 'queued') continue;

        // Auto-relaunch
        launchedProjects.add(ticket.project_id);
        emitTicketLog(ticket.id, 'Blocages résolus — relance automatique', 'success', 'queue', ticket.project_id);
        repo.insertLog(ticket.id, 'Blocages résolus — relance automatique', 'success', 'queue');
        repo.insertActivity(ticket.id, 'Relance automatique depuis la queue', 'queue');

        resumePipelineFromCrash(fresh, ticket.project_id).catch(err => {
          logger.error(`[Queue] Auto-relaunch failed for ticket #${ticket.id}:`, err);
        });
      }
    } catch (err) {
      logger.error('[Queue] Polling error:', err);
    } finally {
      isPolling = false;
    }
  }, pollingMs);

  queueRunning = true;

  // Start periodic stale cleanup alongside queue polling
  startStaleCleanup();

  logger.info(`[Queue] Polling started (every ${pollingMs}ms)`);
}

function stopQueue(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  stopStaleCleanup();
  queueRunning = false;
}

function isQueueRunning(): boolean {
  return queueRunning;
}

export { startQueue, stopQueue, recoverStuckTickets, isQueueRunning };
