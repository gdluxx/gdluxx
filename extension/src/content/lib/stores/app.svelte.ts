/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { Settings } from '#utils/settings';
import type { DisplayMode } from '#src/content/types';
import {
  loadSettings,
  readThemePreference,
  readDisplayModePreference,
  persistThemePreference,
  persistDisplayModePreference,
  validateServerUrl,
} from '#utils/persistence';

export const DEFAULT_THEME = 'light';
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'modal';

const DEFAULT_SETTINGS: Settings = {
  serverUrl: '',
  apiKey: '',
  hotkey: 'Alt+L',
  hotkeyEnabled: true,
  sendTabHotkey: '',
  sendTabHotkeyEnabled: false,
  showImagePreviews: false,
  showImageHoverPreview: 'off',
};

export function createAppStore() {
  const settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  let theme = $state<string>(DEFAULT_THEME);
  let displayMode = $state<DisplayMode>(DEFAULT_DISPLAY_MODE);

  const isConfigured = $derived(
    !!(settings.serverUrl && settings.apiKey && validateServerUrl(settings.serverUrl).valid),
  );

  const isFullscreen = $derived(displayMode === 'fullscreen');

  async function hydrate(): Promise<void> {
    const [loadedSettings, storedTheme, storedDisplayMode] = await Promise.all([
      loadSettings(),
      readThemePreference(DEFAULT_THEME),
      readDisplayModePreference(DEFAULT_DISPLAY_MODE),
    ]);

    Object.assign(settings, loadedSettings);
    theme = storedTheme;
    displayMode = storedDisplayMode;
  }

  async function applyTheme(nextTheme: string): Promise<void> {
    theme = nextTheme;
    await persistThemePreference(nextTheme);
  }

  async function applyDisplayMode(nextMode: DisplayMode): Promise<void> {
    displayMode = nextMode;
    await persistDisplayModePreference(nextMode);
  }

  return {
    settings,
    get theme() {
      return theme;
    },
    get displayMode() {
      return displayMode;
    },
    get isConfigured() {
      return isConfigured;
    },
    get isFullscreen() {
      return isFullscreen;
    },
    hydrate,
    applyTheme,
    applyDisplayMode,
  } as const;
}

export type AppStore = ReturnType<typeof createAppStore>;
