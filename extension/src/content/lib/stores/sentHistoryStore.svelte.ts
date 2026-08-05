/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { SvelteMap } from 'svelte/reactivity';
import browser from 'webextension-polyfill';
import {
  loadSentUrlsForHost,
  reconcileWithJobResults,
  clearSentHistory,
  SENT_URLS_KEY,
  JOB_RESULTS_KEY,
  type SentStatus,
} from '#utils/storageSentHistory';
import { loadSettings } from '#utils/persistence';
import { SHOW_SENT_MARKS_KEY } from '#utils/settings';

export function createSentHistoryStore() {
  const statuses = new SvelteMap<string, SentStatus>();
  let enabled = $state(true);
  let currentHost = '';
  let disposed = false;
  let listener: Parameters<typeof browser.storage.onChanged.addListener>[0] | null = null;

  async function loadIntoMap(host: string): Promise<void> {
    const record = await loadSentUrlsForHost(host);
    statuses.clear();
    for (const [url, entry] of Object.entries(record)) {
      statuses.set(url, entry.status);
    }
  }

  async function reconcileAndReload(): Promise<void> {
    if (!currentHost) return;
    await reconcileWithJobResults(currentHost);
    await loadIntoMap(currentHost);
  }

  function attachListener(): void {
    if (listener || disposed) return;
    listener = (changes, areaName) => {
      if (areaName !== 'local') return;
      if (SENT_URLS_KEY in changes) {
        void loadIntoMap(currentHost);
      }
      if (JOB_RESULTS_KEY in changes) {
        void reconcileAndReload();
      }
      if (SHOW_SENT_MARKS_KEY in changes) {
        const next = changes[SHOW_SENT_MARKS_KEY]?.newValue;
        if (typeof next === 'boolean') enabled = next;
      }
    };
    browser.storage.onChanged.addListener(listener);
  }

  async function initialize(host: string): Promise<void> {
    currentHost = host;
    try {
      const settings = await loadSettings();
      if (disposed) return;
      enabled = settings.showSentMarks;
    } catch (error) {
      console.error('Failed to load sent-marks display preference', error);
    }
    await reconcileAndReload();
    if (disposed) return;
    attachListener();
  }

  async function refresh(): Promise<void> {
    await reconcileAndReload();
  }

  async function clear(scope: 'host' | 'all'): Promise<void> {
    if (scope === 'host' && !currentHost) return;
    await clearSentHistory(scope === 'host' ? currentHost : undefined);
    if (scope === 'all') {
      statuses.clear();
    } else {
      await loadIntoMap(currentHost);
    }
  }

  function dispose(): void {
    disposed = true;
    if (listener) {
      browser.storage.onChanged.removeListener(listener);
      listener = null;
    }
  }

  return {
    get statuses() {
      return statuses;
    },
    get enabled() {
      return enabled;
    },
    initialize,
    refresh,
    clear,
    dispose,
  };
}

export type SentHistoryStore = ReturnType<typeof createSentHistoryStore>;
