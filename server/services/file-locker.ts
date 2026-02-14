import db from '../db/sqlite';
import type { Ticket, FileLock, FileCheckResult } from '../types';

/**
 * Check if target files are locked by another ticket, and lock them if free.
 */
function checkAndLock(ticket: Ticket): FileCheckResult {
  let targetFiles: string[] = [];
  try {
    targetFiles = JSON.parse(ticket.target_files || '[]');
  } catch {
    targetFiles = [];
  }

  if (targetFiles.length === 0) {
    return { ok: true };
  }

  // Check for conflicts
  for (const filePath of targetFiles) {
    const lock = db.prepare(
      'SELECT * FROM kanban_file_locks WHERE file_path = ? AND ticket_id != ?'
    ).get(filePath, ticket.id) as FileLock | undefined;

    if (lock) {
      return {
        ok: false,
        message: `Fichier "${filePath}" bloqué par le ticket #${lock.ticket_id}`,
      };
    }
  }

  // Lock all files
  const insert = db.prepare('INSERT OR IGNORE INTO kanban_file_locks (file_path, ticket_id) VALUES (?, ?)');
  for (const filePath of targetFiles) {
    insert.run(filePath, ticket.id);
  }

  return { ok: true };
}

/**
 * Release all file locks for a ticket.
 */
function unlock(ticketId: number): void {
  db.prepare('DELETE FROM kanban_file_locks WHERE ticket_id = ?').run(ticketId);
}

/**
 * Get all current file locks.
 */
function getAll(): FileLock[] {
  return db.prepare(`
    SELECT fl.*, t.title as ticket_title
    FROM kanban_file_locks fl
    LEFT JOIN kanban_tickets t ON fl.ticket_id = t.id
  `).all() as FileLock[];
}

export { checkAndLock, unlock, getAll };
