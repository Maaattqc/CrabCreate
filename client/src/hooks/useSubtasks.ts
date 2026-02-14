import { useState, useCallback } from 'react';
import type { Subtask } from '../types';
import * as api from '../api/subtasks';

export function useSubtasks(ticketId: number) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSubtasks(ticketId);
      setSubtasks(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [ticketId]);

  const create = useCallback(async (title: string) => {
    const subtask = await api.createSubtask(ticketId, title);
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

  const completed = subtasks.filter(s => s.completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { subtasks, loading, fetch, create, update, toggle, remove, completed, total, progress };
}
