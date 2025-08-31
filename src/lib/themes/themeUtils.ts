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
  | 'power-user';

export type ThemeMode = 'light' | 'dark';

export const DEFAULT_THEME: ThemeName = 'indigo';
export const DEFAULT_MODE: ThemeMode = 'dark';

const debugLog = (message: string, ...args: unknown[]) => logger.debug(`[ThemeUtils] ${message}`, ...args);
const themeWarn = (message: string, ...args: unknown[]) => logger.warn(`[ThemeUtils] ${message}`, ...args);

export interface ThemeConfig {
  name: ThemeName;
  displayName: string;
  description: string;
  supportsDarkMode: boolean;
}

export const AVAILABLE_THEMES: Record<ThemeName, ThemeConfig> = {
  indigo: {
    name: 'indigo',
    displayName: 'Indigo',
    description: 'Enhanced indigo',
    supportsDarkMode: true,
  },
  'media-gallery': {
    name: 'media-gallery',
    displayName: 'Media Gallery',
    description: 'Orange-focused',
    supportsDarkMode: true,
  },
  'developer-tool': {
    name: 'developer-tool',
    displayName: 'Developer Tool',
    description: 'GitHub-inspired',
    supportsDarkMode: true,
  },
  'high-contrast': {
    name: 'high-contrast',
    displayName: 'High Contrast',
    description: 'Maximum contrast',
    supportsDarkMode: true,
  },
  'media-downloader': {
    name: 'media-downloader',
    displayName: 'Media Downloader',
    description: 'Amber-focused',
    supportsDarkMode: true,
  },
  'terminal-dark': {
    name: 'terminal-dark',
    displayName: 'Terminal Dark',
    description: 'Green-focused',
    supportsDarkMode: true,
  },
  'power-user': {
    name: 'power-user',
    displayName: 'Power User',
    description: 'Purple-focused',
    supportsDarkMode: true,
  },
};

let currentTheme: ThemeName = DEFAULT_THEME;
let currentMode: ThemeMode = DEFAULT_MODE;

export function getCurrentTheme(): ThemeName {
  return currentTheme;
}

export function getCurrentMode(): ThemeMode {
  return currentMode;
}

export function getThemeConfig(themeName: ThemeName): ThemeConfig {
  return AVAILABLE_THEMES[themeName];
}

export function applyTheme(
  themeName: ThemeName,
  mode: ThemeMode = 'dark',
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

export function toggleMode(element?: HTMLElement): ThemeMode {
  const newMode = currentMode === 'light' ? 'dark' : 'light';
  applyTheme(currentTheme, newMode, element);
  return newMode;
}

export function initializeTheme(element?: HTMLElement): void {
  if (typeof window === 'undefined') {
    themeWarn('initializeTheme called in non-browser environment');
    return;
  }

  const savedTheme = localStorage.getItem('gdluxx-theme') as ThemeName;
  const savedMode = localStorage.getItem('gdluxx-theme-mode') as ThemeMode;

  const theme = savedTheme && AVAILABLE_THEMES[savedTheme] ? savedTheme : DEFAULT_THEME;

  let mode: ThemeMode = DEFAULT_MODE;
  if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
    mode = savedMode;
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    mode = 'light';
  }

  applyTheme(theme, mode, element);
}

export function saveThemePreference(): void {
  localStorage.setItem('gdluxx-theme', currentTheme);
  localStorage.setItem('gdluxx-theme-mode', currentMode);
}

export function setupSystemThemeListener(): void {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', (e) => {
      const hasManualPreference = localStorage.getItem('gdluxx-theme-mode');
      if (!hasManualPreference) {
        const newMode = e.matches ? 'dark' : 'light';
        applyTheme(currentTheme, newMode);
      }
    });
  }
}

export function validateTheme(themeName: ThemeName, mode: ThemeMode = 'light'): boolean {
  const requiredTokens = [
    '--color-background',
    '--color-surface',
    '--color-surface-elevated',
    '--color-surface-sunken',
    '--color-surface-hover',
    '--color-surface-active',
    '--color-surface-selected',
    '--color-surface-disabled',

    '--color-foreground',
    '--color-muted-foreground',
    '--color-accent-foreground',
    '--color-text-inverse',
    '--color-text-disabled',

    '--color-primary',
    '--color-primary-hover',
    '--color-primary-active',
    '--color-primary-disabled',
    '--color-primary-text',

    '--color-success',
    '--color-warning',
    '--color-error',
    '--color-info',

    '--color-border',
    '--color-border-strong',
    '--color-border-focus',
    '--color-border-disabled',
    '--color-border-error',
    '--color-border-success',

    '--color-input-background',
    '--color-input-disabled',
    '--color-input-invalid',
    '--color-input-valid',

    '--color-skeleton',
    '--color-spinner',

    '--shadow-sm',
    '--shadow-md',
    '--shadow-lg',
  ];

  const testElement = document.createElement('div');
  testElement.classList.add(`theme-${themeName}`);
  if (mode === 'dark') {
    testElement.classList.add('dark');
  }
  document.body.appendChild(testElement);

  const styles = getComputedStyle(testElement);
  const missingTokens: string[] = [];

  for (const token of requiredTokens) {
    const value = styles.getPropertyValue(token).trim();
    if (!value) {
      missingTokens.push(token);
    }
  }

  document.body.removeChild(testElement);

  if (missingTokens.length > 0) {
    themeWarn(`Theme "${themeName}" (${mode}) is missing tokens:`, missingTokens);
    return false;
  }

  return true;
}

