import React from 'react';

interface KaosLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  taglinePosition?: 'top' | 'bottom';
  interactive?: boolean;
}

export const KaosLogo: React.FC<KaosLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
  taglinePosition = 'top',
  interactive = false,
}) => {
  // Size calculations
  const sizeMap = {
    sm: { wordmarkHeight: 'h-5', taglineText: 'text-[9px]', gap: 'gap-0.5' },
    md: { wordmarkHeight: 'h-7', taglineText: 'text-[11px]', gap: 'gap-1' },
    lg: { wordmarkHeight: 'h-10', taglineText: 'text-[13px]', gap: 'gap-1.5' },
    xl: { wordmarkHeight: 'h-14', taglineText: 'text-[16px]', gap: 'gap-2' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex flex-col select-none ${currentSize.gap} ${interactive ? 'hover:opacity-95 transition-opacity' : ''} ${className}`}>
      {showTagline && taglinePosition === 'top' && (
        <span className={`font-bold tracking-tight text-[#F05423] ${currentSize.taglineText} leading-none`}>
          Every place has a story.
        </span>
      )}

      {/* KAOS Wordmark with Aperture Shutter 'A' */}
      <div className={`flex items-center ${currentSize.wordmarkHeight} tracking-normal text-[#F05423]`}>
        <svg
          viewBox="0 0 520 140"
          className="h-full w-auto overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Letter K */}
          <path d="M 10 10 H 46 V 60 L 90 10 H 136 L 76 68 L 140 126 H 92 L 46 78 V 126 H 10 Z" fill="#F05423" />

          {/* Letter A (Stylized Camera Aperture Shutter) */}
          <g transform="translate(148, 10)">
            <path d="M 40 0 L 72 0 L 48 42 L 18 32 Z" fill="#F05423" />
            <path d="M 72 0 L 104 0 L 96 38 L 62 26 Z" fill="#F05423" />
            <path d="M 104 0 L 118 42 L 82 58 L 96 38 Z" fill="#F05423" />
            <path d="M 118 42 L 126 116 L 82 116 L 76 80 L 82 58 Z" fill="#F05423" />
            <path d="M 82 116 L 44 116 L 52 76 L 76 80 Z" fill="#F05423" />
            <path d="M 44 116 L 0 116 L 18 32 L 48 42 L 32 78 Z" fill="#F05423" />
            <path d="M 48 42 L 62 26 L 82 58 L 52 76 Z" fill="#F05423" opacity="0.9" />
            <path d="M 32 78 L 52 76 L 44 116 Z" fill="#F05423" opacity="0.95" />
            <path d="M 62 26 L 96 38 L 82 58 Z" fill="#F05423" />
          </g>

          {/* Letter O */}
          <path d="M 320 68 C 320 34 344 10 380 10 C 416 10 440 34 440 68 C 440 102 416 126 380 126 C 344 126 320 102 320 68 Z M 404 68 C 404 48 394 38 380 38 C 366 38 356 48 356 68 C 356 88 366 98 380 98 C 394 98 404 88 404 68 Z" fill="#F05423" />

          {/* Letter S */}
          <path d="M 460 102 C 466 110 478 116 490 116 C 502 116 510 110 510 102 C 510 92 500 88 482 82 C 462 76 452 66 452 48 C 452 26 472 10 498 10 C 518 10 534 20 540 36 L 512 48 C 508 40 502 36 494 36 C 486 36 480 40 480 46 C 480 54 488 58 504 62 C 526 68 538 78 538 98 C 538 118 518 132 490 132 C 466 132 448 118 442 102 Z" fill="#F05423" />
        </svg>
      </div>

      {showTagline && taglinePosition === 'bottom' && (
        <span className={`font-bold tracking-tight text-[#F05423] ${currentSize.taglineText} leading-none`}>
          Every place has a story.
        </span>
      )}
    </div>
  );
};
