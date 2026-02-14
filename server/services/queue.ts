import db from '../db/sqlite';
import * as dependencyChecker from './dependency-checker';
import * as repo from '../db/repositories';
import { emitTicketLog, emitTicketStatus } from '../socket';
import logger from './logger';
import type { Ticket } from '../types';

let interval: ReturnType<typeof setInterval> | null = null;

/**
 * Poll queued tickets and check if they can be launched.
 */
function startQueue(): void {
  const pollingMs = parseInt(repo.getConfig('queue_polling_interval_ms') || '5000', 10);

  interval = setInterval(() => {
    const queued = db.prepare("SELECT * FROM kanban_tickets WHERE status = 'queued' ORDER BY priority DESC, created_at ASC").all() as Ticket[];

    for (const ticket of queued) {
      const depResult = dependencyChecker.check(ticket);
      if (depResult.ok) {
        // Dependencies resolved — move back to backlog for manual re-launch
        db.prepare("UPDATE kanban_tickets SET status = 'backlog', updated_at = datetime('now') WHERE id = ?").run(ticket.id);
        emitTicketStatus(ticket.id, 'backlog', 0);
        emitTicketLog(ticket.id, 'Dépendances résolues — prêt à relancer', 'success', 'queue');
        db.prepare('INSERT INTO kanban_logs (ticket_id, message, log_type, phase) VALUES (?, ?, ?, ?)').run(ticket.id, 'Dépendances résolues — prêt à relancer', 'success', 'queue');
        db.prepare('INSERT INTO kanban_activity (ticket_id, message, activity_type) VALUES (?, ?, ?)').run(ticket.id, 'Retiré de la queue (dépendances résolues)', 'queue');
      }
    }
  }, pollingMs);

  logger.info(`[Queue] Polling started (every ${pollingMs}ms)`);
}

function stopQueue(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export { startQueue, stopQueue };
