"use client";

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ira-theme');
    const next = saved === 'dark';
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('ira-theme', next ? 'dark' : 'light');
  };

  return (
    <button type="button" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{dark ? 'Light' : 'Dark'} mode</span>}
    </button>
  );
}
