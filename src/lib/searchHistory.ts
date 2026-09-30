import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { SearchHistoryItem } from '../types';

export const saveUserSearch = async (
  userId: string | undefined,
  queryText: string,
  category: 'location' | 'topic' | 'keyword' = 'keyword'
) => {
  const cleanQuery = queryText.trim();
  if (!cleanQuery || cleanQuery.length < 2) return;

  if (userId) {
    try {
      const historyCol = collection(db, 'users', userId, 'searchHistory');
      const docId = `search_${cleanQuery.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const docRef = doc(db, 'users', userId, 'searchHistory', docId);

      await setDoc(
        docRef,
        {
          id: docId,
          userId,
          query: cleanQuery,
          category,
          timestamp: new Date().toISOString(),
        },
        { merge: true }
      );

      // Keep only last 5 items
      const snap = await getDocs(query(historyCol, orderBy('timestamp', 'desc')));
      if (snap.size > 5) {
        const docsToDelete = snap.docs.slice(5);
        for (const d of docsToDelete) {
          await deleteDoc(d.ref);
        }
      }
    } catch (err) {
      console.warn('Firestore search history save deferred:', err);
    }
  } else {
    try {
      const local = localStorage.getItem('di_search_history_v1');
      let list: SearchHistoryItem[] = local ? JSON.parse(local) : [];
      list = list.filter((item) => item.query.toLowerCase() !== cleanQuery.toLowerCase());
      list.unshift({
        id: `local_${Date.now()}`,
        userId: 'local',
        query: cleanQuery,
        category,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('di_search_history_v1', JSON.stringify(list.slice(0, 5)));
    } catch (e) {
      console.warn('Local search history save warning:', e);
    }
  }
};
