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
  type ResolvedThemeMode,
  resolveMode,
  readStoredMode,
  getCurrentTheme,
  getCurrentMode,
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
const _resolvedModeStore = writable<ResolvedThemeMode>('dark');

let systemListenerBound = false;

function bindSystemListener(): void {
  if (systemListenerBound || typeof window === 'undefined' || !window.matchMedia) {
    return;
  }
  systemListenerBound = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (get(_modeStore) !== 'system') {
      return;
    }
    const resolved: ResolvedThemeMode = event.matches ? 'dark' : 'light';
    debugLog(`System preference changed: ${resolved}`);
    applyTheme(get(_themeStore), resolved);
    _resolvedModeStore.set(resolved);
  });
}

function applyPreference(theme: ThemeName, mode: ThemeMode): void {
  const resolved = resolveMode(mode);
  applyTheme(theme, resolved);
  _themeStore.set(theme);
  _modeStore.set(mode);
  _resolvedModeStore.set(resolved);
}

class ThemeState {
  get theme() {
    return _themeStore;
  }

  get mode() {
    return _modeStore;
  }

  get resolvedMode() {
    return _resolvedModeStore;
  }

  get isDark() {
    return {
      subscribe: (callback: (value: boolean) => void) => {
        return _resolvedModeStore.subscribe((mode) => callback(mode === 'dark'));
      },
    };
  }

  async setTheme(theme: ThemeName, mode?: ThemeMode): Promise<void> {
    const newMode = mode || get(_modeStore);
    debugLog(`Setting theme: ${theme}, mode: ${newMode}`);

    if (!AVAILABLE_THEMES[theme]) {
      themeError(`Theme "${theme}" not found in available themes`);
      throw new Error(`Invalid theme: ${theme}`);
    }

    applyPreference(theme, newMode);

    await saveThemeToDatabase(theme);
    saveThemePreference(theme);
    saveModePreference(newMode);
  }

  setMode(mode: ThemeMode): void {
    debugLog(`Setting mode preference: ${mode}`);
    applyPreference(get(_themeStore), mode);
    saveModePreference(mode);
  }

  cycleMode(): void {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const current = get(_modeStore);
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.setMode(next);
  }

  toggleMode(): void {
    const next: ThemeMode = get(_resolvedModeStore) === 'light' ? 'dark' : 'light';
    this.setMode(next);
  }

  setLightMode(): void {
    this.setMode('light');
  }

  setDarkMode(): void {
    this.setMode('dark');
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

      const selectedMode = readStoredMode();

      debugLog(`Theme initialized: ${selectedTheme}, ${selectedMode}`);

      bindSystemListener();
      applyPreference(selectedTheme, selectedMode);

      // Sync localStorage with database values to prevent flashing
      saveThemePreference(selectedTheme);
      saveModePreference(selectedMode);
    }
  }

  initialize(): void {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('gdluxx-theme') as ThemeName;
      const theme: ThemeName =
        savedTheme && AVAILABLE_THEMES[savedTheme] ? savedTheme : DEFAULT_THEME;
      const mode = readStoredMode();

      debugLog(`Theme fallback initialized: ${theme}, ${mode}`);

      bindSystemListener();
      applyPreference(theme, mode);
    } else {
      _themeStore.set(getCurrentTheme());
      _resolvedModeStore.set(getCurrentMode());
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
