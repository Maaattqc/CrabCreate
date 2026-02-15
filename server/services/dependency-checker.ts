import db from '../db/sqlite';
import type { Ticket, DependencyCheckResult } from '../types';

/**
 * Check that all tickets this ticket depends on are approved.
 * Dependencies must stay inside the same project to avoid cross-project leakage.
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
    const dep = db.prepare('SELECT id, status, title, project_id FROM kanban_tickets WHERE id = ?').get(depId) as {
      id: number;
      status: string;
      title: string;
      project_id: number | null;
    } | undefined;

    if (!dep) {
      return { ok: false, message: `Dependance #${depId} introuvable` };
    }

    if (dep.project_id !== ticket.project_id) {
      return { ok: false, message: `Dependance #${depId} invalide pour ce projet` };
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
