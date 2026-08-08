/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { vi } from 'vitest';

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

export interface MockStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  onChanged: {
    addListener(listener: StorageChangeListener): void;
    removeListener(listener: StorageChangeListener): void;
  };
  dump(): Record<string, unknown>;
}

function normaliseKeys(
  keys: string | string[] | Record<string, unknown> | null | undefined,
): string[] {
  if (keys === undefined || keys === null) return [];
  if (typeof keys === 'string') return [keys];
  if (Array.isArray(keys)) return keys;
  return Object.keys(keys);
}

function createStorageArea(): MockStorageArea {
  const map = new Map<string, unknown>();
  const listeners = new Set<StorageChangeListener>();

  function notify(changes: Record<string, StorageChange>): void {
    if (Object.keys(changes).length === 0) return;
    for (const listener of listeners) listener(changes, 'local');
  }

  return {
    async get(keys) {
      const requested = normaliseKeys(keys);
      const entries = keys === undefined || keys === null ? [...map.keys()] : requested;
      const result: Record<string, unknown> = {};
      for (const key of entries) {
        if (map.has(key)) {
          result[key] = structuredClone(map.get(key));
        }
      }
      return result;
    },
    async set(items) {
      const changes: Record<string, StorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: map.get(key), newValue: value };
        map.set(key, structuredClone(value));
      }
      notify(changes);
    },
    async remove(keys) {
      const changes: Record<string, StorageChange> = {};
      for (const key of normaliseKeys(keys)) {
        if (map.has(key)) {
          changes[key] = { oldValue: map.get(key) };
          map.delete(key);
        }
      }
      notify(changes);
    },
    async clear() {
      map.clear();
    },
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

export interface MockBrowser {
  runtime: {
    id: string;
    getManifest: () => { version: string; manifest_version: number };
    sendMessage: ReturnType<typeof vi.fn>;
  };
  storage: {
    local: MockStorageArea;
  };
  alarms: {
    create: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    clearAll: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    onAlarm: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
  };
  notifications: {
    create: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    onClicked: { addListener: ReturnType<typeof vi.fn> };
  };
  tabs: {
    create: ReturnType<typeof vi.fn>;
  };
}

function createMockBrowser(): MockBrowser {
  return {
    runtime: {
      id: 'gdluxx-test-extension',
      getManifest: () => ({ version: '1.6.0', manifest_version: 3 }),
      sendMessage: vi.fn(),
    },
    storage: {
      local: createStorageArea(),
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(),
      clearAll: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    notifications: {
      create: vi.fn(),
      clear: vi.fn(),
      onClicked: { addListener: vi.fn() },
    },
    tabs: {
      create: vi.fn(),
    },
  };
}

let current: MockBrowser | null = null;

export function installMockBrowser(): MockBrowser {
  if (current) return current;
  current = createMockBrowser();
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { id: current.runtime.id } };
  (globalThis as unknown as { browser: MockBrowser }).browser = current;
  if (typeof (globalThis as { location?: unknown }).location === 'undefined') {
    (globalThis as unknown as { location: Location }).location = {
      hostname: 'example.com',
    } as unknown as Location;
  }
  return current;
}

export function getMockBrowser(): MockBrowser {
  if (!current) {
    throw new Error('installMockBrowser() has not been called yet');
  }
  return current;
}

export async function resetMockBrowser(): Promise<void> {
  const browser = getMockBrowser();
  await browser.storage.local.clear();
  browser.runtime.sendMessage.mockReset();
  browser.alarms.create.mockReset();
  browser.alarms.clear.mockReset();
  browser.alarms.clearAll.mockReset();
  browser.alarms.get.mockReset();
  browser.alarms.getAll.mockReset();
  browser.notifications.create.mockReset();
  browser.notifications.clear.mockReset();
  browser.tabs.create.mockReset();
}
