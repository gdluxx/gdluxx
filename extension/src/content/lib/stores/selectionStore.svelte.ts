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
import { loadCustomDirectory, saveCustomDirectory } from '#utils/persistence';
import { isValidDirectoryName } from '#utils/validation';
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

  let lastSavedDirectory = '';

  $effect(() => {
    // Only save when enabled and value changed
    if (
      customDirectoryEnabled &&
      customDirectoryValue &&
      customDirectoryValue !== lastSavedDirectory
    ) {
      lastSavedDirectory = customDirectoryValue;
      saveCustomDirectory(customDirectoryEnabled, customDirectoryValue).catch((err) => {
        console.error('Failed to save custom directory:', err);
      });
    }
  });

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

    try {
      const res = await sendUrls(urls, customDir);
      if (res.success) {
        toastStore.success(
          res.message ||
            `Successfully sent ${urls.length} URL${urls.length === 1 ? '' : 's'} to gdluxx!`,
        );
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
      lastSavedDirectory = dir.value;
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

    setFilter(value: string) {
      filter = value;
    },
    setCompact(value: boolean) {
      compact = value;
    },
    setCustomDirectory(enabled: boolean, value?: string) {
      customDirectoryEnabled = enabled;
      if (value !== undefined) {
        customDirectoryValue = value;
      }
    },

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
