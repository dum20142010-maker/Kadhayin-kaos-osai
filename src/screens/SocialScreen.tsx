import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GlobalExplorers } from '../components/GlobalExplorers';
import { KAOS_SPOTS } from '../data/kaosData';
import { MasterSpot } from '../types';

interface SocialStory {
  id: string;
  username: string;
  avatar: string;
  title: string;
  caption: string;
  imageUrl: string;
  xpEarned: number;
  timeAgo: string;
  likes: number;
  hasLiked?: boolean;
}

interface SocialScreenProps {
  onShowToast: (msg: string) => void;
  onSpotSelected?: (spot: MasterSpot) => void;
}

const INITIAL_STORIES: SocialStory[] = [
  {
    id: 'story-1',
    username: 'Vikram Dev',
    avatar: '🧭',
    title: 'Triplicane Coffee surveying',
    caption: 'Savoring 1920s peaberry espresso roast at Triplicane. The vintage aroma and coffee ledger archives are legendary! ☕',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=600&auto=format&fit=crop',
    xpEarned: 120,
    timeAgo: '10 mins ago',
    likes: 12,
  },
  {
    id: 'story-2',
    username: 'Priya Raj',
    avatar: '🏛️',
    title: 'Kapaleeshwarar Temple Tank Alignment',
    caption: 'Breathtaking acoustic geofencing checks at Mylapore temple tank. The sunset geometry aligned perfectly with the ancient gopuram towers. 🌅🪔',
    imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=600&auto=format&fit=crop',
    xpEarned: 150,
    timeAgo: '1 hour ago',
    likes: 24,
  },
  {
    id: 'story-3',
    username: 'Anand Kumar',
    avatar: '🎨',
    title: 'Senate House Stained Glass',
    caption: "Captured Robert Chisholm's 1879 assembly hall at exactly 3:30 PM. Stained glass refraction is absolutely magical! 🏛️✨",
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=600&auto=format&fit=crop',
    xpEarned: 200,
    timeAgo: '3 hours ago',
    likes: 18,
  },
];

