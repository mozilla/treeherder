import { useEffect, useState } from 'react';

import { THEME_KEY } from './constants';

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
    }
    setTheme(next);
  };

  return { theme, toggle };
};
