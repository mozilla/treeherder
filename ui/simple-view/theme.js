import { useEffect, useState } from 'react';

// Light is Treeherder's look and the default; dark is a choice, remembered
// in this browser.
const THEME_KEY = 'simpleViewTheme';

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
    const root = document.documentElement;
    root.setAttribute('data-bs-theme', theme);
    return () => root.removeAttribute('data-bs-theme');
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
