import { useState, useCallback, useMemo } from 'react';
import type { Ticket, Label } from '../types';

export interface FilterState {
  statuses: string[];
  priorities: string[];
  assignees: string[];
  dueDateFilter: string; // 'all' | 'overdue' | 'today' | 'this_week' | 'none'
  labelIds: number[];
  showFavorites: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  statuses: [],
  priorities: [],
  assignees: [],
  dueDateFilter: 'all',
  labelIds: [],
  showFavorites: false,
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setStatuses = useCallback((statuses: string[]) => setFilters(prev => ({ ...prev, statuses })), []);
  const setPriorities = useCallback((priorities: string[]) => setFilters(prev => ({ ...prev, priorities })), []);
  const setAssignees = useCallback((assignees: string[]) => setFilters(prev => ({ ...prev, assignees })), []);
  const setDueDateFilter = useCallback((dueDateFilter: string) => setFilters(prev => ({ ...prev, dueDateFilter })), []);
  const setLabelIds = useCallback((labelIds: number[]) => setFilters(prev => ({ ...prev, labelIds })), []);
  const setShowFavorites = useCallback((showFavorites: boolean) => setFilters(prev => ({ ...prev, showFavorites })), []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const hasActiveFilters = useMemo(() => {
    return filters.statuses.length > 0 || filters.priorities.length > 0 ||
      filters.assignees.length > 0 || filters.dueDateFilter !== 'all' ||
      filters.labelIds.length > 0 || filters.showFavorites;
  }, [filters]);

  const applyFilters = useCallback((tickets: Ticket[], ticketLabels: Record<number, Label[]>, favoriteIds: Set<number>) => {
    return tickets.filter(ticket => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(ticket.status)) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(ticket.priority)) return false;
      if (filters.assignees.length > 0 && !filters.assignees.includes(ticket.assignee)) return false;
      if (filters.showFavorites && !favoriteIds.has(ticket.id)) return false;

      if (filters.dueDateFilter !== 'all') {
        const today = new Date().toISOString().split('T')[0];
        const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        switch (filters.dueDateFilter) {
          case 'overdue': if (!ticket.due_date || ticket.due_date >= today) return false; break;
          case 'today': if (ticket.due_date !== today) return false; break;
          case 'this_week': if (!ticket.due_date || ticket.due_date < today || ticket.due_date > weekFromNow) return false; break;
          case 'none': if (ticket.due_date) return false; break;
        }
      }

      if (filters.labelIds.length > 0) {
        const tLabels = ticketLabels[ticket.id] || [];
        if (!filters.labelIds.some(id => tLabels.some(l => l.id === id))) return false;
      }

      return true;
    });
  }, [filters]);

  return {
    filters, setStatuses, setPriorities, setAssignees, setDueDateFilter,
    setLabelIds, setShowFavorites, clearFilters, hasActiveFilters, applyFilters,
  };
}
