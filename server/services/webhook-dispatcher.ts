import crypto from 'crypto';
import logger from './logger';
import * as repo from '../db/repositories';

export async function dispatchWebhooks(projectId: number, event: string, payload: Record<string, unknown>): Promise<void> {
  // Find all enabled webhooks for this project + event
  const webhooks = repo.findUserWebhooksByEvent(projectId, event);

  for (const webhook of webhooks) {
    try {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
      };

      // HMAC-SHA256 signature if secret is set
      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      // Fire and forget with 5s timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        logger.warn(`Webhook ${webhook.id} to ${webhook.url} returned ${res.status}`);
      }
    } catch (err) {
      logger.error(`Webhook ${webhook.id} dispatch failed:`, err);
    }
  }
}
