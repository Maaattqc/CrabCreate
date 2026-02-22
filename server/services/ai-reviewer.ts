import { getClient } from './ai-client';
import * as repo from '../db/repositories';
import logger from './logger';
import type { Ticket, CodingResult, ReviewResult } from '../types';

/** Count meaningful changed lines in a diff (ignore empty/whitespace-only). */
function countDiffLines(diff: string): number {
  if (!diff) return 0;
  return diff.split('\n').filter(l => /^[+-]/.test(l) && !/^[+-]{3}\s/.test(l) && l.replace(/^[+-]/, '').trim().length > 0).length;
}

/** Build a summary of the full files for context (truncated to stay within token budget). */
function buildFileContext(codingResult: CodingResult, maxChars: number): string {
  const sections: string[] = [];
  let remaining = maxChars;

  for (const file of codingResult.files) {
    const header = `\n── ${file.path} ──\n`;
    const content = file.content.length > remaining ? file.content.slice(0, remaining) + '\n[...truncated]' : file.content;
    sections.push(header + content);
    remaining -= content.length;
    if (remaining <= 0) break;
  }

  return sections.join('\n');
}

/**
 * AI code review — second pass to check quality, security, performance.
 * Small changes (< SMALL_CHANGE_THRESHOLD lines) are auto-approved to avoid
 * the reviewer penalizing trivial cosmetic/text changes.
 */
async function review(ticket: Ticket, codingResult: CodingResult): Promise<ReviewResult> {
  // Auto-approve chat modifications — the initial code already passed review,
  // the AI just applied the user's requested change, no need for a costly second review
  if (codingResult.modificationPrompt) {
    logger.info(`[AIReviewer] ticket=#${ticket.id} chat modification — auto-approved`);
    return {
      score: 90,
      summary: `Modification chat auto-approuvée : ${codingResult.modificationPrompt.slice(0, 100)}`,
      issues: [],
    };
  }

  const SMALL_CHANGE_THRESHOLD = 8;
  const diffLines = countDiffLines(codingResult.diff);

  // Auto-approve small changes (cosmetic, text, color tweaks, etc.)
  if (diffLines > 0 && diffLines <= SMALL_CHANGE_THRESHOLD) {
    logger.info(`[AIReviewer] ticket=#${ticket.id} small change (${diffLines} lines) — auto-approved`);
    return {
      score: 90,
      summary: `Changement mineur (${diffLines} lignes) — auto-approuvé`,
      issues: [],
    };
  }

  const { type, client } = getClient(ticket.ai_model);

  // Include full file context so the reviewer can judge the change in context
  const fileContext = buildFileContext(codingResult, 6000);

  const prompt = `You are reviewing code changes for a ticket. Judge whether the changes correctly implement the requested feature/fix. Be pragmatic — small cosmetic changes, text edits, and simple CSS tweaks should score high if they do what was asked.

TICKET: ${ticket.title}
DESCRIPTION: ${ticket.description}

DIFF (${codingResult.linesAdded} added, ${codingResult.linesRemoved} removed):
${codingResult.diff || 'No diff available'}

FULL FILES AFTER CHANGES:
${fileContext}

Score 0-100 based on:
- Does the code do what the ticket asks? (most important)
- Are there bugs or obvious errors?
- Any security issues? (SQL injection, XSS, etc.)
- Only flag performance issues if they are significant

Respond ONLY with JSON:
{
  "score": 85,
  "summary": "Overall assessment in 1-2 sentences",
  "issues": [
    { "severity": "warning|info|error", "message": "description", "file": "path", "line": null }
  ]
}`;

  try {
    const claudeModel = repo.getConfig('ai_model_claude_version') || 'claude-opus-4-6';
    const gptModel = repo.getConfig('ai_model_gpt_version') || 'gpt-5.2-2025-12-11';
    const tokensReview = parseInt(repo.getConfig('ai_tokens_review') || '2048', 10);

    let response: string;
    if (type === 'anthropic') {
      const msg = await client.messages.create({
        model: claudeModel,
        max_tokens: tokensReview,
        messages: [{ role: 'user', content: prompt }],
      });
      response = (msg.content[0] as { type: 'text'; text: string }).text;
    } else {
      const msg = await client.chat.completions.create({
        model: gptModel,
        max_completion_tokens: tokensReview,
        messages: [{ role: 'user', content: prompt }],
      });
      response = msg.choices[0].message.content || '';
    }

    const json = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return {
      score: json.score || 75,
      summary: json.summary || 'Review completed',
      issues: json.issues || [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AIReviewer] Error:', message);
    return {
      score: 75,
      summary: 'Review completed with errors',
      issues: [{ severity: 'warning', message: `Review error: ${message}`, file: null, line: null }],
    };
  }
}

export { review };