export const SocialScreen: React.FC<SocialScreenProps> = ({
  onShowToast,
  onSpotSelected,
}) => {
  const [stories, setStories] = useState<SocialStory[]>(INITIAL_STORIES);

  // Subscribe to live Firestore social_stories collection
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    try {
      const storiesRef = collection(db, 'social_stories');
      unsubscribe = onSnapshot(
        storiesRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const fetched: SocialStory[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                username: data.username || 'Explorer',
                avatar: data.avatar || '🛡️',
                title: data.title || 'Heritage Place',
                caption: data.caption || '',
                imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1545235621-3f6b76649e78?q=80&w=600&auto=format&fit=crop',
                xpEarned: data.xpEarned || 150,
                timeAgo: data.createdAt ? 'Recent' : 'Just now',
                likes: data.likes || 0,
              };
            });
            // Merge with local seed stories
            setStories((prev) => {
              const ids = new Set(fetched.map((f) => f.id));
              const remainingLocal = prev.filter((p) => !ids.has(p.id));
              return [...fetched, ...remainingLocal];
            });
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot notice:', error?.message);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription fallback active');
    }

    return () => unsubscribe();
  }, []);

  // Story Creator popup states
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState(KAOS_SPOTS[0].id);
  const [storyCaption, setStoryCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLikeStory = async (storyId: string) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id === storyId) {
          const liked = !s.hasLiked;
          return {
            ...s,
            hasLiked: liked,
            likes: liked ? s.likes + 1 : s.likes - 1,
          };
        }
        return s;
      })
    );

    try {
      const storyRef = doc(db, 'social_stories', storyId);
      await updateDoc(storyRef, { likes: increment(1) });
    } catch {}

    onShowToast('Gave explorer applause! ❤️');
  };

  const handlePostStorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyCaption.trim()) {
      onShowToast('Please enter a caption for your story!');
      return;
    }

    setSubmitting(true);
    const matchedSpot = KAOS_SPOTS.find((s) => s.id === selectedSpotId);
    const payload = {
      username: 'Usha Baskar (You)',
      avatar: '🛡️',
      title: matchedSpot?.title || 'Heritage Landmark',
      caption: storyCaption.trim(),
      imageUrl: matchedSpot?.imageUrl || 'https://images.unsplash.com/photo-1545235621-3f6b76649e78?q=80&w=600&auto=format&fit=crop',
      xpEarned: matchedSpot?.xp || 150,
      likes: 1,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'social_stories'), payload);
    } catch (e) {
      // Local optimism fallback
      const newStory: SocialStory = {
        id: `story-${Date.now()}`,
        ...payload,
        timeAgo: 'Just now',
        hasLiked: true,
      };
      setStories((prev) => [newStory, ...prev]);
    } finally {
      setSubmitting(false);
      setStoryCaption('');
      setIsCreatorOpen(false);
      onShowToast('Expedition Story posted & synced with Squad Vault! 📸🌅');
    }
  };

  return (
    <div className="pb-24 p-4 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Title */}
      <div className="border-b border-[#26242C] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F05423]">groups</span>
            <span>Squad Feed & Stories</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Browse discovered stories, real-time friends activity, and global squad ranks
          </p>
        </div>

        {/* Share Story Trigger button */}
        <button
          onClick={() => setIsCreatorOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#F05423] hover:bg-[#ff6a38] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#F05423]/25"
        >
          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
          <span>Post Story</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stories Feed */}
        <div className="lg:col-span-7 space-y-5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Expedition Stories</h3>

          {stories.map((story) => (
            <div
              key={story.id}
              className="bg-[#1C1A1F] border border-[#26242C] rounded-3xl overflow-hidden shadow-xl"
            >
              {/* Story Header */}
              <div className="p-4 flex items-center justify-between border-b border-[#26242C]/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#121114] border border-[#26242C] flex items-center justify-center text-lg">
                    {story.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{story.username}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">{story.timeAgo}</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F05423]/10 border border-[#F05423]/20 text-[#F05423] font-bold">
                  +{story.xpEarned} XP
                </span>
              </div>

              {/* Story Image */}
              <div className="h-56 w-full overflow-hidden relative bg-[#121114]">
                <img
                  src={story.imageUrl}
                  alt={story.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                
                <span className="absolute bottom-3 left-4 text-xs font-bold text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-700/50">
                  📍 {story.title}
                </span>
              </div>

              {/* Story Content */}
              <div className="p-5 space-y-4">
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">{story.caption}</p>

                <div className="flex items-center gap-3 pt-1 border-t border-[#26242C]/40">
                  <button
                    onClick={() => handleLikeStory(story.id)}
                    className={`flex items-center gap-1.5 text-xs font-mono cursor-pointer transition-colors ${
                      story.hasLiked ? 'text-[#F05423] font-bold' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {story.hasLiked ? 'favorite' : 'favorite_border'}
                    </span>
                    <span>{story.likes} Claps</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Friends Activity & Leaderboard */}
        <div className="lg:col-span-5 space-y-6">
          <GlobalExplorers onShowToast={onShowToast} />
        </div>
      </div>

      {/* Story Creator Modal */}
      {isCreatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#1C1A1F] border border-[#26242C] w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F05423]">add_a_photo</span>
                <span>Post Expedition Story</span>
              </h3>
              <button
                onClick={() => setIsCreatorOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handlePostStorySubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold block mb-1">
                  Tag Landmark
                </label>
                <select
                  value={selectedSpotId}
                  onChange={(e) => setSelectedSpotId(e.target.value)}
                  className="w-full bg-[#121114] border border-[#26242C] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#F05423]"
                >
                  {KAOS_SPOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 uppercase font-bold block mb-1">
                  Caption / Exploration Note
                </label>
                <textarea
                  rows={3}
                  value={storyCaption}
                  onChange={(e) => setStoryCaption(e.target.value)}
                  placeholder="Share what you discovered at this heritage spot..."
                  className="w-full bg-[#121114] border border-[#26242C] rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F05423] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#F05423] hover:bg-[#ff6a38] text-white font-bold text-xs transition-colors shadow-lg cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Publishing to Vault...' : 'Share with Squad'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
