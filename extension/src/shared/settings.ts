/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { loadSettings, type Settings } from '#utils/settings';
import browser from 'webextension-polyfill';

// Cached settings for synchronous access

let cachedSettings: Settings | null = null;
let listenerAttached = false;

export async function warmSettings(): Promise<void> {
  try {
    cachedSettings = await loadSettings();
  } catch (error) {
    console.error('Failed to warm settings cache', error);
  }
}

export function getSettings(): Settings | null {
  return cachedSettings;
}

export function attachSettingsListener(): void {
  if (listenerAttached) return;

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const settingsKeys = [
      'gdluxx_server_url',
      'gdluxx_api_key',
      'gdluxx_hotkey',
      'gdluxx_hotkey_enabled',
      'gdluxx_send_tab_hotkey',
      'gdluxx_send_tab_hotkey_enabled',
      'gdluxx_show_image_previews',
      'gdluxx_show_image_hover_preview',
    ];

    if (settingsKeys.some((key) => key in changes)) {
      void warmSettings();
    }
  });

  listenerAttached = true;
}
