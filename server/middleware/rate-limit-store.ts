import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import db from '../db/sqlite';

const CLEANUP_INTERVAL_MS = 60_000;

type RateLimitRow = {
  hits: number;
  reset_at: number;
};

let schemaReady = false;

function nowMs(): number {
  return Date.now();
}

function resetTime(resetAt: number): Date {
  return new Date(resetAt);
}

function ensureRateLimitSchema(): void {
  if (schemaReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_rate_limit_hits (
      bucket_key TEXT PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0,
      reset_at INTEGER NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at ON kanban_rate_limit_hits(reset_at);
  `);
  schemaReady = true;
}

export class SqliteRateLimitStore implements Store {
  localKeys = false;
  prefix: string;

  private windowMs = 60_000;
  private lastCleanupAt = 0;

  constructor(scope: string) {
    ensureRateLimitSchema();
    this.prefix = `ratelimit:${scope}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  get(key: string): ClientRateLimitInfo | undefined {
    const now = nowMs();
    this.cleanupExpired(now);

    const row = db.prepare(
      'SELECT hits, reset_at FROM kanban_rate_limit_hits WHERE bucket_key = ?'
    ).get(this.toBucketKey(key)) as RateLimitRow | undefined;

    if (!row) return undefined;
    if (row.reset_at <= now) {
      db.prepare('DELETE FROM kanban_rate_limit_hits WHERE bucket_key = ?').run(this.toBucketKey(key));
      return undefined;
    }

    return {
      totalHits: row.hits,
      resetTime: resetTime(row.reset_at),
    };
  }

  increment(key: string): ClientRateLimitInfo {
    const now = nowMs();
    this.cleanupExpired(now);

    const bucketKey = this.toBucketKey(key);
    const row = db.prepare(
      'SELECT hits, reset_at FROM kanban_rate_limit_hits WHERE bucket_key = ?'
    ).get(bucketKey) as RateLimitRow | undefined;

    if (!row || row.reset_at <= now) {
      const resetAt = now + this.windowMs;
      db.prepare(`
        INSERT INTO kanban_rate_limit_hits (bucket_key, hits, reset_at, updated_at)
        VALUES (?, 1, ?, datetime('now'))
        ON CONFLICT(bucket_key) DO UPDATE SET
          hits = 1,
          reset_at = excluded.reset_at,
          updated_at = datetime('now')
      `).run(bucketKey, resetAt);
      return { totalHits: 1, resetTime: resetTime(resetAt) };
    }

    const totalHits = row.hits + 1;
    db.prepare(
      "UPDATE kanban_rate_limit_hits SET hits = ?, updated_at = datetime('now') WHERE bucket_key = ?"
    ).run(totalHits, bucketKey);

    return {
      totalHits,
      resetTime: resetTime(row.reset_at),
    };
  }

  decrement(key: string): void {
    const bucketKey = this.toBucketKey(key);
    const row = db.prepare(
      'SELECT hits, reset_at FROM kanban_rate_limit_hits WHERE bucket_key = ?'
    ).get(bucketKey) as RateLimitRow | undefined;

    if (!row) return;

    if (row.hits <= 1 || row.reset_at <= nowMs()) {
      db.prepare('DELETE FROM kanban_rate_limit_hits WHERE bucket_key = ?').run(bucketKey);
      return;
    }

    db.prepare(
      "UPDATE kanban_rate_limit_hits SET hits = ?, updated_at = datetime('now') WHERE bucket_key = ?"
    ).run(row.hits - 1, bucketKey);
  }

  resetKey(key: string): void {
    db.prepare('DELETE FROM kanban_rate_limit_hits WHERE bucket_key = ?').run(this.toBucketKey(key));
  }

  resetAll(): void {
    db.prepare('DELETE FROM kanban_rate_limit_hits WHERE bucket_key LIKE ?').run(`${this.prefix}%`);
  }

  private toBucketKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private cleanupExpired(now: number): void {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    this.lastCleanupAt = now;
    db.prepare('DELETE FROM kanban_rate_limit_hits WHERE reset_at <= ?').run(now);
  }
}

export function createRateLimitStore(scope: string): Store {
  return new SqliteRateLimitStore(scope);
}
