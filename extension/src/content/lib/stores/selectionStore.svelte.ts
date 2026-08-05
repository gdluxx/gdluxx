/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { SvelteSet } from 'svelte/reactivity';
import { setClipboard } from '#utils/clipboard';
import { sendUrls } from '#utils/gdluxxApi';
import {
  loadCustomDirectory,
  saveCustomDirectory,
  loadSiteDirectory,
  saveSiteDirectory,
} from '#utils/persistence';
import { isValidDirectoryName } from '#utils/validation';
import { persistDirAutoFillOptOut } from '#utils/directorySource';
import {
  toggleSelection,
  selectAll as selectAllValues,
  invertSelection as invertSelectionValues,
} from '#utils/selection';
import { toastStore } from '#stores/toast';

export function createSelectionStore() {
  const selected = new SvelteSet<string>();
  let filter = $state('');
  let compact = $state(true);
  let customDirectoryEnabled = $state(false);
  let customDirectoryValue = $state('');
  let siteDirEnabled = $state(false);

  let lastSavedEnabled = false;
  let lastSavedDirectory = '';
  let lastSavedSiteDir = false;

  // Provenance of the current directory value
  let lastAutoFilledValue: string | null = null;
  let autoFillFailedReason = $state<string | null>(null);

  $effect(() => {
    // Persist on any change to enabled or value
    if (
      customDirectoryEnabled !== lastSavedEnabled ||
      customDirectoryValue !== lastSavedDirectory
    ) {
      lastSavedEnabled = customDirectoryEnabled;
      lastSavedDirectory = customDirectoryValue;
      saveCustomDirectory(customDirectoryEnabled, customDirectoryValue).catch((err) => {
        console.error('Failed to save custom directory:', err);
      });
    }
  });

  $effect(() => {
    if (siteDirEnabled !== lastSavedSiteDir) {
      lastSavedSiteDir = siteDirEnabled;
      saveSiteDirectory(siteDirEnabled).catch((err) => {
        console.error('Failed to save site directory preference:', err);
      });
    }
  });

  // Auto-filled values are page-derived, not user intent: sync the save
  // trackers to the new state so the persistence effect sees no delta and
  // nothing reaches browser.storage.local
  function suppressDirectoryPersistence() {
    lastSavedEnabled = customDirectoryEnabled;
    lastSavedDirectory = customDirectoryValue;
  }

  function autoFillDirectory(value: string) {
    customDirectoryEnabled = true;
    customDirectoryValue = value;
    lastAutoFilledValue = value;
    autoFillFailedReason = null;
    suppressDirectoryPersistence();
  }

  function autoFillDirectoryFailed(reason: string) {
    customDirectoryEnabled = true;
    customDirectoryValue = '';
    lastAutoFilledValue = null;
    autoFillFailedReason = reason;
    suppressDirectoryPersistence();
  }

  function clearAutoFilledDirectory() {
    // Only ever resets state this store filled in; a manual value is untouched
    if (lastAutoFilledValue === null && autoFillFailedReason === null) return;
    customDirectoryEnabled = false;
    customDirectoryValue = '';
    lastAutoFilledValue = null;
    autoFillFailedReason = null;
    suppressDirectoryPersistence();
  }

  function setCustomDirectory(enabled: boolean, value?: string) {
    const wasAutoFilled = lastAutoFilledValue !== null || autoFillFailedReason !== null;

    if (!enabled && wasAutoFilled) {
      // Dismissing an auto-filled, or failed, value opts this page out for the
      // rest of the session. The resulting {false, ''} write is intended
      lastAutoFilledValue = null;
      autoFillFailedReason = null;
      customDirectoryValue = '';
      if (typeof window !== 'undefined') {
        persistDirAutoFillOptOut(window.location.href);
      }
    }

    customDirectoryEnabled = enabled;

    if (value !== undefined) {
      if (value !== lastAutoFilledValue) {
        // Typed over the auto-filled value - provenance becomes manual and the
        // value persists normally from here on
        lastAutoFilledValue = null;
        autoFillFailedReason = null;
      }
      customDirectoryValue = value;
    }
  }

  function toggle(url: string) {
    const next = toggleSelection(selected, url);
    selected.clear();
    for (const value of next) {
      selected.add(value);
    }
  }

  function selectAll(visible: string[]) {
    const next = selectAllValues(selected, visible);
    selected.clear();
    for (const value of next) {
      selected.add(value);
    }
  }

  function selectNone() {
    selected.clear();
  }

  function invertSelection(visible: string[]) {
    const next = invertSelectionValues(selected, visible);
    selected.clear();
    for (const value of next) {
      selected.add(value);
    }
  }

  async function copyToClipboard(urls: string[]) {
    if (urls.length === 0) {
      toastStore.warning('Please select URLs to copy.');
      return;
    }

    try {
      await setClipboard(urls.join('\n'));
      toastStore.success(`Copied ${urls.length} URL${urls.length === 1 ? '' : 's'} to clipboard!`);
    } catch (error) {
      console.error('Copy failed:', error);
      toastStore.error('Failed to copy to clipboard.');
    }
  }

  function downloadAsFile(urls: string[], filename: string) {
    if (urls.length === 0) {
      toastStore.warning('Please select URLs to download.');
      return;
    }

    try {
      const blob = new Blob([urls.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toastStore.success(`Downloaded ${urls.length} URL${urls.length === 1 ? '' : 's'} to file!`);
    } catch (error) {
      console.error('Download failed:', error);
      toastStore.error('Failed to download file.');
    }
  }

  async function sendToServer(urls: string[]) {
    if (urls.length === 0) {
      toastStore.warning('No URLs to send. Please select URLs/images to send to gdluxx.');
      return;
    }

    if (!confirm(`Send ${urls.length} URL(s) to gdluxx for processing?`)) return;

    // Get custom directory if enabled and valid
    const trimmed = customDirectoryValue.trim();
    const customDir =
      customDirectoryEnabled && trimmed && isValidDirectoryName(trimmed) ? trimmed : undefined;

    const siteDir =
      siteDirEnabled && typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : undefined;

    try {
      const res = await sendUrls(urls, customDir, siteDir);
      if (res.success) {
        const results = res.data?.results;
        const failed = results ? results.filter((r) => !r.success).length : 0;
        if (results && failed > 0) {
          toastStore.warning(`Sent ${results.length - failed}, ${failed} rejected`);
        } else {
          toastStore.success(
            res.message ||
              `Successfully sent ${urls.length} URL${urls.length === 1 ? '' : 's'} to gdluxx!`,
          );
        }
      } else {
        toastStore.error(`Failed to send: ${res.error}`);
      }
    } catch (error) {
      console.error('Send error', error);
      toastStore.error('Failed to send URLs to gdluxx.');
    }
  }

  async function initialize() {
    try {
      const dir = await loadCustomDirectory();
      customDirectoryEnabled = dir.enabled;
      customDirectoryValue = dir.value;
      lastSavedEnabled = dir.enabled;
      lastSavedDirectory = dir.value;

      const siteDir = await loadSiteDirectory();
      siteDirEnabled = siteDir.enabled;
      lastSavedSiteDir = siteDir.enabled;
    } catch (error) {
      console.error('Failed to load custom directory:', error);
    }
  }

  return {
    get selected() {
      return selected;
    },
    get filter() {
      return filter;
    },
    get compact() {
      return compact;
    },
    get customDirectoryEnabled() {
      return customDirectoryEnabled;
    },
    get customDirectoryValue() {
      return customDirectoryValue;
    },
    get siteDirEnabled() {
      return siteDirEnabled;
    },
    get autoFillFailedReason() {
      return autoFillFailedReason;
    },
    get isAutoFilled() {
      return lastAutoFilledValue !== null && customDirectoryValue === lastAutoFilledValue;
    },
    get canAcceptAutoFill() {
      if (!customDirectoryEnabled) return true;
      if (!customDirectoryValue.trim()) return true;
      return lastAutoFilledValue !== null && customDirectoryValue === lastAutoFilledValue;
    },

    setFilter(value: string) {
      filter = value;
    },
    setCompact(value: boolean) {
      compact = value;
    },
    setCustomDirectory,
    setSiteDirectory(enabled: boolean) {
      siteDirEnabled = enabled;
    },
    autoFillDirectory,
    autoFillDirectoryFailed,
    clearAutoFilledDirectory,

    toggle,
    selectAll,
    selectNone,
    invertSelection,
    replace(newSelection: Set<string>) {
      selected.clear();
      for (const value of newSelection) {
        selected.add(value);
      }
    },

    copyToClipboard,
    downloadAsFile,
    sendToServer,

    initialize,
  };
}

export type SelectionStore = ReturnType<typeof createSelectionStore>;
