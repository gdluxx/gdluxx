/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { toastStore } from '#stores/toast';
import { testConnection } from '#utils/messaging';
import { saveSettings, validateServerUrl } from '#utils/persistence';
import type { Settings } from '#utils/settings';
import type { AppStore } from '#stores/app.svelte';

export function createSettingsViewModel(appStore: AppStore, settings: Settings) {
  let isTestingConnection = $state(false);
  let isSavingSettings = $state(false);
  let serverUrlError = $state(false);
  let apiKeyError = $state(false);

  async function test() {
    if (isTestingConnection) return;
    serverUrlError = false;
    apiKeyError = false;
    isTestingConnection = true;

    const missingUrl = !settings.serverUrl;
    const missingKey = !settings.apiKey;

    if (missingUrl || missingKey) {
      serverUrlError = missingUrl;
      apiKeyError = missingKey;
      toastStore.error('Please enter both Server URL and API Key');
      isTestingConnection = false;
      return;
    }

    try {
      const res = await testConnection(settings.serverUrl, settings.apiKey);
      if (res.success) {
        toastStore.success(res.message || 'Connection test successful!');
      } else {
        toastStore.error(res.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      toastStore.error('Failed to test connection');
    } finally {
      isTestingConnection = false;
    }
  }

  async function save() {
    if (isSavingSettings) return;
    serverUrlError = false;
    apiKeyError = false;
    isSavingSettings = true;

    const missingUrl = !settings.serverUrl;
    const missingKey = !settings.apiKey;

    if (missingUrl || missingKey) {
      serverUrlError = missingUrl;
      apiKeyError = missingKey;
      toastStore.error('Please enter both Server URL and API Key');
      isSavingSettings = false;
      return;
    }

    const v = validateServerUrl(settings.serverUrl);
    if (!v.valid) {
      serverUrlError = true;
      toastStore.error(v.error ?? 'Invalid Server URL');
      isSavingSettings = false;
      return;
    }

    try {
      await saveSettings(settings);
      toastStore.success('Settings saved successfully!');
    } catch (error) {
      console.error('Save settings error:', error);
      toastStore.error('Failed to save settings');
    } finally {
      isSavingSettings = false;
    }
  }

  async function reset() {
    if (!confirm('Are you sure you want to reset all gdluxx settings?')) return;

    try {
      settings.serverUrl = '';
      settings.apiKey = '';
      await saveSettings({ serverUrl: '', apiKey: '' });
      toastStore.success('Settings reset successfully!');
    } catch (error) {
      console.error('Reset settings error:', error);
      toastStore.error('Failed to reset settings');
    }
  }

  async function setTheme(value: string) {
    try {
      await appStore.applyTheme(value);
    } catch (error) {
      console.error('Failed to persist theme preference', error);
    }
  }

  async function toggleDisplayMode() {
    const next = !appStore.isFullscreen;
    try {
      await appStore.applyDisplayMode(next ? 'fullscreen' : 'modal');
    } catch (error) {
      console.error('Failed to persist display mode preference', error);
    }
  }

  async function setImagePreviews(next: boolean, target?: HTMLInputElement) {
    const previous = settings.showImagePreviews;
    settings.showImagePreviews = next;
    try {
      await saveSettings({ showImagePreviews: next });
    } catch (error) {
      console.error('Failed to update image preview preference', error);
      settings.showImagePreviews = previous;
      if (target) target.checked = previous;
      toastStore.error('Could not update image preview preference.');
    }
  }

  async function setHoverPreview(
    next: 'off' | 'small' | 'medium' | 'large',
    target?: HTMLSelectElement,
  ) {
    const previous = settings.showImageHoverPreview;
    settings.showImageHoverPreview = next;
    try {
      await saveSettings({ showImageHoverPreview: next });
    } catch (error) {
      console.error('Failed to update hover preview preference', error);
      settings.showImageHoverPreview = previous;
      if (target) target.value = previous;
      toastStore.error('Could not update hover preview preference.');
    }
  }

  async function toggleHotkey(next: boolean, target?: HTMLInputElement) {
    const previous = settings.hotkeyEnabled;
    settings.hotkeyEnabled = next;
    try {
      await saveSettings({ hotkeyEnabled: next });
    } catch (error) {
      console.error('Failed to save hotkeyEnabled', error);
      settings.hotkeyEnabled = previous;
      if (target) target.checked = previous;
    }
  }

  async function setHotkey(newHotkey: string) {
    const previous = settings.hotkey;
    settings.hotkey = newHotkey;
    try {
      await saveSettings({ hotkey: newHotkey });
    } catch (error) {
      console.error('Failed to save hotkey', error);
      settings.hotkey = previous;
    }
  }

  async function toggleSendTabHotkey(next: boolean, target?: HTMLInputElement) {
    const previous = settings.sendTabHotkeyEnabled;
    settings.sendTabHotkeyEnabled = next;
    try {
      await saveSettings({ sendTabHotkeyEnabled: next });
    } catch (error) {
      console.error('Failed to save sendTabHotkeyEnabled', error);
      settings.sendTabHotkeyEnabled = previous;
      if (target) target.checked = previous;
    }
  }

  async function setSendTabHotkey(newHotkey: string) {
    const previous = settings.sendTabHotkey;
    settings.sendTabHotkey = newHotkey;
    try {
      await saveSettings({ sendTabHotkey: newHotkey });
    } catch (error) {
      console.error('Failed to save sendTabHotkey', error);
      settings.sendTabHotkey = previous;
    }
  }

  function clearServerUrlError() {
    serverUrlError = false;
  }

  function clearApiKeyError() {
    apiKeyError = false;
  }

  function setServerUrl(value: string) {
    settings.serverUrl = value;
  }

  function setApiKey(value: string) {
    settings.apiKey = value;
  }

  return {
    get isTestingConnection() {
      return isTestingConnection;
    },
    get isSavingSettings() {
      return isSavingSettings;
    },
    get serverUrlError() {
      return serverUrlError;
    },
    get apiKeyError() {
      return apiKeyError;
    },
    test,
    save,
    reset,
    setTheme,
    toggleDisplayMode,
    setImagePreviews,
    setHoverPreview,
    toggleHotkey,
    setHotkey,
    toggleSendTabHotkey,
    setSendTabHotkey,
    setServerUrl,
    setApiKey,
    clearServerUrlError,
    clearApiKeyError,
  } as const;
}

export type SettingsViewModel = ReturnType<typeof createSettingsViewModel>;
