import * as dependencyChecker from './dependency-checker';
import * as repo from '../db/repositories';
import { emitTicketLog, emitTicketStatus } from '../socket';
import logger from './logger';

let interval: ReturnType<typeof setInterval> | null = null;

/**
 * Poll queued tickets and check if they can be launched.
 */
function startQueue(): void {
  const pollingMs = parseInt(repo.getConfig('queue_polling_interval_ms') || '5000', 10);

  interval = setInterval(() => {
    const queued = repo.findQueuedTickets();

    for (const ticket of queued) {
      const depResult = dependencyChecker.check(ticket);
      if (depResult.ok) {
        // Dependencies resolved — move back to backlog for manual re-launch
        repo.updateTicketStatus(ticket.id, 'backlog', 0);
        emitTicketStatus(ticket.id, 'backlog', 0);
        emitTicketLog(ticket.id, 'Dépendances résolues — prêt à relancer', 'success', 'queue');
        repo.insertLog(ticket.id, 'Dépendances résolues — prêt à relancer', 'success', 'queue');
        repo.insertActivity(ticket.id, 'Retiré de la queue (dépendances résolues)', 'queue');
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
