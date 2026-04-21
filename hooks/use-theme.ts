'use client';

import { useEffect,useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check for system preference on initial load
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('theme') as Theme | null;
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
