/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, setValue } from './storage';

export interface Settings {
  serverUrl: string;
  apiKey: string;
  hotkey: string;
  hotkeyEnabled: boolean;
  showImagePreviews: boolean;
  showImageHoverPreview: 'off' | 'small' | 'medium' | 'large';
}

const DEFAULTS: Settings = {
  serverUrl: '',
  apiKey: '',
  hotkey: 'Alt+L',
  hotkeyEnabled: true,
  showImagePreviews: false,
  showImageHoverPreview: 'off',
};

const KEY_PREFIX = 'gdluxx_';
const KEYS = {
  serverUrl: `${KEY_PREFIX}server_url`,
  apiKey: `${KEY_PREFIX}api_key`,
  hotkey: `${KEY_PREFIX}hotkey`,
  hotkeyEnabled: `${KEY_PREFIX}hotkey_enabled`,
  showImagePreviews: `${KEY_PREFIX}show_image_previews`,
  showImageHoverPreview: `${KEY_PREFIX}show_image_hover_preview`,
};

export async function loadSettings(): Promise<Settings> {
  const [serverUrl, apiKey, hotkey, hotkeyEnabled, showImagePreviews, showImageHoverPreview] =
    await Promise.all([
      getValue(KEYS.serverUrl, DEFAULTS.serverUrl),
      getValue(KEYS.apiKey, DEFAULTS.apiKey),
      getValue(KEYS.hotkey, DEFAULTS.hotkey),
      getValue(KEYS.hotkeyEnabled, DEFAULTS.hotkeyEnabled),
      getValue(KEYS.showImagePreviews, DEFAULTS.showImagePreviews),
      getValue(KEYS.showImageHoverPreview, DEFAULTS.showImageHoverPreview),
    ]);

  return {
    serverUrl,
    apiKey,
    hotkey,
    hotkeyEnabled,
    showImagePreviews,
    showImageHoverPreview,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  if (settings.serverUrl !== undefined) await setValue(KEYS.serverUrl, settings.serverUrl.trim());
  if (settings.apiKey !== undefined) await setValue(KEYS.apiKey, settings.apiKey.trim());
  if (settings.hotkey !== undefined) await setValue(KEYS.hotkey, settings.hotkey);
  if (settings.hotkeyEnabled !== undefined)
    await setValue(KEYS.hotkeyEnabled, settings.hotkeyEnabled);
  if (settings.showImagePreviews !== undefined)
    await setValue(KEYS.showImagePreviews, settings.showImagePreviews);
  if (settings.showImageHoverPreview !== undefined)
    await setValue(KEYS.showImageHoverPreview, settings.showImageHoverPreview);
}

export function validateServerUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'Server URL is required' };
  }

  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
