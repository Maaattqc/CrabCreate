import config from '../config';
import db from '../db/sqlite';
import { readAllDbDocs } from './db-docs-reader';
import * as repoReader from './repo-reader';
import { emitTicketLog } from '../socket';
import { createPatch } from 'diff';
import { getClient } from './ai-client';
import * as repo from '../db/repositories';
import type { Ticket, CodingResult, ChatMessage, ConfigRow } from '../types';

const GENERIC_PREFIX = 'Analyse cette tâche et génère les modifications de code appropriées (nouvelle fonctionnalité, correction de bug, refactoring, etc.) en te basant sur le titre et la description :';

/**
 * Estimate ticket complexity using AI.
 */
async function estimateComplexity(ticket: Ticket): Promise<{ complexity: string }> {
  const { type, client } = getClient(ticket.ai_model);
  const prompt = `Analyse cette tâche et estime sa complexité.\n\nTitre: ${ticket.title}\nDescription: ${ticket.description}\n\nRéponds en JSON: { "complexity": "easy|medium|hard", "reason": "..." }`;

  try {
    let response: string;
    const claudeModel = repo.getConfig('ai_model_claude_version') || 'claude-opus-4-6';
    const gptModel = repo.getConfig('ai_model_gpt_version') || 'gpt-5.3';
    const tokensComplexity = parseInt(repo.getConfig('ai_tokens_complexity') || '500', 10);

    if (type === 'anthropic') {
      const msg = await client.messages.create({
        model: claudeModel,
        max_tokens: tokensComplexity,
        messages: [{ role: 'user', content: prompt }],
      });
      response = (msg.content[0] as { type: 'text'; text: string }).text;
    } else {
      const msg = await client.chat.completions.create({
        model: gptModel,
        max_tokens: tokensComplexity,
        messages: [{ role: 'user', content: prompt }],
      });
      response = msg.choices[0].message.content || '';
    }

    const json = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{"complexity":"medium"}');
    return { complexity: json.complexity || 'medium' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AICoder] Estimation error:', message);
    return { complexity: 'medium' };
  }
}

/**
 * Generate code modifications using AI.
 */
