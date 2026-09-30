import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { triggerHaptic } from '../lib/haptic';

interface JournalScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
}

interface JournalEntry {
  id: string;
  questTitle: string;
  notes: string;
  photoUrl: string;
  timestamp: string;
}

export const JournalScreen: React.FC<JournalScreenProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [questTitle, setQuestTitle] = useState('George Town Heritage Walk');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchEntries = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, `users/${user.uid}/journalEntries`));
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as JournalEntry[];
        setEntries(docs);
      } catch (err) {
        console.error("Error fetching journal entries:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [user]);

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      setPhotoUrl(dataUrl);
      triggerHaptic('medium');
      onShowToast('Photo attached to Journal entry! 📸', 'photo_camera');
    };
    reader.readAsDataURL(file);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onShowToast('Please sign in first', 'login');
      return;
    }
    if (!notes.trim()) return;

    setAdding(true);
    triggerHaptic('medium');

    const newEntry = {
      questTitle,
      notes,
      photoUrl: photoUrl || 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
      timestamp: new Date().toLocaleString()
    };

    try {
      const docRef = await addDoc(collection(db, `users/${user.uid}/journalEntries`), newEntry);
      setEntries(prev => [{ id: docRef.id, ...newEntry }, ...prev]);
      setNotes('');
      setPhotoUrl('');
      onShowToast('Field Journal entry saved to Firestore!', 'bookmark_added');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/journalEntries`);
      // Fallback local addition if rules restricted
      setEntries(prev => [{ id: Date.now().toString(), ...newEntry }, ...prev]);
      setNotes('');
      setPhotoUrl('');
      onShowToast('Field Journal entry added!', 'bookmark_added');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-24 max-w-4xl mx-auto px-4 space-y-6">
      {/* Hidden File Inputs for Camera and Photos */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoFileChange}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileChange}
      />

      {/* Header */}
      <div className="pt-4 pb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="material-symbols-outlined text-[16px] text-orange-400" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
          <span className="text-xs text-orange-400 uppercase tracking-widest font-bold">Cloud Field Journal</span>
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-headline text-3xl text-white">Discovery Records</h1>
          <span className="text-xs text-teal-400 font-semibold">{entries.length} Captured Entries</span>
        </div>
      </div>

      {/* Add New Entry Form */}
      <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-[#26262b] shadow-sm space-y-4">
        <h2 className="font-headline text-lg text-white font-bold">Record Discovery Note & Photo Evidence</h2>
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#9898a0] uppercase mb-1">Quest / Location</label>
            <input
              type="text"
              value={questTitle}
              onChange={(e) => setQuestTitle(e.target.value)}
              required
              className="w-full bg-[#121214] text-white p-3 rounded-xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9898a0] uppercase mb-1">Field Notes & Observations</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe architectural details, inscriptions, or historical notes..."
              rows={3}
              required
              className="w-full bg-[#121214] text-white p-3 rounded-xl border border-[#26262b] text-sm focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          {/* Photo Evidence Section with Camera & Gallery Access */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#9898a0] uppercase">Photo Evidence (Camera / Gallery)</label>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  cameraInputRef.current?.click();
                }}
                className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>Take Live Photo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  galleryInputRef.current?.click();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#26262b] hover:bg-[#32323a] text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 border border-zinc-700/60 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">photo_library</span>
                <span>Choose from Photos</span>
              </button>
            </div>

            {/* Photo Preview if attached */}
            {photoUrl && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-orange-500/40 max-h-48 group">
                <img src={photoUrl} alt="Attached Evidence" className="w-full h-44 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl('');
                    triggerHaptic('light');
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow cursor-pointer"
                  title="Remove Photo"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                  Evidence Photo Attached
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={adding}
            className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {adding ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                <span>Save to Cloud Journal</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Entries List */}
      <div className="space-y-4">
        <h3 className="font-headline text-lg text-white font-bold">Your Field Notes</h3>
        {loading ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined animate-spin text-orange-400 text-3xl">progress_activity</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-[#1a1a1e] rounded-2xl p-8 border border-[#26262b] text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-[#9898a0]">menu_book</span>
            <h4 className="font-headline text-base text-white">No journal entries yet</h4>
            <p className="text-xs text-[#9898a0]">Complete a quest or record your first observation above to populate your field journal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map(entry => (
              <div key={entry.id} className="bg-[#1a1a1e] rounded-2xl p-5 border border-[#26262b] shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline text-sm text-white font-bold">{entry.questTitle}</h4>
                  <span className="text-[10px] text-[#9898a0]">{entry.timestamp}</span>
                </div>
                {entry.photoUrl && (
                  <img src={entry.photoUrl} alt={entry.questTitle} className="w-full h-40 object-cover rounded-xl border border-[#26262b]" />
                )}
                <p className="text-xs text-[#9898a0] leading-relaxed">{entry.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
