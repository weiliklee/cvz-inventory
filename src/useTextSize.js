import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cvz-text-size';
const STEPS = ['small', 'normal', 'large', 'xlarge'];
const SCALE_PERCENT = { small: 90, normal: 100, large: 110, xlarge: 120 };

function readStoredSize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return STEPS.includes(stored) ? stored : 'normal';
  } catch {
    return 'normal';
  }
}

// Scales the root <html> font-size (percent), which cascades to every
// rem-based Tailwind class in the app — real typography scaling with
// natural reflow, not a visual zoom/transform.
export function useTextSize() {
  const [size, setSize] = useState(readStoredSize);

  useEffect(() => {
    document.documentElement.style.fontSize = `${SCALE_PERCENT[size]}%`;
    try { localStorage.setItem(STORAGE_KEY, size); } catch { /* storage unavailable, ignore */ }
  }, [size]);

  const step = useCallback((delta) => {
    setSize(prev => {
      const idx = STEPS.indexOf(prev);
      return STEPS[Math.min(STEPS.length - 1, Math.max(0, idx + delta))];
    });
  }, []);

  return {
    size,
    decrease: () => step(-1),
    increase: () => step(1),
    reset: () => setSize('normal'),
    canDecrease: size !== STEPS[0],
    canIncrease: size !== STEPS[STEPS.length - 1],
  };
}
