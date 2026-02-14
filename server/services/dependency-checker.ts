import db from '../db/sqlite';
import type { Ticket, DependencyCheckResult } from '../types';

/**
 * Check that all tickets this ticket depends on are approved.
 */
function check(ticket: Ticket): DependencyCheckResult {
  let dependsOn: number[] = [];
  try {
    dependsOn = JSON.parse(ticket.depends_on || '[]');
  } catch {
    dependsOn = [];
  }

  if (dependsOn.length === 0) {
    return { ok: true };
  }

  for (const depId of dependsOn) {
    const dep = db.prepare('SELECT id, status, title FROM kanban_tickets WHERE id = ?').get(depId) as { id: number; status: string; title: string } | undefined;
    if (!dep) {
      return { ok: false, message: `Dépendance #${depId} introuvable` };
    }
    if (dep.status !== 'approved') {
      return {
        ok: false,
        message: `En attente du ticket #${dep.id} "${dep.title}" (statut: ${dep.status})`,
      };
    }
  }

  return { ok: true };
}

export { check };
