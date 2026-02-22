import { useState, useCallback, useEffect, useRef } from 'react';
import type { Subtask } from '../types';
import * as api from '../api/subtasks';
import { useSocket } from './useSocket';

export function useSubtasks(ticketId: number) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [codingSubtaskId, setCodingSubtaskId] = useState<number | null>(null);
  const { on, off } = useSocket();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSubtasks(ticketId);
      if (mountedRef.current) setSubtasks(data);
    } catch { /* ignore */ }
    if (mountedRef.current) setLoading(false);
  }, [ticketId]);

  const create = useCallback(async (title: string, description?: string) => {
    const subtask = await api.createSubtask(ticketId, title, description);
    setSubtasks(prev => [...prev, subtask]);
    return subtask;
  }, [ticketId]);

  const update = useCallback(async (subtaskId: number, data: Partial<Subtask>) => {
    const updated = await api.updateSubtask(ticketId, subtaskId, data);
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? updated : s));
    return updated;
  }, [ticketId]);

  const toggle = useCallback(async (subtaskId: number) => {
    const current = subtasks.find(s => s.id === subtaskId);
    if (!current) return;
    const updated = await api.updateSubtask(ticketId, subtaskId, { completed: current.completed ? 0 : 1 });
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? updated : s));
  }, [ticketId, subtasks]);

  const remove = useCallback(async (subtaskId: number) => {
    await api.deleteSubtask(ticketId, subtaskId);
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
  }, [ticketId]);

  // Listen for subtask progress events from the pipeline
  useEffect(() => {
    on('subtask:progress', (data: { ticketId: number; subtaskId: number; status: 'coding' | 'completed' }) => {
      if (data.ticketId !== ticketId) return;
      if (data.status === 'coding') {
        setCodingSubtaskId(data.subtaskId);
      } else if (data.status === 'completed') {
        setCodingSubtaskId(prev => prev === data.subtaskId ? null : prev);
        setSubtasks(prev => prev.map(s => s.id === data.subtaskId ? { ...s, completed: 1 } : s));
      }
    });

    on('ticket:updated', (data: { ticketId: number; subtasks_updated?: boolean }) => {
      if (data.ticketId !== ticketId || !data.subtasks_updated) return;
      // Re-fetch subtasks when the pipeline creates/updates them
      fetch();
    });

    return () => {
      off('subtask:progress');
      off('ticket:updated');
    };
  }, [ticketId, on, off, fetch]);

  const completed = subtasks.filter(s => s.completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { subtasks, loading, fetch, create, update, toggle, remove, completed, total, progress, codingSubtaskId };
}
