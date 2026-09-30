import React, { useEffect, useState } from 'react';
import { triggerHaptic } from '../lib/haptic';

interface ZomatoNotificationBannerProps {
  onShowToast: (msg: string, icon?: string) => void;
}

const notifications = [
  {
    title: "☕ Hot filter coffee brewing at Mylapore!",
    subtitle: "Mami Mess & Rayar's Cafe are waking up. Check-in now for +80 XP.",
    icon: "local_cafe"
  },
  {
    title: "🔥 Your 3-day walking streak is waiting!",
    subtitle: "Morning breeze at Marina Beach is optimal right now (32°C).",
    icon: "local_fire_department"
  },
  {
    title: "🏛️ Uncharted Secret Gem Discovered!",
    subtitle: "The Mysterious Alchemist’s Well in Triplicane is 12 mins away.",
    icon: "explore"
  },
  {
    title: "🌊 Chennai Evening Stroll Time",
    subtitle: "Catch the sunset at Elliot's Beach or San Thome wave wall.",
    icon: "wb_twilight"
  }
];

export const ZomatoNotificationBanner: React.FC<ZomatoNotificationBannerProps> = ({ onShowToast }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first notification after 4 seconds, then cycle every 14 seconds
    const initialTimer = setTimeout(() => {
      setVisible(true);
      triggerHaptic([40, 60, 40]);
    }, 4000);

    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIdx(prev => (prev + 1) % notifications.length);
        setVisible(true);
        triggerHaptic([40, 60, 40]);
      }, 500);
    }, 16000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  if (!visible) return null;

  const notif = notifications[currentIdx];

  return (
    <div className="fixed top-20 left-4 right-4 z-50 max-w-md mx-auto animate-toast-in">
      <div className="bg-[#1a1a1e]/95 backdrop-blur-xl text-white p-3.5 rounded-2xl shadow-xl border border-orange-500/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {notif.icon}
            </span>
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-orange-400 bg-orange-600/20 px-2 py-0.5 rounded">
                DÌ Live Alert
              </span>
            </div>
            <h4 className="text-sm font-bold text-white truncate mt-0.5">{notif.title}</h4>
            <p className="text-xs text-[#9898a0] truncate">{notif.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              triggerHaptic(50);
              onShowToast('Navigated via Live Alert prompt!', 'navigation');
              setVisible(false);
            }}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold active:scale-95 shadow-sm"
          >
            Explore
          </button>
          <button
            onClick={() => {
              triggerHaptic(30);
              setVisible(false);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9898a0] hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
