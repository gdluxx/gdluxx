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
import type { VersionInfo, SourceInfo } from '$lib/server/version/versionManager';

export interface VersionStoreState extends VersionInfo {
  loading: boolean;
  updateInProgress: boolean;
  error: string | null;
  source: SourceInfo | null;
}

const initialState: VersionStoreState = {
  current: null,
  latestAvailable: null,
  lastChecked: null,
  loading: false,
  updateInProgress: false,
  error: null,
  source: null,
};

export interface StoreActionResult {
  success: boolean;
  message: string;
  type?: 'info' | 'success' | 'error';
  data?: VersionInfo;
}

function createVersionStore() {
  const { subscribe, update } = writable<VersionStoreState>(initialState);

  const handleApiError = async (
    response: Response,
    fallbackErrorPrefix: string,
  ): Promise<StoreActionResult> => {
    const errorData = await response.json().catch((): { error: string } => ({
      error: `${fallbackErrorPrefix}: ${response.statusText}`,
    }));
    const errorMsg = errorData.error || `${fallbackErrorPrefix}: ${response.statusText}`;
    setError(errorMsg);
    return { success: false, message: errorMsg, type: 'error' };
  };

  const handleErrorResult = (
    errorFromResult: string | undefined,
    response: Response,
    fallbackErrorPrefix: string,
  ): StoreActionResult => {
    const errorMsg = errorFromResult || `${fallbackErrorPrefix}: ${response.statusText}`;
    setError(errorMsg);
    return { success: false, message: errorMsg, type: 'error' };
  };

  const setLoading: (isLoading: boolean) => void = (isLoading: boolean): void =>
    update((s) => ({ ...s, loading: isLoading, error: null }));
  const setUpdateInProgress: (isLoading: boolean) => void = (isInProgress: boolean): void =>
    update((s) => ({ ...s, updateInProgress: isInProgress, error: null }));
  const setError: (errorMessage: string) => void = (errorMessage: string): void =>
    update((s) => ({
      ...s,
      error: errorMessage,
      loading: false,
      updateInProgress: false,
    }));
  const setData = (data: VersionInfo & { source?: SourceInfo }): void =>
    update((s) => ({
      ...s,
      current: data.current,
      latestAvailable: data.latestAvailable,
      lastChecked: data.lastChecked,
      source: data.source ?? s.source,
      loading: false,
      updateInProgress: false,
      error: null,
    }));

  return {
    subscribe,
    // Get current version
    loadStatus: async (): Promise<StoreActionResult> => {
      setLoading(true);
      try {
        const response: Response = await fetch('/api/settings/version');
        if (!response.ok) {
          return await handleApiError(response, 'Failed to fetch status');
        }
        const payload = await response.json();
        if (!payload.success) {
          return await handleApiError(response, payload.error || 'Failed to fetch status');
        }
        const data: VersionInfo = payload.data;
        setData(data);
        return { success: true, message: 'Version status loaded.', data, type: 'info' };
      } catch (e) {
        const errorMsg: string =
          e instanceof Error ? e.message : 'Unknown error loading version status';
        setError(errorMsg);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    checkForUpdates: async (): Promise<StoreActionResult> => {
      setLoading(true);
      try {
        const response = await fetch('/api/settings/version', { method: 'POST' });
        if (!response.ok) {
          return await handleApiError(response, 'Failed to check for updates');
        }
        const payload = await response.json();
        if (!payload.success) {
          return await handleApiError(response, payload.error || 'Failed to check for updates');
        }
        const data: VersionInfo & { message?: string } = payload.data;
        setData(data);

        if (data.message?.includes('Already up to date')) {
          return { success: true, message: data.message!, data, type: 'info' };
        }
        return {
          success: true,
          message: 'Update check complete. Latest version info updated.',
          data,
          type: 'success',
        };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error checking for updates';
        setError(errorMsg);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    performUpdate: async (): Promise<StoreActionResult> => {
      setUpdateInProgress(true);
      try {
        const response: Response = await fetch('/api/settings/version/update', { method: 'POST' });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          return handleErrorResult(payload.error, response, 'Update failed');
        }

        const result: VersionInfo & { message?: string } = payload.data;
        setData(result);

        if (result.message?.includes('Already up to date')) {
          return { success: true, message: result.message!, data: result, type: 'info' };
        }
        return {
          success: true,
          message: result.message || 'Update completed successfully.',
          data: result,
          type: 'success',
        };
      } catch (e) {
        const errorMsg: string = e instanceof Error ? e.message : 'Unknown error performing update';
        setError(errorMsg);
        return { success: false, message: errorMsg, type: 'error' };
      } finally {
        update((s) => (s.updateInProgress ? { ...s, updateInProgress: false } : s));
      }
    },
  };
}

export const versionStore = createVersionStore();
