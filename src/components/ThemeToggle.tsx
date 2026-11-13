import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/button';

/** Botón claro / oscuro: se recuerda en este dispositivo. */
const ThemeToggle = ({ className = '' }: { className?: string }) => {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : getStoredTheme()));
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={`h-8 w-8 ${className || 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label="Cambiar entre modo claro y oscuro"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
};

export default ThemeToggle;
