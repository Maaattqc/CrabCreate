import { describe, it, expect } from 'vitest';
import {
  createSubtaskSchema,
  updateSubtaskSchema,
  createLabelSchema,
  updateLabelSchema,
  createTicketTemplateSchema,
  createUserWebhookSchema,
  updateUserWebhookSchema,
  createTicketSchema,
} from '../schemas';

// ── createSubtaskSchema ─────────────────────────────────────────────────────

describe('createSubtaskSchema', () => {
  it('accepts valid input', () => {
    const result = createSubtaskSchema.safeParse({ title: 'Write tests' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Write tests');
      expect(result.data.description).toBe('');
    }
  });

  it('accepts valid input with description', () => {
    const result = createSubtaskSchema.safeParse({ title: 'Write tests', description: 'Unit tests for auth' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Write tests');
      expect(result.data.description).toBe('Unit tests for auth');
    }
  });

  it('rejects empty title', () => {
    const result = createSubtaskSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Titre requis');
    }
  });

  it('rejects too long title (over 200 chars)', () => {
    const result = createSubtaskSchema.safeParse({ title: 'A'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

// ── updateSubtaskSchema ─────────────────────────────────────────────────────

describe('updateSubtaskSchema', () => {
  it('accepts valid partial update', () => {
    const result = updateSubtaskSchema.safeParse({ title: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = updateSubtaskSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map(i => i.message).join(' ');
      expect(msg).toContain('At least one field required');
    }
  });
});

// ── createLabelSchema ───────────────────────────────────────────────────────

describe('createLabelSchema', () => {
  it('accepts valid input', () => {
    const result = createLabelSchema.safeParse({ name: 'Bug', color: '#ef4444' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Bug');
      expect(result.data.color).toBe('#ef4444');
    }
  });

  it('rejects invalid color (#xyz)', () => {
    const result = createLabelSchema.safeParse({ name: 'Bug', color: '#xyz' });
    expect(result.success).toBe(false);
  });

  it('accepts valid hex color', () => {
    const result = createLabelSchema.safeParse({ name: 'Feature', color: '#22c55e' });
    expect(result.success).toBe(true);
  });
});

// ── updateLabelSchema ───────────────────────────────────────────────────────

describe('updateLabelSchema', () => {
  it('accepts valid partial update', () => {
    const result = updateLabelSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = updateLabelSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map(i => i.message).join(' ');
      expect(msg).toContain('At least one field required');
    }
  });
});

// ── createTicketTemplateSchema ──────────────────────────────────────────────

describe('createTicketTemplateSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = createTicketTemplateSchema.safeParse({ name: 'Bug Report' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Bug Report');
      expect(result.data.title_template).toBe('');
      expect(result.data.description_template).toBe('');
      expect(result.data.priority).toBe('medium');
      expect(result.data.template).toBe('feature');
      expect(result.data.tags).toEqual([]);
    }
  });
});

// ── createUserWebhookSchema ─────────────────────────────────────────────────

describe('createUserWebhookSchema', () => {
  it('accepts valid input', () => {
    const result = createUserWebhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['ticket:created'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://example.com/webhook');
      expect(result.data.events).toEqual(['ticket:created']);
    }
  });

  it('rejects invalid URL', () => {
    const result = createUserWebhookSchema.safeParse({
      url: 'not-a-url',
      events: ['ticket:created'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-https URL', () => {
    const result = createUserWebhookSchema.safeParse({
      url: 'http://example.com/webhook',
      events: ['ticket:created'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty events array', () => {
    const result = createUserWebhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects too many events', () => {
    const result = createUserWebhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: Array.from({ length: 11 }, () => 'ticket:created'),
    });
    expect(result.success).toBe(false);
  });
});

// ── updateUserWebhookSchema ─────────────────────────────────────────────────

describe('updateUserWebhookSchema', () => {
  it('accepts valid partial update', () => {
    const result = updateUserWebhookSchema.safeParse({ url: 'https://new.com/hook' });
    expect(result.success).toBe(true);
  });

  it('rejects empty object', () => {
    const result = updateUserWebhookSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map(i => i.message).join(' ');
      expect(msg).toContain('At least one field required');
    }
  });
});

// ── createTicketSchema with due_date ────────────────────────────────────────

describe('createTicketSchema with due_date', () => {
  it('accepts optional due_date', () => {
    const result = createTicketSchema.safeParse({
      title: 'Ticket with due date',
      due_date: '2025-12-31',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.due_date).toBe('2025-12-31');
    }
  });

  it('accepts ticket without due_date', () => {
    const result = createTicketSchema.safeParse({
      title: 'Ticket without due date',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.due_date).toBeUndefined();
    }
  });

  it('rejects too many tags', () => {
    const result = createTicketSchema.safeParse({
      title: 'Ticket with too many tags',
      tags: Array.from({ length: 51 }, (_, i) => `tag-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects too many target files', () => {
    const result = createTicketSchema.safeParse({
      title: 'Ticket with too many files',
      target_files: Array.from({ length: 201 }, (_, i) => `src/file-${i}.ts`),
    });
    expect(result.success).toBe(false);
  });
});
