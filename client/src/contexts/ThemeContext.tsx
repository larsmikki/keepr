import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export interface ThemeDefinition {
  name: string;
  mode: 'light' | 'dark';
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  accent: string;
  gradient: string;
  previewColors: string[];
}

export const THEMES: ThemeDefinition[] = [
  {
    name: 'Default',
    mode: 'light',
    bg: '#f9fafb', surface: '#ffffff', surface2: '#f1f3f5', border: 'rgba(0,0,0,0.09)',
    text: '#1c1c1c', text2: '#666666', accent: '#0d9488',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
    previewColors: ['#f1f3f5', '#d1d5db', '#0d9488'],
  },
  {
    name: 'Dark',
    mode: 'dark',
    bg: '#0a0a0f', surface: '#111118', surface2: '#1a1a28', border: 'rgba(13,148,136,0.18)',
    text: '#f0f0ff', text2: '#8884a8', accent: '#0d9488',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
    previewColors: ['#1a1a28', '#163f42', '#0d9488'],
  },
  {
    name: 'Midnight',
    mode: 'dark',
    bg: '#050814', surface: '#0d1117', surface2: '#161b22', border: 'rgba(6,182,212,0.15)',
    text: '#e2f8ff', text2: '#7d8ea0', accent: '#06b6d4',
    gradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
    previewColors: ['#161b22', '#0d2a35', '#06b6d4'],
  },
  {
    name: 'Rainbow',
    mode: 'light',
    bg: '#f5f0ff', surface: '#ffffff', surface2: '#ede9fe', border: '#ddd6fe',
    text: '#1a1a2e', text2: '#6b5fa0', accent: '#a855f7',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)',
    previewColors: ['#fce7f3', '#ede9fe', '#dbeafe'],
  },
  {
    name: 'Ocean',
    mode: 'light',
    bg: '#f0f9ff', surface: '#ffffff', surface2: '#e0f2fe', border: '#bae6fd',
    text: '#0c1e3a', text2: '#4a6d8c', accent: '#0284c7',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #06b6d4 100%)',
    previewColors: ['#dbeafe', '#e0f7fa', '#bae6fd'],
  },
  {
    name: 'Forest',
    mode: 'light',
    bg: '#f0fdf4', surface: '#ffffff', surface2: '#dcfce7', border: '#bbf7d0',
    text: '#052e16', text2: '#4a7c59', accent: '#16a34a',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
    previewColors: ['#dcfce7', '#d1fae5', '#a7f3d0'],
  },
  {
    name: 'Sunset',
    mode: 'light',
    bg: '#fffbf0', surface: '#ffffff', surface2: '#fef3c7', border: '#fde68a',
    text: '#1c1009', text2: '#92400e', accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    previewColors: ['#fef3c7', '#fce7f3', '#fde68a'],
  },
  {
    name: 'Lavender',
    mode: 'light',
    bg: '#faf5ff', surface: '#ffffff', surface2: '#f3e8ff', border: '#e9d5ff',
    text: '#1a0a2e', text2: '#7e5aa2', accent: '#9333ea',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
    previewColors: ['#f3e8ff', '#fce7f3', '#e9d5ff'],
  },
  {
    name: 'Nord',
    mode: 'light',
    bg: '#eceff4', surface: '#ffffff', surface2: '#e5e9f0', border: '#d8dee9',
    text: '#2e3440', text2: '#4c566a', accent: '#5e81ac',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    previewColors: ['#e5e9f0', '#d8dee9', '#5e81ac'],
  },
  {
    name: 'Mono',
    mode: 'light',
    bg: '#f8f9fa', surface: '#ffffff', surface2: '#f1f3f5', border: '#dee2e6',
    text: '#212529', text2: '#6c757d', accent: '#343a40',
    gradient: 'linear-gradient(135deg, #6b7280 0%, #374151 100%)',
    previewColors: ['#f1f3f5', '#e9ecef', '#dee2e6'],
  },
];

export type Theme = ThemeDefinition;

interface ThemeContextValue {
  theme: ThemeDefinition;
  themeName: string;
  isAuto: boolean;
  setTheme: (theme: ThemeDefinition) => void;
  setThemeByName: (name: string) => void;
  setAuto: (auto: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme.mode === 'dark');
  root.style.setProperty('--theme-bg', theme.bg);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-surface2', theme.surface2);
  root.style.setProperty('--theme-border', theme.border);
  root.style.setProperty('--theme-text', theme.text);
  root.style.setProperty('--theme-text2', theme.text2);
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-gradient', theme.gradient);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.surface);
}

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function pickThemeForMode(mode: 'dark' | 'light'): ThemeDefinition {
  return mode === 'dark'
    ? THEMES.find(t => t.name === 'Dark')!
    : THEMES.find(t => t.name === 'Default')!;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isAuto, setIsAutoState] = useState(() => localStorage.getItem('theme_auto') === 'true');
  const [themeName, setThemeName] = useState(() => {
    if (localStorage.getItem('theme_auto') === 'true') {
      return pickThemeForMode(getSystemTheme()).name;
    }
    return localStorage.getItem('theme_name') || 'Default';
  });

  const theme = THEMES.find(t => t.name === themeName) || THEMES[0];

  // Listen for system preference changes when in Auto mode
  const handleSystemChange = useCallback((e: MediaQueryListEvent) => {
    if (localStorage.getItem('theme_auto') === 'true') {
      setThemeName(pickThemeForMode(e.matches ? 'dark' : 'light').name);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', handleSystemChange);
    return () => mq.removeEventListener('change', handleSystemChange);
  }, [handleSystemChange]);

  useEffect(() => {
    applyTheme(theme);
    if (!isAuto) localStorage.setItem('theme_name', theme.name);
  }, [theme, isAuto]);

  const setAuto = (auto: boolean) => {
    setIsAutoState(auto);
    localStorage.setItem('theme_auto', String(auto));
    if (auto) {
      const t = pickThemeForMode(getSystemTheme());
      setThemeName(t.name);
    }
  };

  const setTheme = (t: ThemeDefinition) => { setIsAutoState(false); localStorage.setItem('theme_auto', 'false'); setThemeName(t.name); };
  const setThemeByName = (name: string) => { setIsAutoState(false); localStorage.setItem('theme_auto', 'false'); setThemeName(name); };
  const toggleTheme = () => setTheme(theme.mode === 'dark' ? THEMES[0] : THEMES[1]);

  return (
    <ThemeContext.Provider value={{ theme, themeName, isAuto, setTheme, setThemeByName, setAuto, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
