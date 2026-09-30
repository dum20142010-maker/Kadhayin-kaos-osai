import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../lib/haptic';

export const Compass: React.FC = () => {
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // webkitCompassHeading is for iOS
      const currentHeading = (event as any).webkitCompassHeading || (event.alpha ? 360 - event.alpha : null);
      if (currentHeading !== null) {
        setHeading(currentHeading);
      }
    };

    const initOrientation = async () => {
      // Check for iOS 13+ permission request
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
            setHasPermission(true);
          } else {
            setError('Permission denied');
          }
        } catch (e) {
          setError('Permission request failed');
        }
      } else {
        // Standard non-iOS behavior
        window.addEventListener('deviceorientation', handleOrientation);
        setHasPermission(true);
      }
    };

    // We don't automatically request permission on mount to avoid UX issues on iOS
    // (needs a user gesture). Instead, we'll show a button if permission is needed.
    if (!(typeof (DeviceOrientationEvent as any).requestPermission === 'function')) {
      window.addEventListener('deviceorientation', handleOrientation);
      setHasPermission(true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const handleRequestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setHasPermission(true);
          triggerHaptic('medium');
          // Re-attach listener just in case
          window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
            const currentHeading = (event as any).webkitCompassHeading || (event.alpha ? 360 - event.alpha : null);
            if (currentHeading !== null) setHeading(currentHeading);
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="absolute top-20 right-4 z-30 flex flex-col items-center gap-2">
      <div 
        className="w-12 h-12 rounded-full bg-[#1a1a1e]/90 backdrop-blur-md border border-orange-500/40 shadow-2xl flex items-center justify-center relative overflow-hidden group active:scale-95 transition-transform"
        onClick={() => {
          if (!hasPermission) handleRequestPermission();
          triggerHaptic('light');
        }}
      >
        {/* Compass Ring */}
        <div className="absolute inset-0 border-2 border-zinc-800 rounded-full"></div>
        
        {/* Cardinal Directions */}
        <div className="absolute top-1 text-[7px] font-bold text-zinc-500">N</div>
        <div className="absolute bottom-1 text-[7px] font-bold text-zinc-500">S</div>
        <div className="absolute left-1 text-[7px] font-bold text-zinc-500">W</div>
        <div className="absolute right-1 text-[7px] font-bold text-zinc-500">E</div>

        {/* The Needle */}
        <div 
          className="w-0.5 h-8 bg-gradient-to-t from-zinc-700 via-orange-500 to-orange-500 relative transition-transform duration-100 ease-out"
          style={{ transform: `rotate(${heading || 0}deg)` }}
        >
          {/* North Point Indicator */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-glow-orange"></div>
        </div>

        {/* Center Point */}
        <div className="w-1.5 h-1.5 bg-zinc-900 rounded-full border border-zinc-700 z-10"></div>
        
        {!hasPermission && typeof (DeviceOrientationEvent as any).requestPermission === 'function' && (
          <div className="absolute inset-0 bg-orange-600/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px] animate-pulse">lock_open</span>
          </div>
        )}
      </div>

      {heading !== null && (
        <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono font-bold text-orange-400 shadow-lg">
          {Math.round(heading)}°
        </div>
      )}
    </div>
  );
};
