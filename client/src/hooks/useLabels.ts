import { useState, useCallback } from 'react';
import type { Label } from '../types';
import * as api from '../api/labels';

export function useLabels() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getLabels();
      setLabels(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const create = useCallback(async (data: { name: string; color: string }) => {
    const label = await api.createLabel(data);
    setLabels(prev => [...prev, label]);
    return label;
  }, []);

  const update = useCallback(async (id: number, data: Partial<Label>) => {
    const updated = await api.updateLabel(id, data);
    setLabels(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  }, []);

  const remove = useCallback(async (id: number) => {
    await api.deleteLabel(id);
    setLabels(prev => prev.filter(l => l.id !== id));
  }, []);

  return { labels, loading, fetch, create, update, remove };
}
