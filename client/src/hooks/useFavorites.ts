import { useState, useCallback } from 'react';
import type { FavoriteTicket } from '../types';
import * as api from '../api/favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const toggle = useCallback(async (ticketId: number) => {
    const result = await api.toggleFavorite(ticketId);
    if (!result.favorited) {
      setFavorites(prev => prev.filter(f => f.ticket_id !== ticketId));
    } else {
      const updated = await api.getFavorites();
      setFavorites(updated);
    }
    return result;
  }, []);

  const isFavorite = useCallback((ticketId: number) => {
    return favorites.some(f => f.ticket_id === ticketId);
  }, [favorites]);

  return { favorites, loading, fetch, toggle, isFavorite };
}
