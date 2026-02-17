import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilters } from '../hooks/useFilters';
import type { Ticket, Label } from '../types';

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  title: 'Test',
  description: '',
  status: 'backlog',
  priority: 'medium',
  template: '',
  ai_model: 'claude',
  repo: '',
  assignee: 'unassigned',
  progress: 0,
  cost_usd: 0,
  tokens_used: 0,
  lines_added: 0,
  lines_removed: 0,
  ai_review_score: null,
  ai_review_data: null,
  test_results: null,
  target_files: '',
  tags: '',
  depends_on: '',
  complexity: '',
  pipeline_step: 0,
  position: 0,
  due_date: null,
  archived_at: null,
  branch_name: '',
  pr_url: '',
  pr_id: 0,
  staging_url: '',
  diff: '',
  creator_email: null,
  modifier_email: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...overrides,
});

describe('useFilters', () => {
  it('initial state has no active filters', () => {
    const { result } = renderHook(() => useFilters());

    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.priorities).toEqual([]);
    expect(result.current.filters.assignees).toEqual([]);
    expect(result.current.filters.dueDateFilter).toBe('all');
    expect(result.current.filters.labelIds).toEqual([]);
    expect(result.current.filters.showFavorites).toBe(false);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('setStatuses updates statuses filter', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setStatuses(['backlog', 'in_progress']);
    });

    expect(result.current.filters.statuses).toEqual(['backlog', 'in_progress']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('setPriorities updates priorities filter', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setPriorities(['high', 'critical']);
    });

    expect(result.current.filters.priorities).toEqual(['high', 'critical']);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearFilters resets all filters', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setStatuses(['backlog']);
      result.current.setPriorities(['high']);
      result.current.setShowFavorites(true);
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.priorities).toEqual([]);
    expect(result.current.filters.showFavorites).toBe(false);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters returns true when statuses are set', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setStatuses(['backlog']);
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters returns true when dueDateFilter is not all', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setDueDateFilter('overdue');
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters returns true when showFavorites is true', () => {
    const { result } = renderHook(() => useFilters());

    act(() => {
      result.current.setShowFavorites(true);
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('applyFilters filters tickets by status', () => {
    const { result } = renderHook(() => useFilters());

    const tickets = [
      makeTicket({ id: 1, status: 'backlog' }),
      makeTicket({ id: 2, status: 'in_progress' }),
      makeTicket({ id: 3, status: 'backlog' }),
    ];

    act(() => {
      result.current.setStatuses(['backlog']);
    });

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(2);
    expect(filtered.map(t => t.id)).toEqual([1, 3]);
  });

  it('applyFilters filters tickets by priority', () => {
    const { result } = renderHook(() => useFilters());

    const tickets = [
      makeTicket({ id: 1, priority: 'high' }),
      makeTicket({ id: 2, priority: 'low' }),
      makeTicket({ id: 3, priority: 'high' }),
    ];

    act(() => {
      result.current.setPriorities(['high']);
    });

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(2);
    expect(filtered.map(t => t.id)).toEqual([1, 3]);
  });

  it('applyFilters filters by due date overdue', () => {
    const { result } = renderHook(() => useFilters());

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const tickets = [
      makeTicket({ id: 1, due_date: yesterday }),
      makeTicket({ id: 2, due_date: tomorrow }),
      makeTicket({ id: 3, due_date: null }),
    ];

    act(() => {
      result.current.setDueDateFilter('overdue');
    });

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  it('applyFilters filters by due date today', () => {
    const { result } = renderHook(() => useFilters());

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const tickets = [
      makeTicket({ id: 1, due_date: today }),
      makeTicket({ id: 2, due_date: tomorrow }),
      makeTicket({ id: 3, due_date: null }),
    ];

    act(() => {
      result.current.setDueDateFilter('today');
    });

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  it('applyFilters filters by due date none', () => {
    const { result } = renderHook(() => useFilters());

    const today = new Date().toISOString().split('T')[0];
    const tickets = [
      makeTicket({ id: 1, due_date: today }),
      makeTicket({ id: 2, due_date: null }),
      makeTicket({ id: 3, due_date: null }),
    ];

    act(() => {
      result.current.setDueDateFilter('none');
    });

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(2);
    expect(filtered.map(t => t.id)).toEqual([2, 3]);
  });

  it('applyFilters filters by favorites', () => {
    const { result } = renderHook(() => useFilters());

    const tickets = [
      makeTicket({ id: 1 }),
      makeTicket({ id: 2 }),
      makeTicket({ id: 3 }),
    ];
    const favoriteIds = new Set([1, 3]);

    act(() => {
      result.current.setShowFavorites(true);
    });

    const filtered = result.current.applyFilters(tickets, {}, favoriteIds);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(t => t.id)).toEqual([1, 3]);
  });

  it('applyFilters filters by label ids', () => {
    const { result } = renderHook(() => useFilters());

    const tickets = [
      makeTicket({ id: 1 }),
      makeTicket({ id: 2 }),
      makeTicket({ id: 3 }),
    ];
    const ticketLabels: Record<number, Label[]> = {
      1: [{ id: 10, project_id: 1, name: 'bug', color: '#f00', created_at: '' }],
      2: [{ id: 20, project_id: 1, name: 'feature', color: '#0f0', created_at: '' }],
      3: [],
    };

    act(() => {
      result.current.setLabelIds([10]);
    });

    const filtered = result.current.applyFilters(tickets, ticketLabels, new Set());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  it('applyFilters with no active filters returns all tickets', () => {
    const { result } = renderHook(() => useFilters());

    const tickets = [
      makeTicket({ id: 1 }),
      makeTicket({ id: 2 }),
      makeTicket({ id: 3 }),
    ];

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(3);
  });

  it('applyFilters combines multiple filters', () => {
    const { result } = renderHook(() => useFilters());

    const tickets = [
      makeTicket({ id: 1, status: 'backlog', priority: 'high' }),
      makeTicket({ id: 2, status: 'backlog', priority: 'low' }),
      makeTicket({ id: 3, status: 'in_progress', priority: 'high' }),
    ];

    act(() => {
      result.current.setStatuses(['backlog']);
      result.current.setPriorities(['high']);
    });

    const filtered = result.current.applyFilters(tickets, {}, new Set());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });
});
