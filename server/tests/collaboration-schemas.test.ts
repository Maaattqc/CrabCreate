import { describe, it, expect } from 'vitest';
import {
  createCommentSchema,
  updateCommentSchema,
  toggleReactionSchema,
} from '../schemas';

describe('createCommentSchema', () => {
  it('accepts valid content', () => {
    const result = createCommentSchema.safeParse({
      content: 'This is a valid comment',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = createCommentSchema.safeParse({
      content: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Contenu requis');
    }
  });

  it('rejects missing content', () => {
    const result = createCommentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects content over 5000 chars', () => {
    const result = createCommentSchema.safeParse({
      content: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Contenu trop long');
    }
  });

  it('accepts content at max length (5000)', () => {
    const result = createCommentSchema.safeParse({
      content: 'a'.repeat(5000),
    });
    expect(result.success).toBe(true);
  });
});

describe('updateCommentSchema', () => {
  it('accepts valid content', () => {
    const result = updateCommentSchema.safeParse({
      content: 'This is updated content',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = updateCommentSchema.safeParse({
      content: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Contenu requis');
    }
  });

  it('rejects missing content', () => {
    const result = updateCommentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects content over 5000 chars', () => {
    const result = updateCommentSchema.safeParse({
      content: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Contenu trop long');
    }
  });
});

describe('toggleReactionSchema', () => {
  it('accepts valid emoji (single emoji like 👍)', () => {
    const result = toggleReactionSchema.safeParse({
      emoji: '👍',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty emoji string', () => {
    const result = toggleReactionSchema.safeParse({
      emoji: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects emoji longer than 10 chars', () => {
    const result = toggleReactionSchema.safeParse({
      emoji: '👍👍👍👍👍👍',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing emoji field', () => {
    const result = toggleReactionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
