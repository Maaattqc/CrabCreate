import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';

// Use vi.hoisted so the variable is available when vi.mock is hoisted
const { testDb } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  return { testDb };
});

// Mock the db module before importing anything that depends on it
vi.mock('../db/sqlite', () => ({ default: testDb }));

import { migrate } from '../db/migrations';
import { pipelineGuard } from '../middleware/pipeline-guard';
import { createTicket, updateTicketStatus, setConfig } from '../db/repositories';

beforeAll(() => {
  migrate();
});

beforeEach(() => {
  // Clean all tables before each test
  testDb.exec('DELETE FROM kanban_file_locks');
  testDb.exec('DELETE FROM kanban_activity');
  testDb.exec('DELETE FROM kanban_chat');
  testDb.exec('DELETE FROM kanban_logs');
  testDb.exec('DELETE FROM kanban_tickets');
  testDb.exec('DELETE FROM kanban_config');
});

function createMocks() {
  const mockReq = {} as Request;
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const mockNext = vi.fn() as NextFunction;
  return { mockReq, mockRes, mockNext };
}

describe('pipelineGuard', () => {
  it('allows request when no active pipelines exist', () => {
    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('allows request when under the default limit (2)', () => {
    // Create 1 active pipeline
    const ticket = createTicket({ title: 'Active ticket 1' });
    updateTicketStatus(ticket.id, 'ai_coding', 50);

    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('rejects with 429 when at the default limit (2)', () => {
    // Create 2 active pipelines (default max is 2)
    const ticket1 = createTicket({ title: 'Active 1' });
    updateTicketStatus(ticket1.id, 'ai_coding', 50);

    const ticket2 = createTicket({ title: 'Active 2' });
    updateTicketStatus(ticket2.id, 'ai_review', 70);

    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('2'),
      }),
    );
  });

  it('respects custom max_concurrent_pipelines config', () => {
    // Set a higher limit
    setConfig('max_concurrent_pipelines', '5');

    // Create 3 active pipelines (under the new limit of 5)
    const ticket1 = createTicket({ title: 'Active 1' });
    updateTicketStatus(ticket1.id, 'estimating', 10);

    const ticket2 = createTicket({ title: 'Active 2' });
    updateTicketStatus(ticket2.id, 'ai_coding', 30);

    const ticket3 = createTicket({ title: 'Active 3' });
    updateTicketStatus(ticket3.id, 'testing', 80);

    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('rejects when at custom limit', () => {
    setConfig('max_concurrent_pipelines', '1');

    const ticket = createTicket({ title: 'Active 1' });
    updateTicketStatus(ticket.id, 'deploying', 90);

    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
  });

  it('does not count non-active statuses towards the limit', () => {
    // Create tickets with non-active statuses
    const t1 = createTicket({ title: 'Backlog' });
    // backlog is default, leave it

    const t2 = createTicket({ title: 'Done' });
    updateTicketStatus(t2.id, 'done', 100);

    const t3 = createTicket({ title: 'Approved' });
    updateTicketStatus(t3.id, 'approved', 100);

    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('counts all active statuses: estimating, ai_coding, ai_review, testing, deploying', () => {
    setConfig('max_concurrent_pipelines', '5');

    const statuses = ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying'];
    for (const status of statuses) {
      const t = createTicket({ title: `Ticket ${status}` });
      updateTicketStatus(t.id, status, 50);
    }

    const { mockReq, mockRes, mockNext } = createMocks();

    pipelineGuard(mockReq, mockRes, mockNext);

    // Exactly at limit of 5, should reject
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
  });
});
