import React from 'react';

interface MoodMorphOverlayProps {
  activeMood: string;
}

interface MoodThemeConfig {
  id: string;
  name: string;
  primaryGradient: string;
  orb1Color: string;
  orb2Color: string;
  orb3Color: string;
  accentBorderGlow: string;
  gridOverlay?: boolean;
}

const MOOD_THEMES: Record<string, MoodThemeConfig> = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Neo-Madras',
    primaryGradient: 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.32) 0%, rgba(126, 34, 206, 0.16) 35%, rgba(15, 10, 24, 0.98) 75%, #0d0914 100%)',
    orb1Color: 'rgba(168, 85, 247, 0.28)',
    orb2Color: 'rgba(236, 72, 153, 0.22)',
    orb3Color: 'rgba(99, 102, 241, 0.20)',
    accentBorderGlow: 'rgba(168, 85, 247, 0.4)',
    gridOverlay: true,
  },
  heritage: {
    id: 'heritage',
    name: 'Heritage Dravidian Gold',
    primaryGradient: 'radial-gradient(ellipse at 50% 0%, rgba(249, 115, 22, 0.28) 0%, rgba(217, 119, 6, 0.15) 38%, rgba(22, 15, 10, 0.98) 75%, #100d0a 100%)',
    orb1Color: 'rgba(249, 115, 22, 0.26)',
    orb2Color: 'rgba(234, 179, 8, 0.22)',
    orb3Color: 'rgba(180, 83, 9, 0.20)',
    accentBorderGlow: 'rgba(249, 115, 22, 0.4)',
  },
  coastal: {
    id: 'coastal',
    name: 'Coromandel Coastal Breeze',
    primaryGradient: 'radial-gradient(ellipse at 50% 0%, rgba(14, 165, 233, 0.28) 0%, rgba(20, 184, 166, 0.14) 38%, rgba(10, 18, 25, 0.98) 75%, #091017 100%)',
    orb1Color: 'rgba(14, 165, 233, 0.26)',
    orb2Color: 'rgba(20, 184, 166, 0.22)',
    orb3Color: 'rgba(6, 182, 212, 0.18)',
    accentBorderGlow: 'rgba(14, 165, 233, 0.4)',
  },
  coffee: {
    id: 'coffee',
    name: 'Mylapore Roast & Filter',
    primaryGradient: 'radial-gradient(ellipse at 50% 0%, rgba(217, 119, 6, 0.28) 0%, rgba(180, 83, 9, 0.15) 38%, rgba(24, 16, 10, 0.98) 75%, #120d07 100%)',
    orb1Color: 'rgba(217, 119, 6, 0.26)',
    orb2Color: 'rgba(245, 158, 11, 0.20)',
    orb3Color: 'rgba(146, 64, 14, 0.22)',
    accentBorderGlow: 'rgba(217, 119, 6, 0.4)',
  },
  balanced: {
    id: 'balanced',
    name: 'Obsidian Pulse',
    primaryGradient: 'radial-gradient(ellipse at 50% 0%, rgba(240, 84, 35, 0.18) 0%, rgba(249, 115, 22, 0.08) 35%, rgba(18, 17, 20, 0.98) 75%, #121114 100%)',
    orb1Color: 'rgba(240, 84, 35, 0.16)',
    orb2Color: 'rgba(249, 115, 22, 0.12)',
    orb3Color: 'rgba(120, 113, 108, 0.10)',
    accentBorderGlow: 'rgba(240, 84, 35, 0.3)',
  },
};

export const MoodMorphOverlay: React.FC<MoodMorphOverlayProps> = ({ activeMood }) => {
  const normalizedMood = MOOD_THEMES[activeMood] ? activeMood : 'balanced';

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
      {/* Base Solid Background */}
      <div className="absolute inset-0 bg-[#121114]" />

      {/* Layered Cross-Fading Mood Gradients */}
      {Object.entries(MOOD_THEMES).map(([moodKey, theme]) => {
        const isActive = normalizedMood === moodKey;
        return (
          <div
            key={moodKey}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out will-change-[opacity] ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: theme.primaryGradient }}
          >
            {/* Ambient Floating Orbs for organic depth */}
            <div
              className="absolute -top-24 left-1/4 w-96 h-96 rounded-full blur-3xl transition-transform duration-1000 animate-pulse"
              style={{
                backgroundColor: theme.orb1Color,
                animationDuration: '6s',
              }}
            />
            <div
              className="absolute top-1/3 -right-20 w-80 h-80 rounded-full blur-3xl transition-transform duration-1000"
              style={{
                backgroundColor: theme.orb2Color,
              }}
            />
            <div
              className="absolute -bottom-20 left-1/3 w-[28rem] h-[28rem] rounded-full blur-3xl transition-transform duration-1000"
              style={{
                backgroundColor: theme.orb3Color,
              }}
            />

            {/* Cyber Scanline Grid Overlay */}
            {theme.gridOverlay && (
              <div
                className="absolute inset-0 opacity-[0.035] pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(168, 85, 247, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.3) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />
            )}
          </div>
        );
      })}

      {/* Top Ambient Aura Beam */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-1000 ease-out"
        style={{
          background: `linear-gradient(90deg, transparent, ${MOOD_THEMES[normalizedMood].accentBorderGlow}, transparent)`,
          boxShadow: `0 0 20px 2px ${MOOD_THEMES[normalizedMood].accentBorderGlow}`,
        }}
      />
    </div>
  );
};
