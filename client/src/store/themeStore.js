import { create } from 'zustand';

const saved = localStorage.getItem('wb_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initial = saved || (prefersDark ? 'dark' : 'light');

function apply(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

apply(initial);

export const useThemeStore = create(set => ({
  theme: initial,
  toggle() {
    set(s => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('wb_theme', next);
      // Burst transitions on for 350ms so every element animates smoothly
      document.documentElement.classList.add('theme-transitioning');
      apply(next);
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 350);
      return { theme: next };
    });
  },
}));
