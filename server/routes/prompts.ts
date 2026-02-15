import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { updatePromptsSchema } from '../schemas';
import { requireAdmin } from '../middleware/auth';

const TEMPLATE_PREFIXES: Record<string, string> = {
  feature: 'Implement the following new feature:',
  bugfix: 'Fix the following bug:',
  refactor: 'Refactor the following code:',
  ui: 'Modify the UI as described:',
  perf: 'Optimize performance for:',
  security: 'Fix the following security issue:',
};

const router = Router();

// GET /api/prompts — admin only (system prompt may contain sensitive instructions)
router.get('/', requireAdmin, (req: Request, res: Response) => {
  const systemPrompt = repo.getConfig('system_prompt');
  res.json({
    systemPrompt: systemPrompt || '',
    templatePrefixes: TEMPLATE_PREFIXES,
  });
});

// PUT /api/prompts — admin only
router.put('/', requireAdmin, validate(updatePromptsSchema), (req: Request, res: Response) => {
  const { systemPrompt } = req.body;

  repo.setConfig('system_prompt', systemPrompt);

  res.json({ success: true, systemPrompt });
});

export default router;