export function getSemanticTokenValues(
  element: HTMLElement = document.documentElement,
): Record<string, string> {
  const styles = getComputedStyle(element);
  const tokens: Record<string, string> = {};

  const allProperties = Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules || []);
      } catch {
        return [];
      }
    })
    .flatMap((rule) => {
      if (rule instanceof CSSStyleRule) {
        return Array.from(rule.style).filter(
          (prop) => prop.startsWith('--color-') || prop.startsWith('--shadow-'),
        );
      }
      return [];
    });

  const uniqueProperties = Array.from(new Set(allProperties));

  for (const property of uniqueProperties) {
    const value = styles.getPropertyValue(property).trim();
    if (value) {
      tokens[property] = value;
    }
  }

  return tokens;
}

export function validateThemeSystemHealth(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  performance: Record<string, number>;
  themes: Record<string, { valid: boolean; errors: string[] }>;
} {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const performanceMetrics: Record<string, number> = {};
  const themeResults: Record<string, { valid: boolean; errors: string[] }> = {};

  if (!AVAILABLE_THEMES || Object.keys(AVAILABLE_THEMES).length === 0) {
    errors.push('No themes available in AVAILABLE_THEMES');
    return {
      valid: false,
      errors,
      warnings,
      performance: performanceMetrics,
      themes: themeResults,
    };
  }

  const themeNames = Object.keys(AVAILABLE_THEMES) as ThemeName[];
  const validationStart = performance.now();

  for (const themeName of themeNames) {
    const themeStart = performance.now();
    const themeErrors: string[] = [];

    const config = AVAILABLE_THEMES[themeName];
    if (!config) {
      themeErrors.push(`Missing configuration for theme "${themeName}"`);
    } else {
      if (!config.name || !config.displayName || !config.description) {
        themeErrors.push(`Theme "${themeName}" missing required config properties`);
      }
      if (config.name !== themeName) {
        themeErrors.push(`Theme "${themeName}" config.name mismatch: "${config.name}"`);
      }
    }

    const lightModeValid = validateTheme(themeName, 'light');
    const darkModeValid = config?.supportsDarkMode ? validateTheme(themeName, 'dark') : true;

    if (!lightModeValid) {
      themeErrors.push(`Theme "${themeName}" failed light mode validation`);
    }
    if (config?.supportsDarkMode && !darkModeValid) {
      themeErrors.push(`Theme "${themeName}" failed dark mode validation`);
    }

    const themeTime = performance.now() - themeStart;
    performanceMetrics[`theme_${themeName}_validation_ms`] = Math.round(themeTime * 100) / 100;

    themeResults[themeName] = {
      valid: themeErrors.length === 0,
      errors: themeErrors,
    };

    errors.push(...themeErrors);
  }

  const validationTime = performance.now() - validationStart;
  performanceMetrics.total_validation_ms = Math.round(validationTime * 100) / 100;

  if (typeof document !== 'undefined') {
    const cssCheckStart = performance.now();

    const testElement = document.createElement('div');
    testElement.classList.add(`theme-${DEFAULT_THEME}`);
    document.body.appendChild(testElement);

    const computedStyle = getComputedStyle(testElement);
    const hasThemeTokens = computedStyle.getPropertyValue('--color-primary').trim() !== '';

    if (!hasThemeTokens) {
      warnings.push('Theme CSS may not be properly loaded - no CSS custom properties detected');
    }

    document.body.removeChild(testElement);
    performanceMetrics.css_check_ms = Math.round((performance.now() - cssCheckStart) * 100) / 100;
  }

  if (!AVAILABLE_THEMES[DEFAULT_THEME]) {
    errors.push(`DEFAULT_THEME "${DEFAULT_THEME}" not found in AVAILABLE_THEMES`);
  }

  const totalTime = performance.now() - startTime;
  performanceMetrics.total_health_check_ms = Math.round(totalTime * 100) / 100;

  if (totalTime > 100) {
    warnings.push(`Theme system health check took ${Math.round(totalTime)}ms (>100ms threshold)`);
  }

  const validThemes = Object.values(themeResults).filter((r) => r.valid).length;
  const totalThemes = Object.keys(themeResults).length;

  if (validThemes < totalThemes) {
    warnings.push(`${totalThemes - validThemes} of ${totalThemes} themes have validation issues`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    performance: performanceMetrics,
    themes: themeResults,
  };
}
