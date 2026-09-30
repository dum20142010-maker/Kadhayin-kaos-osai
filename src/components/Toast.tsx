import React from 'react';

interface ToastProps {
  message: string;
  icon?: string;
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = 'bookmark', visible }) => {
  if (!visible) return null;

  return (
    <div aria-live="polite" className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[90vw] animate-toast-in" role="status">
      <div className="px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface shadow-lg flex items-center gap-2.5 border border-white/10 font-label-md text-label-md">
        <span className="material-symbols-outlined text-primary-fixed text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
        <span className="truncate">{message}</span>
      </div>
    </div>
  );
};
