import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';

/** Botón claro / oscuro: se recuerda en este dispositivo. */
const ThemeToggle = () => {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : getStoredTheme()));
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return (
    <button
      onClick={toggle}
      className="p-1.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label="Cambiar entre modo claro y oscuro"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};

export default ThemeToggle;
