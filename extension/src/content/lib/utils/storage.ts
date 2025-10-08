/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

const storage = typeof browser !== 'undefined' ? browser.storage.local : null;

export async function getValue<T>(key: string, fallback: T): Promise<T> {
  if (!storage) {
    // Return fallback if browser API is not available (for dev modal purposes)
    return fallback;
  }

  try {
    const result = await storage.get(key);
    return (result?.[key] ?? fallback) as T;
  } catch (error) {
    console.error('Failed to read from storage', error);
    return fallback;
  }
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  if (!storage) {
    // No-op if browser API is not available (for dev modal purposes)
    return;
  }

  try {
    await storage.set({ [key]: value });
  } catch (error) {
    console.error('Failed to write to storage', error);
    throw error;
  }
}

export async function removeValue(key: string): Promise<void> {
  if (!storage) {
    // No-op if browser API is not available (for dev modal purposes)
    return;
  }

  try {
    await storage.remove(key);
  } catch (error) {
    console.error('Failed to remove storage key', error);
    throw error;
  }
}
