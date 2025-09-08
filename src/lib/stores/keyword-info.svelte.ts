/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { browser } from '$app/environment';
import { clientLogger as logger } from '$lib/client/logger';

export interface KeywordInfoState {
  isLoading: boolean;
  currentUrl: string;
  listKeywordsOutput: string | null;
  extractorInfoOutput: string | null;
  error: string | null;
  lastCommand: 'list-keywords' | 'extractor-info' | null;
}

export interface KeywordInfoResponse {
  success: boolean;
  data?: {
    output: string;
  };
  error?: string;
}

const initialState: KeywordInfoState = {
  isLoading: false,
  currentUrl: '',
  listKeywordsOutput: null,
  extractorInfoOutput: null,
  error: null,
  lastCommand: null,
};

const keywordInfoState = $state<KeywordInfoState>({ ...initialState });

const hasOutput = $derived(
  keywordInfoState.listKeywordsOutput !== null || keywordInfoState.extractorInfoOutput !== null,
);

const currentOutput = $derived(() => {
  if (keywordInfoState.lastCommand === 'list-keywords') {
    return keywordInfoState.listKeywordsOutput;
  }
  if (keywordInfoState.lastCommand === 'extractor-info') {
    return keywordInfoState.extractorInfoOutput;
  }
  return null;
});

const getStorageKey = (url: string, command: 'list-keywords' | 'extractor-info'): string => {
  return `keyword-info-${command}-${encodeURIComponent(url)}`;
};

const loadFromStorage = (
  url: string,
  command: 'list-keywords' | 'extractor-info',
): string | null => {
  if (!browser) {
    return null;
  }

  try {
    const key = getStorageKey(url, command);
    const stored = localStorage.getItem(key);
    return stored;
  } catch (error) {
    logger.warn(`Failed to load ${command} data from localStorage for URL: ${url}`, error);
    return null;
  }
};

const saveToStorage = (
  url: string,
  command: 'list-keywords' | 'extractor-info',
  output: string,
): void => {
  if (!browser) {
    return;
  }

  try {
    const key = getStorageKey(url, command);
    localStorage.setItem(key, output);
    logger.info(`Saved ${command} data to localStorage for URL: ${url}`);
  } catch (error) {
    logger.warn(`Failed to save ${command} data to localStorage for URL: ${url}`, error);
  }
};

const clearAllStorage = (): void => {
  if (!browser) {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('keyword-info-')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    logger.info(`Cleared ${keysToRemove.length} keyword info entries from localStorage`);
  } catch (error) {
    logger.warn('Failed to clear keyword info data from localStorage', error);
  }
};

const executeCommand = async (
  url: string,
  command: 'list-keywords' | 'extractor-info',
): Promise<void> => {
  if (!url.trim()) {
    keywordInfoState.error = 'URL is required';
    return;
  }

  keywordInfoState.isLoading = true;
  keywordInfoState.error = null;
  keywordInfoState.currentUrl = url;
  keywordInfoState.lastCommand = command;

  const cachedOutput = loadFromStorage(url, command);
  if (cachedOutput) {
    logger.info(`Using cached ${command} data for URL: ${url}`);

    if (command === 'list-keywords') {
      keywordInfoState.listKeywordsOutput = cachedOutput;
    } else {
      keywordInfoState.extractorInfoOutput = cachedOutput;
    }

    keywordInfoState.isLoading = false;
    return;
  }

  try {
    logger.info(`Executing ${command} command for URL: ${url}`);

    const response = await fetch('/api/keyword-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        command,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!payload) {
      throw new Error('Unable to communicate with server. Please try again.');
    }

    if (!payload.success) {
      throw new Error(payload.error ?? 'Unknown error occurred');
    }

    if (!payload.data?.output) {
      throw new Error('No output received from server');
    }

    const output = payload.data.output;

    if (command === 'list-keywords') {
      keywordInfoState.listKeywordsOutput = output;
    } else {
      keywordInfoState.extractorInfoOutput = output;
    }

    saveToStorage(url, command, output);

    logger.info(`Successfully executed ${command} command for URL: ${url}`);
  } catch (error) {
    keywordInfoState.error =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    logger.error(`Failed to execute ${command} command:`, error);
  } finally {
    keywordInfoState.isLoading = false;
  }
};

const clearOutput = (): void => {
  keywordInfoState.listKeywordsOutput = null;
  keywordInfoState.extractorInfoOutput = null;
  keywordInfoState.error = null;
  keywordInfoState.lastCommand = null;
  keywordInfoState.currentUrl = '';
};

const clearAllCachedData = (): void => {
  clearAllStorage();
  clearOutput();
  logger.info('Cleared all keyword info cached data');
};

export const keywordInfoStore = {
  get state() {
    return keywordInfoState;
  },

  get hasOutput() {
    return hasOutput;
  },

  get currentOutput() {
    return currentOutput;
  },

  executeCommand,
  clearOutput,
  clearAllCachedData,
};
