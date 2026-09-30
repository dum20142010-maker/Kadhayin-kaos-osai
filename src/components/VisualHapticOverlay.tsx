import React, { useState, useEffect } from 'react';

export const VisualHapticOverlay: React.FC = () => {
  const [pulseType, setPulseType] = useState<string | null>(null);

  useEffect(() => {
    let timer: any = null;
    const handleVisualHaptic = (e: any) => {
      const pattern = e.detail?.pattern || 'medium';
      setPulseType(pattern);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setPulseType(null);
      }, 300);
    };

    window.addEventListener('kaos-visual-haptic', handleVisualHaptic);
    return () => {
      window.removeEventListener('kaos-visual-haptic', handleVisualHaptic);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!pulseType) return null;

  const isHeavy = pulseType === 'heavy' || pulseType === 'legendary';

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[100] transition-opacity duration-200 ${
        isHeavy
          ? 'shadow-[inset_0_0_24px_rgba(240,84,35,0.45)]'
          : 'shadow-[inset_0_0_12px_rgba(240,84,35,0.25)]'
      }`}
      aria-hidden="true"
    />
  );
};
