import { useState, useEffect, useCallback } from 'react';

interface RecentlyViewedItem {
  id: string;
  title: string;
  storedFilename?: string;
  category?: string;
  viewedAt: number;
}

const STORAGE_KEY = 'vaulty_recently_viewed';
const MAX_ITEMS = 10;

export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentlyViewed(JSON.parse(stored));
      } catch {
        setRecentlyViewed([]);
      }
    }
  }, []);

  const addRecentlyViewed = useCallback((doc: { id: string; title: string; storedFilename?: string; category?: string }) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.id !== doc.id);
      const updated = [
        { ...doc, viewedAt: Date.now() },
        ...filtered
      ].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recentlyViewed, addRecentlyViewed, clearRecentlyViewed };
}