import { useEffect, useState } from 'react';

// Light is Treeherder's look and the default; dark is a choice, remembered
// in this browser.
const THEME_KEY = 'pushViewTheme';

const stored = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const useTheme = () => {
  const [theme, setTheme] = useState(stored);

  useEffect(() => {
    document.body.classList.toggle('pv-dark', theme === 'dark');
    return () => document.body.classList.remove('pv-dark');
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Unsaved, it still switches for this visit.
    }
    setTheme(next);
  };

  return { theme, toggle };
};
