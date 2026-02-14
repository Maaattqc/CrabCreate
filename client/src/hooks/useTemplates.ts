import { useState, useCallback } from 'react';
import type { TicketTemplate } from '../types';
import * as api from '../api/templates';

export function useTemplates() {
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const create = useCallback(async (data: Partial<TicketTemplate>) => {
    const template = await api.createTemplate(data);
    setTemplates(prev => [...prev, template]);
    return template;
  }, []);

  const update = useCallback(async (id: number, data: Partial<TicketTemplate>) => {
    const updated = await api.updateTemplate(id, data);
    setTemplates(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  }, []);

  const remove = useCallback(async (id: number) => {
    await api.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  return { templates, loading, fetch, create, update, remove };
}
