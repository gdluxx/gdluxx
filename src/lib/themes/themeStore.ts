/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { writable, get } from 'svelte/store';
import {
  applyTheme,
  type ThemeName,
  type ThemeMode,
  getCurrentTheme,
  getCurrentMode,
  validateTheme,
  AVAILABLE_THEMES,
  DEFAULT_THEME,
  DEFAULT_MODE,
} from './themeUtils';
import { clientLogger as logger } from '$lib/client/logger';

const debugLog = (message: string, ...args: unknown[]) =>
  logger.debug(`[Theme] ${message}`, ...args);
const themeError = (message: string, ...args: unknown[]) =>
  logger.error(`[Theme] ${message}`, ...args);
const themeWarn = (message: string, ...args: unknown[]) =>
  logger.warn(`[Theme] ${message}`, ...args);

async function saveThemeToDatabase(theme: ThemeName): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/settings/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTheme: theme }),
      });
    } catch (error) {
      themeWarn('Failed to save theme to database:', error);
    }
  }
}

function saveModePreference(mode: ThemeMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gdluxx-theme-mode', mode);
  }
}

function saveThemePreference(theme: ThemeName): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gdluxx-theme', theme);
  }
}

const _themeStore = writable<ThemeName>(DEFAULT_THEME);
const _modeStore = writable<ThemeMode>(DEFAULT_MODE);

class ThemeState {
  get theme() {
    return _themeStore;
  }

  get mode() {
    return _modeStore;
  }

  get isDark() {
    return {
      subscribe: (callback: (value: boolean) => void) => {
        return _modeStore.subscribe((mode) => callback(mode === 'dark'));
      },
    };
  }

  async setTheme(theme: ThemeName, mode?: ThemeMode): Promise<void> {
    let currentMode: ThemeMode = DEFAULT_MODE;
    const unsubscribe = _modeStore.subscribe((m) => (currentMode = m));
    unsubscribe();

    const newMode = mode || currentMode;
    debugLog(`Setting theme: ${theme}, mode: ${newMode}`);

    if (!AVAILABLE_THEMES[theme]) {
      themeError(`Theme "${theme}" not found in available themes`);
      throw new Error(`Invalid theme: ${theme}`);
    }

    const isValid = validateTheme(theme, newMode);
    if (!isValid) {
      themeWarn(`Theme "${theme}" failed validation`);
      // Continue with warning since theme may partially work
    }

    applyTheme(theme, newMode);
    _themeStore.set(theme);
    _modeStore.set(newMode);

    await saveThemeToDatabase(theme);
    saveThemePreference(theme);
    saveModePreference(newMode);
  }

  toggleMode(): void {
    const currentTheme = get(_themeStore);
    const currentMode = get(_modeStore);
    const newMode: ThemeMode = currentMode === 'light' ? 'dark' : 'light';

    debugLog(`Toggling mode: ${currentMode} → ${newMode}`);

    applyTheme(currentTheme, newMode);
    _modeStore.set(newMode);
    saveModePreference(newMode);
  }

  setLightMode(): void {
    const currentMode = get(_modeStore);

    if (currentMode !== 'light') {
      this.toggleMode();
    }
  }

  setDarkMode(): void {
    const currentMode = get(_modeStore);

    if (currentMode !== 'dark') {
      this.toggleMode();
    }
  }

  async initializeFromUserSettings(): Promise<void> {
    debugLog('Initializing theme from user settings');

    if (typeof window !== 'undefined') {
      let selectedTheme: ThemeName = DEFAULT_THEME;

      try {
        const response = await fetch('/api/settings/user');
        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data?.selectedTheme) {
            const dbTheme = result.data.selectedTheme as ThemeName;

            if (AVAILABLE_THEMES[dbTheme]) {
              selectedTheme = dbTheme;
            } else {
              themeWarn(
                `Theme "${dbTheme}" from database not found in available themes, using default`,
              );
            }
          }
        } else {
          themeWarn('Failed to fetch user settings, status:', response.status);
        }
      } catch (error) {
        themeWarn('Failed to load theme from database:', error);
      }

      // Get light/dark mode and fallback to system preference
      const savedMode = localStorage.getItem('gdluxx-theme-mode') as ThemeMode;
      let selectedMode: ThemeMode = DEFAULT_MODE;

      if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
        selectedMode = savedMode;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        selectedMode = 'light';
      }

      // Theme validation
      const isValid = validateTheme(selectedTheme, selectedMode);

      if (!isValid) {
        themeWarn(`Theme "${selectedTheme}" failed validation, falling back to ${DEFAULT_THEME}`);
        selectedTheme = DEFAULT_THEME;
        if (!validateTheme(selectedTheme, selectedMode)) {
          themeError('Fallback theme validation failed, using defaults');
          selectedTheme = DEFAULT_THEME;
          selectedMode = DEFAULT_MODE;
        }
      }

      debugLog(`Theme initialized: ${selectedTheme}, ${selectedMode}`);

      _themeStore.set(selectedTheme);
      _modeStore.set(selectedMode);
      applyTheme(selectedTheme, selectedMode);

      // Sync localStorage with database values to prevent flashing
      saveThemePreference(selectedTheme);
      saveModePreference(selectedMode);
    }
  }

  initialize(): void {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('gdluxx-theme') as ThemeName;
      const savedMode = localStorage.getItem('gdluxx-theme-mode') as ThemeMode;

      const theme: ThemeName =
        savedTheme && AVAILABLE_THEMES[savedTheme] ? savedTheme : DEFAULT_THEME;
      let mode: ThemeMode = DEFAULT_MODE;

      if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
        mode = savedMode;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        mode = 'light';
      }

      debugLog(`Theme fallback initialized: ${theme}, ${mode}`);

      applyTheme(theme, mode);
      _themeStore.set(theme);
      _modeStore.set(mode);
    } else {
      const currentTheme = getCurrentTheme();
      const currentMode = getCurrentMode();
      _themeStore.set(currentTheme);
      _modeStore.set(currentMode);
    }
  }
}

export const themeStore = new ThemeState();

export async function initializeThemeStore(): Promise<void> {
  await themeStore.initializeFromUserSettings();
}

export function initializeThemeStoreFallback(): void {
  themeStore.initialize();
}

export function validateThemeSystem(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const themeNames = Object.keys(AVAILABLE_THEMES) as ThemeName[];
  if (themeNames.length === 0) {
    errors.push('No themes available in AVAILABLE_THEMES');
  }

  for (const themeName of themeNames) {
    const config = AVAILABLE_THEMES[themeName];
    if (!config) {
      errors.push(`Theme "${themeName}" missing configuration`);
      continue;
    }

    if (!validateTheme(themeName, 'light')) {
      errors.push(`Theme "${themeName}" failed light mode validation`);
    }

    if (config.supportsDarkMode && !validateTheme(themeName, 'dark')) {
      errors.push(`Theme "${themeName}" failed dark mode validation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
