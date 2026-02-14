import { describe, it, expect } from 'vitest';
import { COLUMNS, PRIORITIES, TEMPLATES, AI_MODELS, getColumnColor, getPriorityColor } from '../constants';

describe('constants', () => {
  it('has 11 columns', () => {
    expect(COLUMNS).toHaveLength(11);
  });

  it('columns have required fields', () => {
    for (const col of COLUMNS) {
      expect(col).toHaveProperty('id');
      expect(col).toHaveProperty('label');
      expect(col).toHaveProperty('color');
    }
  });

  it('has backlog as first column', () => {
    expect(COLUMNS[0].id).toBe('backlog');
  });

  it('has 4 priorities', () => {
    expect(PRIORITIES).toHaveLength(4);
  });

  it('has 6 templates', () => {
    expect(TEMPLATES).toHaveLength(6);
  });

  it('has 2 AI models', () => {
    expect(AI_MODELS).toHaveLength(2);
    expect(AI_MODELS.map(m => m.id)).toContain('claude');
    expect(AI_MODELS.map(m => m.id)).toContain('gpt');
  });
});

describe('getColumnColor', () => {
  it('returns correct color for known status', () => {
    expect(getColumnColor('backlog')).toBe('#94a3b8');
    expect(getColumnColor('approved')).toBe('#4ade80');
    expect(getColumnColor('rejected')).toBe('#f87171');
  });

  it('returns fallback for unknown status', () => {
    expect(getColumnColor('unknown')).toBe('#64748b');
  });
});

describe('getPriorityColor', () => {
  it('returns correct color for known priority', () => {
    expect(getPriorityColor('critical')).toBe('#ef4444');
    expect(getPriorityColor('low')).toBe('#22c55e');
  });

  it('returns fallback for unknown priority', () => {
    expect(getPriorityColor('unknown')).toBe('#eab308');
  });
});
