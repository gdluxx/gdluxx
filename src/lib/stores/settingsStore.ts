/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { writable } from 'svelte/store';

export interface SettingsStoreState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export interface StoreActionResult {
  success: boolean;
  message: string;
  type?: 'info' | 'success' | 'error';
}

export function createSettingsStore<T>(endpoint: string, defaults: T) {
  const initialState: SettingsStoreState<T> = {
    data: defaults,
    loading: false,
    error: null,
  };

  const { subscribe, update } = writable<SettingsStoreState<T>>(initialState);

  const handleApiError = async (
    response: Response,
    fallbackErrorPrefix: string
  ): Promise<StoreActionResult> => {
    const errorData = await response.json().catch((): { error?: string; message?: string } => ({
      error: `${fallbackErrorPrefix}: ${response.statusText}`,
    }));
    const errorMsg =
      errorData.error || errorData.message || `${fallbackErrorPrefix}: ${response.statusText}`;
    setError(errorMsg);
    return { success: false, message: errorMsg, type: 'error' };
  };

  const setLoading = (isLoading: boolean): void =>
    update(s => ({ ...s, loading: isLoading, error: null }));

  const setError = (errorMessage: string): void =>
    update(s => ({
      ...s,
      error: errorMessage,
      loading: false,
    }));

  const setData = (data: T): void =>
    update(s => ({
      ...s,
      data,
      loading: false,
      error: null,
    }));

  return {
    subscribe,

    load: async (): Promise<StoreActionResult> => {
      setLoading(true);
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
        });
        if (!response.ok) {
          return await handleApiError(response, 'Failed to load settings');
        }
        const data = await response.json();
        setData(data);
        return { success: true, message: 'Settings loaded successfully', type: 'info' };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error loading settings';
        setError(errorMsg);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    update: async (newData: Partial<T>): Promise<StoreActionResult> => {
      setLoading(true);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newData),
        });
        if (!response.ok) {
          return await handleApiError(response, 'Failed to update settings');
        }
        const data = await response.json();
        setData(data);
        return { success: true, message: 'Settings updated successfully', type: 'success' };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error updating settings';
        setError(errorMsg);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    // Helper method to get current data synchronously
    getData: (): T => {
      let currentData = defaults;
      update(s => {
        currentData = s.data;
        return s;
      });
      return currentData;
    },

    // Helper method to reset to defaults
    reset: (): void => {
      update(() => initialState);
    },
  };
}
