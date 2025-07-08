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
import { toastStore } from '$lib/stores/toast';
import type { ApiKey, NewApiKeyResponse, CreateApiKeyRequest } from './types';

export interface ApiKeyStoreState {
  apiKeys: ApiKey[];
  loading: boolean;
  error: string | null;
  newlyCreatedKey: string | null;
}

export interface ApiKeyActionResult {
  success: boolean;
  message: string;
  type?: 'info' | 'success' | 'error';
  data?: ApiKey[] | NewApiKeyResponse;
}

const initialState: ApiKeyStoreState = {
  apiKeys: [],
  loading: false,
  error: null,
  newlyCreatedKey: null,
};

function createApiKeyStore() {
  const { subscribe, update } = writable<ApiKeyStoreState>(initialState);

  const handleApiError = async (
    response: Response,
    fallbackErrorPrefix: string
  ): Promise<ApiKeyActionResult> => {
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

  const setApiKeys = (apiKeys: ApiKey[]): void =>
    update(s => ({
      ...s,
      apiKeys,
      loading: false,
      error: null,
    }));

  const setNewlyCreatedKey = (plainKey: string | null): void =>
    update(s => ({ ...s, newlyCreatedKey: plainKey }));

  return {
    subscribe,

    load: async (): Promise<ApiKeyActionResult> => {
      setLoading(true);
      try {
        const response = await fetch('/settings/apikey', {
          cache: 'no-store',
        });
        if (!response.ok) {
          return await handleApiError(response, 'Failed to load API keys');
        }
        const data = await response.json();
        const apiKeys = data.success ? data.apiKeys || [] : [];
        setApiKeys(apiKeys);
        return {
          success: true,
          message: 'API keys loaded successfully',
          data: apiKeys,
          type: 'info',
        };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error loading API keys';
        setError(errorMsg);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    create: async (request: CreateApiKeyRequest): Promise<ApiKeyActionResult> => {
      setLoading(true);
      try {
        const response = await fetch('/settings/apikey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          return await handleApiError(response, 'Failed to create API key');
        }
        const data: NewApiKeyResponse = await response.json();

        setNewlyCreatedKey(data.plainKey);
        update(s => ({
          ...s,
          apiKeys: [data.apiKey, ...s.apiKeys],
          loading: false,
          error: null,
        }));

        toastStore.success('API Key', `Created "${data.apiKey.name}" successfully`);
        return {
          success: true,
          message: `API key "${data.apiKey.name}" created successfully`,
          data,
          type: 'success',
        };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error creating API key';
        setError(errorMsg);
        toastStore.error('API Key', `Failed to create: ${errorMsg}`);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    delete: async (keyId: string): Promise<ApiKeyActionResult> => {
      setLoading(true);
      try {
        const response = await fetch(`/settings/apikey/${keyId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          return await handleApiError(response, 'Failed to delete API key');
        }

        update(s => ({
          ...s,
          apiKeys: s.apiKeys.filter(key => key.id !== keyId),
          loading: false,
          error: null,
        }));

        toastStore.success('API Key', 'API key deleted successfully');
        return { success: true, message: 'API key deleted successfully', type: 'success' };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error deleting API key';
        setError(errorMsg);
        toastStore.error('API Key', `Failed to delete: ${errorMsg}`);
        return { success: false, message: errorMsg, type: 'error' };
      }
    },

    clearNewlyCreatedKey: (): void => {
      setNewlyCreatedKey(null);
    },

    getState: (): ApiKeyStoreState => {
      let currentState = initialState;
      update(s => {
        currentState = s;
        return s;
      });
      return currentState;
    },

    reset: (): void => {
      update(() => initialState);
    },
  };
}

export const apiKeyStore = createApiKeyStore();
