export const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy' | 'legendary' | number | number[] = 40) => {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    const intensity = localStorage.getItem('kaos_haptic_intensity') || 'Medium';
    let scale = 1.0;
    if (intensity === 'Low') scale = 0.5;
    else if (intensity === 'High') scale = 1.4;

    if (pattern === 'light') navigator.vibrate(Math.round(25 * scale));
    else if (pattern === 'medium') navigator.vibrate(Math.round(50 * scale));
    else if (pattern === 'heavy') navigator.vibrate(Math.round(80 * scale));
    else if (pattern === 'legendary') {
      const scaledPattern = [40, 60, 40, 60, 100].map(n => Math.round(n * scale));
      navigator.vibrate(scaledPattern);
    } else if (Array.isArray(pattern)) {
      navigator.vibrate(pattern.map(n => Math.round(n * scale)));
    } else if (typeof pattern === 'number') {
      navigator.vibrate(Math.round(pattern * scale));
    } else {
      navigator.vibrate(Math.round(40 * scale));
    }
  } catch {
    // Ignore vibration errors if blocked by browser policy
  }
};
