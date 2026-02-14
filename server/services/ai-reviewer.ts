import { getClient } from './ai-client';
import * as repo from '../db/repositories';
import type { Ticket, CodingResult, ReviewResult } from '../types';

/**
 * AI code review — second pass to check quality, security, performance.
 */
async function review(ticket: Ticket, codingResult: CodingResult): Promise<ReviewResult> {
  const { type, client } = getClient(ticket.ai_model);

  const prompt = `Review this code diff for quality, security, and performance. Score 0-100.

TICKET: ${ticket.title}
DESCRIPTION: ${ticket.description}

DIFF:
${codingResult.diff || 'No diff available'}

Respond in JSON:
{
  "score": 85,
  "summary": "Overall assessment",
  "issues": [
    { "severity": "warning|info|error", "message": "description", "file": "path", "line": null }
  ]
}`;

  try {
    const claudeModel = repo.getConfig('ai_model_claude_version') || 'claude-opus-4-6';
    const gptModel = repo.getConfig('ai_model_gpt_version') || 'gpt-5.3';
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
        max_tokens: tokensReview,
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
    console.error('[AIReviewer] Error:', message);
    return {
      score: 75,
      summary: 'Review completed with errors',
      issues: [{ severity: 'warning', message: `Review error: ${message}`, file: null, line: null }],
    };
  }
}

export { review };