async function generateCode(ticket: Ticket): Promise<CodingResult> {
  const { type, client } = getClient(ticket.ai_model);

  // Get system prompt
  const configRow = db.prepare("SELECT config_value FROM kanban_config WHERE config_key = 'system_prompt'").get() as ConfigRow | undefined;
  const systemPrompt = configRow ? configRow.config_value : '';

  // Parse target files
  let targetFiles: string[] = [];
  try {
    targetFiles = JSON.parse(ticket.target_files || '[]');
  } catch { targetFiles = []; }

  // Read repo and files
  let existingFiles: { path: string; content: string }[] = [];
  let repoDir = '';
  try {
    const result = await repoReader.cloneOrPull(ticket);
    repoDir = result.repoDir;
    existingFiles = repoReader.readTargetFiles(repoDir, targetFiles);
    emitTicketLog(ticket.id, `Repo cloné, ${existingFiles.length} fichier(s) lu(s)`, 'info', 'coding');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emitTicketLog(ticket.id, `Erreur repo: ${message}. Mode simulation.`, 'warning', 'coding');
  }

  // Read DB docs
  const dbDocsContent = readAllDbDocs();

  // Build prompt
  let userPrompt = `${GENERIC_PREFIX}\n\nTICKET: ${ticket.title}\nDESCRIPTION: ${ticket.description}\n\n`;

  if (dbDocsContent) {
    userPrompt += `DATABASE CONTEXT (SQL Server schema of the existing PHP site):\n${dbDocsContent}\n\n`;
  }

  if (existingFiles.length > 0) {
    userPrompt += 'EXISTING CODE:\n';
    for (const file of existingFiles) {
      userPrompt += `--- ${file.path} ---\n${file.content}\n--- end ---\n\n`;
    }
  }

  userPrompt += `Generate the modified code for each file. Respond in JSON format:
{
  "files": [
    { "path": "relative/path.php", "content": "full file content" }
  ],
  "summary": "brief description of changes"
}`;

  let response: string;
  let tokensUsed = 0;
  const maxTokens = parseInt(repo.getConfig('ai_max_tokens') || '8192', 10);

  try {
    const claudeModelCode = repo.getConfig('ai_model_claude_version') || 'claude-opus-4-6';
    const gptModelCode = repo.getConfig('ai_model_gpt_version') || 'gpt-5.3';

    if (type === 'anthropic') {
      const msg = await client.messages.create({
        model: claudeModelCode,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      response = (msg.content[0] as { type: 'text'; text: string }).text;
      tokensUsed = (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0);
    } else {
      const msg = await client.chat.completions.create({
        model: gptModelCode,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      response = msg.choices[0].message.content || '';
      tokensUsed = msg.usage?.total_tokens || 0;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`AI API error: ${message}`);
  }

  // Parse response
  let result: { files?: { path: string; content: string }[]; summary?: string };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    result = JSON.parse(jsonMatch?.[0] || '{}');
  } catch {
    throw new Error('Impossible de parser la réponse AI en JSON');
  }

  if (!result.files || !Array.isArray(result.files)) {
    throw new Error('Réponse AI invalide: pas de fichiers générés');
  }

  // Calculate diff
  let linesAdded = 0;
  let linesRemoved = 0;
  let diffStr = '';

  for (const newFile of result.files) {
    const existing = existingFiles.find(f => f.path === newFile.path);
    const oldContent = existing ? existing.content : '';
    const patch = createPatch(newFile.path, oldContent, newFile.content || '');
    diffStr += patch + '\n';

    const lines = patch.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) linesAdded++;
      if (line.startsWith('-') && !line.startsWith('---')) linesRemoved++;
    }
  }

  // Write files to repo
  if (repoDir) {
    try {
      repoReader.writeFiles(repoDir, result.files);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      emitTicketLog(ticket.id, `Erreur écriture fichiers: ${message}`, 'warning', 'coding');
    }
  }

  // Branch name
  const branchMaxLen = parseInt(repo.getConfig('branch_name_max_length') || '30', 10);
  const branchName = `kanban/ticket-${ticket.id}-${ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, branchMaxLen)}`;

  // Estimate cost (rough)
  const costPerTokenGpt = parseFloat(repo.getConfig('ai_cost_per_token_gpt') || '0.00003');
  const costPerTokenClaude = parseFloat(repo.getConfig('ai_cost_per_token_claude') || '0.000015');
  const costPerToken = ticket.ai_model === 'gpt' ? costPerTokenGpt : costPerTokenClaude;
  const costUsd = Math.round(tokensUsed * costPerToken * 10000) / 10000;

  return {
    files: result.files,
    summary: result.summary || '',
    diff: diffStr,
    linesAdded,
    linesRemoved,
    tokensUsed,
    costUsd,
    branchName,
    repoDir,
  };
}

/**
 * Chat with AI — modify code based on user instructions.
 */
async function chat(ticket: Ticket, history: ChatMessage[], userMessage: string): Promise<{ message: string; codeModified: boolean; diff: string | null }> {
  const { type, client } = getClient(ticket.ai_model);

  const configRow = db.prepare("SELECT config_value FROM kanban_config WHERE config_key = 'system_prompt'").get() as ConfigRow | undefined;
  const systemPrompt = configRow ? configRow.config_value : '';

  const messages = history.map(h => ({
    role: (h.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: h.message,
  }));

  let response: string;
  try {
    const claudeModelChat = repo.getConfig('ai_model_claude_version') || 'claude-opus-4-6';
    const gptModelChat = repo.getConfig('ai_model_gpt_version') || 'gpt-5.3';
    const tokensChat = parseInt(repo.getConfig('ai_tokens_chat') || '4096', 10);

    if (type === 'anthropic') {
      const msg = await client.messages.create({
        model: claudeModelChat,
        max_tokens: tokensChat,
        system: systemPrompt,
        messages,
      });
      response = (msg.content[0] as { type: 'text'; text: string }).text;
    } else {
      const msg = await client.chat.completions.create({
        model: gptModelChat,
        max_tokens: tokensChat,
        messages: [{ role: 'system' as const, content: systemPrompt }, ...messages],
      });
      response = msg.choices[0].message.content || '';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`AI Chat error: ${message}`);
  }

  // Check if response contains code modifications (JSON with files array)
  let codeModified = false;
  const diff: string | null = null;
  try {
    const jsonMatch = response.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (jsonMatch) {
      codeModified = true;
    }
  } catch { /* ignore */ }

  return { message: response, codeModified, diff };
}

export { estimateComplexity, generateCode, chat };
