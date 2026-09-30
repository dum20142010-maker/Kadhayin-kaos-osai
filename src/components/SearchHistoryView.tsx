import React, { useState, useEffect } from 'react';
import { SearchHistoryItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { triggerHaptic } from '../lib/haptic';

interface SearchHistoryViewProps {
  onSelectSearch: (query: string) => void;
  currentSearchQuery: string;
  onShowToast: (msg: string, icon?: string) => void;
}

export const SearchHistoryView: React.FC<SearchHistoryViewProps> = ({
  onSelectSearch,
  currentSearchQuery,
  onShowToast,
}) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Default fallback local items for initial experience
  const fallbackItems: SearchHistoryItem[] = [
    { id: 'fh-1', userId: 'default', query: 'Mylapore Heritage', category: 'location', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
    { id: 'fh-2', userId: 'default', query: 'Filter Coffee Lore', category: 'topic', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
    { id: 'fh-3', userId: 'default', query: 'Armenian Belfry', category: 'location', timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString() },
    { id: 'fh-4', userId: 'default', query: 'Art Deco Verandas', category: 'topic', timestamp: new Date(Date.now() - 1000 * 60 * 480).toISOString() },
    { id: 'fh-5', userId: 'default', query: 'Chepauk Byzantine', category: 'location', timestamp: new Date(Date.now() - 1000 * 60 * 720).toISOString() },
  ];

  // Subscribe to real-time Firestore search history for the authenticated user
  useEffect(() => {
    if (!user) {
      // Load local fallback or localStorage
      const local = localStorage.getItem('di_search_history_v1');
      if (local) {
        try {
          setHistory(JSON.parse(local).slice(0, 5));
        } catch {
          setHistory(fallbackItems);
        }
      } else {
        setHistory(fallbackItems);
      }
      setLoading(false);
      return;
    }

    try {
      const historyCol = collection(db, 'users', user.uid, 'searchHistory');
      const q = query(historyCol, orderBy('timestamp', 'desc'), limit(5));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: SearchHistoryItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            items.push({
              id: docSnap.id,
              userId: user.uid,
              query: data.query || '',
              category: data.category || 'keyword',
              timestamp: data.timestamp || new Date().toISOString(),
            });
          });

          // If user has no history yet in Firestore, seed with helpful defaults
          if (items.length === 0) {
            setHistory(fallbackItems);
          } else {
            setHistory(items);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Firestore search history snapshot warning:', error);
          setHistory(fallbackItems);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to listen to search history:', err);
      setHistory(fallbackItems);
      setLoading(false);
    }
  }, [user]);

  // Remove single search item
  const handleDeleteItem = async (item: SearchHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');

    if (user && !item.id.startsWith('fh-')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'searchHistory', item.id));
      } catch (err) {
        console.warn('Error deleting search history doc:', err);
      }
    } else {
      const updated = history.filter((h) => h.id !== item.id);
      setHistory(updated);
      localStorage.setItem('di_search_history_v1', JSON.stringify(updated));
    }

    onShowToast(`Removed "${item.query}" from search history`, 'history_toggle_off');
  };

  // Clear all search history
  const handleClearAll = async () => {
    triggerHaptic('medium');

    if (user) {
      try {
        const historyCol = collection(db, 'users', user.uid, 'searchHistory');
        const snap = await getDocs(historyCol);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      } catch (err) {
        console.warn('Error clearing search history batch:', err);
      }
    }

    setHistory([]);
    localStorage.removeItem('di_search_history_v1');
    onShowToast('Search history cleared', 'delete_sweep');
  };

  if (history.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="bg-[#18181c] rounded-2xl p-3.5 border border-[#26262b] shadow-sm space-y-2.5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-orange-400">history</span>
          <span className="text-xs font-bold text-white tracking-wide">Recent Searches</span>
          <span className="px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-mono font-bold">
            {history.length}/5
          </span>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[11px] text-[#9898a0] hover:text-red-400 transition-colors font-medium flex items-center gap-1 active:scale-95"
            title="Clear all search history"
          >
            <span className="material-symbols-outlined text-[13px]">delete_sweep</span>
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* 5 Chips Container */}
      <div className="flex flex-wrap gap-2 pt-0.5">
        {history.map((item) => {
          const isActive = currentSearchQuery.trim().toLowerCase() === item.query.trim().toLowerCase();
          
          let iconName = 'search';
          if (item.category === 'location') iconName = 'location_on';
          else if (item.category === 'topic') iconName = 'local_cafe';

          return (
            <button
              key={item.id}
              onClick={() => {
                triggerHaptic('light');
                onSelectSearch(item.query);
              }}
              className={`group flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                isActive
                  ? 'bg-orange-600 text-white border-orange-500 shadow-md ring-1 ring-orange-400/40'
                  : 'bg-[#121214] text-[#cfcfd6] hover:text-white hover:bg-[#202026] border-[#2a2a30]'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[14px] ${
                  isActive
                    ? 'text-white'
                    : item.category === 'location'
                    ? 'text-amber-400'
                    : item.category === 'topic'
                    ? 'text-teal-400'
                    : 'text-orange-400'
                }`}
              >
                {iconName}
              </span>
              <span className="truncate max-w-[140px] sm:max-w-[180px]">{item.query}</span>

              {/* Individual delete close button */}
              <span
                onClick={(e) => handleDeleteItem(item, e)}
                className={`ml-1 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  isActive
                    ? 'hover:bg-white/20 text-white/80 hover:text-white'
                    : 'text-[#9898a0] hover:text-red-400 hover:bg-red-500/10'
                }`}
                title={`Remove "${item.query}"`}
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
