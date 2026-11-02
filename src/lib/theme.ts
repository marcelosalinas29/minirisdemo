export type Theme = 'light' | 'dark';
const KEY = 'theme';

export function getStoredTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem(KEY, theme); } catch { /* sin almacenamiento: se aplica igual */ }
}
