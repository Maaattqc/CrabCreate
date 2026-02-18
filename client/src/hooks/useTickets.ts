import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/tickets';
import type { Ticket, TicketFilters } from '../types';

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<TicketFilters>({});

  const initialLoadDone = useRef(false);

  const fetchTickets = useCallback(async () => {
    // Only fetch if a project is selected
    const projectId = localStorage.getItem('crab-current-project');
    if (!projectId) {
      setTickets([]);
      setLoading(false);
      initialLoadDone.current = true;
      return;
    }
    try {
      // Only show loading spinner on initial load, not on background refreshes
      if (!initialLoadDone.current) setLoading(true);
      const data = await api.getTickets(filters);
      setTickets(data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const create = async (data: Partial<Ticket>): Promise<Ticket> => {
    const ticket = await api.createTicket(data);
    setTickets(prev => [...prev, ticket]);
    return ticket;
  };

  const update = async (id: number, data: Partial<Ticket>): Promise<Ticket> => {
    const ticket = await api.updateTicket(id, data);
    setTickets(prev => prev.map(t => t.id === id ? ticket : t));
    return ticket;
  };

  const remove = async (id: number): Promise<void> => {
    await api.deleteTicket(id);
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  const launch = async (id: number): Promise<void> => {
    await api.launchPipeline(id);
  };

  const approve = async (id: number): Promise<void> => {
    await api.approveTicket(id);
    await fetchTickets();
  };

  const reject = async (id: number): Promise<void> => {
    await api.rejectTicket(id);
    await fetchTickets();
  };

  const retry = async (id: number): Promise<void> => {
    await api.retryTicket(id);
    await fetchTickets();
  };

  const rollback = async (id: number): Promise<void> => {
    await api.rollbackTicket(id);
    await fetchTickets();
  };

  const archive = async (id: number): Promise<void> => {
    await api.archiveTicket(id);
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  const unarchive = async (id: number): Promise<void> => {
    await api.unarchiveTicket(id);
  };

  // Full reload with loading state (for project switch)
  const resetAndFetch = useCallback(async () => {
    initialLoadDone.current = false;
    await fetchTickets();
  }, [fetchTickets]);

  // Update a single ticket in state (for socket updates)
  const updateTicketInState = useCallback((ticketId: number, fields: Partial<Ticket>) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, ...fields } : t
    ));
  }, []);

  const reorder = useCallback(async (ticketIds: number[]) => {
    // Optimistic update: reorder backlog tickets in state immediately
    setTickets(prev => {
      const backlog = prev.filter(t => t.status === 'backlog');
      const others = prev.filter(t => t.status !== 'backlog');
      const reordered = ticketIds
        .map(id => backlog.find(t => t.id === id))
        .filter((t): t is Ticket => t !== undefined)
        .map((t, i) => ({ ...t, position: i + 1 }));
      return [...reordered, ...others];
    });

    try {
      await api.reorderTickets(ticketIds);
    } catch (err) {
      console.error('Error reordering tickets:', err);
      fetchTickets();
    }
  }, [fetchTickets]);

  // Insert a ticket locally (no API call) — used by onboarding demo
  const insertLocalTicket = useCallback((ticket: Ticket) => {
    setTickets(prev => [ticket, ...prev]);
  }, []);

  // Remove a ticket locally (no API call) — used by onboarding cleanup
  const removeLocalTicket = useCallback((ticketId: number) => {
    setTickets(prev => prev.filter(t => t.id !== ticketId));
  }, []);

  const clearTickets = useCallback(() => {
    setTickets([]);
  }, []);

  return {
    tickets, loading, filters, setFilters,
    fetchTickets, resetAndFetch, create, update, remove,
    launch, approve, reject, retry, rollback, archive, unarchive,
    updateTicketInState, insertLocalTicket, removeLocalTicket, reorder, clearTickets,
  };
}
