import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getStoredTheme } from './theme';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('device theme', () => {
  it('defaults to light without a saved choice', () => {
    localStorage.clear();
    expect(getStoredTheme()).toBe('light');
  });
  it('remembers dark and restores its class, then remembers light', () => {
    applyTheme('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    document.documentElement.classList.remove('dark');
    applyTheme(getStoredTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });
  it('still applies the choice when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getStoredTheme()).toBe('light');
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});