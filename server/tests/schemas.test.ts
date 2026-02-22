import { describe, it, expect } from 'vitest';
import {
  createTicketSchema,
  updateTicketSchema,
  sendChatSchema,
  requestCodeSchema,
  verifyCodeSchema,
  updateSettingsSchema,
  updatePromptsSchema,
} from '../schemas';

// ── createTicketSchema ───────────────────────────────────────────────────────

describe('createTicketSchema', () => {
  it('accepts valid input with all fields', () => {
    const data = {
      title: 'Fix login bug',
      description: 'The login page returns 500',
      ai_model: 'claude' as const,
      priority: 'high' as const,
      template: 'bugfix',
      repo: 'main-site',
      assignee: 'alice',
      target_files: ['src/login.php'],
      tags: ['urgent'],
      depends_on: [1, 2],
    };
    const result = createTicketSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Fix login bug');
      expect(result.data.priority).toBe('high');
      expect(result.data.ai_model).toBe('claude');
    }
  });

  it('accepts valid input with only title (defaults applied)', () => {
    const result = createTicketSchema.safeParse({ title: 'Minimal ticket' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Minimal ticket');
      expect(result.data.priority).toBe('medium');
      expect(result.data.ai_model).toBe('gpt');
      expect(result.data.description).toBe('');
      expect(result.data.template).toBe('feature');
      expect(result.data.repo).toBe('main-site');
      expect(result.data.assignee).toBe('unassigned');
      expect(result.data.target_files).toEqual([]);
      expect(result.data.tags).toEqual([]);
      expect(result.data.depends_on).toEqual([]);
    }
  });

  it('rejects missing title', () => {
    const result = createTicketSchema.safeParse({ description: 'No title here' });
    expect(result.success).toBe(false);
  });

  it('rejects title shorter than 3 characters', () => {
    const result = createTicketSchema.safeParse({ title: 'Ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find(
        (i) => i.path.includes('title') || i.message.includes('3'),
      );
      expect(titleError).toBeDefined();
    }
  });

  it('rejects title longer than 200 characters', () => {
    const result = createTicketSchema.safeParse({ title: 'A'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority value', () => {
    const result = createTicketSchema.safeParse({ title: 'Valid title', priority: 'urgent' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid priority values', () => {
    for (const priority of ['low', 'medium', 'high', 'critical']) {
      const result = createTicketSchema.safeParse({ title: 'Valid title', priority });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid ai_model value', () => {
    const result = createTicketSchema.safeParse({ title: 'Valid title', ai_model: 'llama' });
    expect(result.success).toBe(false);
  });

  it('accepts both valid ai_model values', () => {
    for (const ai_model of ['claude', 'gpt']) {
      const result = createTicketSchema.safeParse({ title: 'Valid title', ai_model });
      expect(result.success).toBe(true);
    }
  });

  it('rejects description longer than 5000 characters', () => {
    const result = createTicketSchema.safeParse({
      title: 'Valid title',
      description: 'D'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

// ── updateTicketSchema ───────────────────────────────────────────────────────

describe('updateTicketSchema', () => {
  it('accepts valid partial update with title', () => {
    const result = updateTicketSchema.safeParse({ title: 'Updated title' });
    expect(result.success).toBe(true);
  });

  it('accepts valid partial update with priority', () => {
    const result = updateTicketSchema.safeParse({ priority: 'critical' });
    expect(result.success).toBe(true);
  });

  it('accepts valid partial update with multiple fields', () => {
    const result = updateTicketSchema.safeParse({
      title: 'New title',
      description: 'New desc',
      priority: 'low',
      status: 'ai_coding',
      ai_model: 'gpt',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty object (no fields)', () => {
    const result = updateTicketSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ');
      expect(msg).toContain('At least one field required');
    }
  });

  it('rejects title shorter than 3 characters', () => {
    const result = updateTicketSchema.safeParse({ title: 'Ab' });
    expect(result.success).toBe(false);
  });

  it('accepts target_files as string or array', () => {
    const asArray = updateTicketSchema.safeParse({ target_files: ['file.php'] });
    expect(asArray.success).toBe(true);

    const asString = updateTicketSchema.safeParse({ target_files: '["file.php"]' });
    expect(asString.success).toBe(true);
  });

  it('accepts tags as string or array', () => {
    const asArray = updateTicketSchema.safeParse({ tags: ['frontend'] });
    expect(asArray.success).toBe(true);

    const asString = updateTicketSchema.safeParse({ tags: '["frontend"]' });
    expect(asString.success).toBe(true);
  });
});

// ── sendChatSchema ───────────────────────────────────────────────────────────

describe('sendChatSchema', () => {
  it('accepts valid message', () => {
    const result = sendChatSchema.safeParse({ message: 'Hello AI' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Hello AI');
    }
  });

  it('rejects empty message', () => {
    const result = sendChatSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing message field', () => {
    const result = sendChatSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects message longer than 10000 characters', () => {
    const result = sendChatSchema.safeParse({ message: 'X'.repeat(10001) });
    expect(result.success).toBe(false);
  });

  it('accepts message at max length (10000)', () => {
    const result = sendChatSchema.safeParse({ message: 'X'.repeat(10000) });
    expect(result.success).toBe(true);
  });
});

// ── requestCodeSchema ────────────────────────────────────────────────────────

describe('requestCodeSchema', () => {
  it('accepts valid email', () => {
    const result = requestCodeSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email (no @)', () => {
    const result = requestCodeSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email (no domain)', () => {
    const result = requestCodeSchema.safeParse({ email: 'user@' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = requestCodeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects email longer than 255 characters', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    const result = requestCodeSchema.safeParse({ email: longEmail });
    expect(result.success).toBe(false);
  });
});

// ── verifyCodeSchema ─────────────────────────────────────────────────────────

describe('verifyCodeSchema', () => {
  it('accepts valid 8-digit code', () => {
    const result = verifyCodeSchema.safeParse({ email: 'user@example.com', code: '12345678' });
    expect(result.success).toBe(true);
  });

  it('rejects code shorter than 8 digits', () => {
    const result = verifyCodeSchema.safeParse({ email: 'user@example.com', code: '1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects code longer than 8 digits', () => {
    const result = verifyCodeSchema.safeParse({ email: 'user@example.com', code: '123456789' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric code', () => {
    const result = verifyCodeSchema.safeParse({ email: 'user@example.com', code: 'abcdefgh' });
    expect(result.success).toBe(false);
  });

  it('rejects alphanumeric code', () => {
    const result = verifyCodeSchema.safeParse({ email: 'user@example.com', code: '12ab5678' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email in verify request', () => {
    const result = verifyCodeSchema.safeParse({ email: 'bad-email', code: '12345678' });
    expect(result.success).toBe(false);
  });
});

// ── updateSettingsSchema ─────────────────────────────────────────────────────

describe('updateSettingsSchema', () => {
  it('accepts valid settings', () => {
    const result = updateSettingsSchema.safeParse({
      max_requests_per_minute: 60,
      max_tickets_per_hour: 10,
      max_concurrent_pipelines: 3,
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial settings', () => {
    const result = updateSettingsSchema.safeParse({ max_requests_per_minute: 30 });
    expect(result.success).toBe(true);
  });

  it('rejects max_requests_per_minute below 1', () => {
    const result = updateSettingsSchema.safeParse({ max_requests_per_minute: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects max_requests_per_minute above 1000', () => {
    const result = updateSettingsSchema.safeParse({ max_requests_per_minute: 1001 });
    expect(result.success).toBe(false);
  });

  it('rejects max_tickets_per_hour below 1', () => {
    const result = updateSettingsSchema.safeParse({ max_tickets_per_hour: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects max_tickets_per_hour above 100', () => {
    const result = updateSettingsSchema.safeParse({ max_tickets_per_hour: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects max_concurrent_pipelines below 1', () => {
    const result = updateSettingsSchema.safeParse({ max_concurrent_pipelines: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects max_concurrent_pipelines above 10', () => {
    const result = updateSettingsSchema.safeParse({ max_concurrent_pipelines: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer values', () => {
    const result = updateSettingsSchema.safeParse({ max_requests_per_minute: 5.5 });
    expect(result.success).toBe(false);
  });
});

// ── updatePromptsSchema ──────────────────────────────────────────────────────

describe('updatePromptsSchema', () => {
  it('accepts valid system prompt', () => {
    const result = updatePromptsSchema.safeParse({ systemPrompt: 'You are a helpful assistant.' });
    expect(result.success).toBe(true);
  });

  it('accepts empty string as system prompt', () => {
    const result = updatePromptsSchema.safeParse({ systemPrompt: '' });
    expect(result.success).toBe(true);
  });

  it('rejects system prompt longer than 50000 characters', () => {
    const result = updatePromptsSchema.safeParse({ systemPrompt: 'P'.repeat(50001) });
    expect(result.success).toBe(false);
  });

  it('rejects missing systemPrompt field', () => {
    const result = updatePromptsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
