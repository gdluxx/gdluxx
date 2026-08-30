/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { clientLogger as logger } from '$lib/client/logger';

export type ThemeName =
  | 'indigo'
  | 'media-gallery'
  | 'developer-tool'
  | 'high-contrast'
  | 'media-downloader'
  | 'terminal-dark'
  | 'power-user'
  | 'torture';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export const DEFAULT_THEME: ThemeName = 'indigo';
export const DEFAULT_MODE: ThemeMode = 'system';

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return systemPrefersDark() ? 'dark' : 'light';
}

const debugLog = (message: string, ...args: unknown[]) =>
  logger.debug(`[ThemeUtils] ${message}`, ...args);
const themeWarn = (message: string, ...args: unknown[]) =>
  logger.warn(`[ThemeUtils] ${message}`, ...args);

export interface ThemeConfig {
  name: ThemeName;
  displayName: string;
  description: string;
  supportsDarkMode: boolean;
  /**
   * Hidden from the theme picker (QA/torture themes). The theme still ships
   * in the bundle and the store still accepts it from storage or the DB
   */
  devOnly?: boolean;
  /**
   * Small set of signature colors (primary/success/warning/info) taken
   * directly from this theme's own CSS token file (light mode). Used to
   * render identity swatches on theme picker cards. These are literal
   * values by design - they mirror the theme's own tokens, not app UI
   * palette drift.
   */
  swatch: string[];
}

export const AVAILABLE_THEMES: Record<ThemeName, ThemeConfig> = {
  indigo: {
    name: 'indigo',
    displayName: 'Indigo',
    description: 'Enhanced indigo',
    supportsDarkMode: true,
    swatch: ['#4844c9', '#015327', '#815906', '#11547b'],
  },
  'media-gallery': {
    name: 'media-gallery',
    displayName: 'Media Gallery',
    description: 'Orange-focused',
    supportsDarkMode: true,
    swatch: ['#9f4819', '#01692e', '#5c4100', '#005785'],
  },
  'developer-tool': {
    name: 'developer-tool',
    displayName: 'Developer Tool',
    description: 'GitHub-inspired',
    supportsDarkMode: true,
    swatch: ['#075dc3', '#167033', '#684a15', '#17546f'],
  },
  'high-contrast': {
    name: 'high-contrast',
    displayName: 'High Contrast',
    description: 'Maximum contrast',
    supportsDarkMode: true,
    swatch: ['#3730a3', '#1d420e', '#2f2303', '#00305b'],
  },
  'media-downloader': {
    name: 'media-downloader',
    displayName: 'Media Downloader',
    description: 'Amber-focused',
    supportsDarkMode: true,
    swatch: ['#994c00', '#005943', '#5a4300', '#00509e'],
  },
  'terminal-dark': {
    name: 'terminal-dark',
    displayName: 'Terminal Dark',
    description: 'Green-focused',
    supportsDarkMode: true,
    swatch: ['#097100', '#00574a', '#5b4403', '#0051c3'],
  },
  'power-user': {
    name: 'power-user',
    displayName: 'Power User',
    description: 'Purple-focused',
    supportsDarkMode: true,
    swatch: ['#7632e5', '#156141', '#554623', '#19517b'],
  },
  torture: {
    name: 'torture',
    displayName: 'Torture (QA)',
    description: 'Architecture torture test',
    supportsDarkMode: true,
    devOnly: true,
    swatch: ['#5c002e', '#00005c', '#29007a', '#1f386b'],
  },
};

let currentTheme: ThemeName = DEFAULT_THEME;
let currentMode: ResolvedThemeMode = 'dark';

export function getCurrentTheme(): ThemeName {
  return currentTheme;
}

export function getCurrentMode(): ResolvedThemeMode {
  return currentMode;
}

export function getThemeConfig(themeName: ThemeName): ThemeConfig {
  return AVAILABLE_THEMES[themeName];
}

export function applyTheme(
  themeName: ThemeName,
  mode: ResolvedThemeMode = 'dark',
  element?: HTMLElement,
): void {
  const targetElement =
    element || (typeof document !== 'undefined' ? document.documentElement : null);

  if (!targetElement) {
    themeWarn('applyTheme called in non-browser environment without element parameter');
    return;
  }

  const themeConfig = AVAILABLE_THEMES[themeName];

  if (!themeConfig) {
    themeWarn(`Theme "${themeName}" not found. Using ${DEFAULT_THEME} instead.`);
    themeName = DEFAULT_THEME;
  }

  debugLog(`Applying theme: ${themeName}, mode: ${mode}`);

  const existingThemes = Object.keys(AVAILABLE_THEMES).map((name) => `theme-${name}`);
  targetElement.classList.remove(...existingThemes, 'dark');
  targetElement.classList.add(`theme-${themeName}`);

  if (mode === 'dark') {
    targetElement.classList.add('dark');
  }

  currentTheme = themeName;
  currentMode = mode;

  const event = new CustomEvent('themechange', {
    detail: { theme: themeName, mode },
  });
  targetElement.dispatchEvent(event);
}

export function toggleMode(element?: HTMLElement): ResolvedThemeMode {
  const newMode = currentMode === 'light' ? 'dark' : 'light';
  applyTheme(currentTheme, newMode, element);
  return newMode;
}

export function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_MODE;
  }
  const saved = localStorage.getItem('gdluxx-theme-mode');
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_MODE;
}

export function initializeTheme(element?: HTMLElement): void {
  if (typeof window === 'undefined') {
    themeWarn('initializeTheme called in non-browser environment');
    return;
  }

  const savedTheme = localStorage.getItem('gdluxx-theme') as ThemeName;
  const theme = savedTheme && AVAILABLE_THEMES[savedTheme] ? savedTheme : DEFAULT_THEME;

  applyTheme(theme, resolveMode(readStoredMode()), element);
}
