import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { takeScreenshot, takeScreenshotWithElements, isAvailable } from '../services/screenshotter';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import logger from '../services/logger';

const router = Router();

const screenshotLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  store: createRateLimitStore('screenshot'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.user?.userId ?? 'anonymous'}`,
  message: { error: 'Too many screenshot requests. Try again later.' },
});

// GET /api/screenshot?url=<encoded_url>
router.get('/', screenshotLimiter, async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined;
  if (!url) return res.status(400).json({ error: 'url query parameter required' });

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
  }

  if (!isAvailable()) {
    return res.status(503).json({ error: 'Screenshot service unavailable (Chrome not found)' });
  }

  try {
    const base64 = await takeScreenshot(url);
    res.json({ data: base64, mediaType: 'image/jpeg' });
  } catch (err) {
    logger.error('[Screenshot] Error:', err);
    res.status(500).json({ error: 'Screenshot failed' });
  }
});

// GET /api/screenshot/elements?url=<encoded_url>
router.get('/elements', screenshotLimiter, async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined;
  if (!url) return res.status(400).json({ error: 'url query parameter required' });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
  }

  if (!isAvailable()) {
    return res.status(503).json({ error: 'Screenshot service unavailable (Chrome not found)' });
  }

  try {
    const result = await takeScreenshotWithElements(url);
    res.json({
      data: result.screenshot,
      mediaType: 'image/jpeg',
      elements: result.elements,
      pageWidth: result.pageWidth,
      pageHeight: result.pageHeight,
    });
  } catch (err) {
    logger.error('[Screenshot/elements] Error:', err);
    res.status(500).json({ error: 'Element picker screenshot failed' });
  }
});

export default router;
