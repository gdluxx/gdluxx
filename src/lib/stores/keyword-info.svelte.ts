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

export interface KeywordSection {
  title: string;
  keywords: Array<{ name: string; example: string }>;
}

export interface KeywordInfoState {
  isLoading: boolean;
  currentUrl: string;
  listKeywordsOutput: string | null;
  listKeywordsSections: KeywordSection[] | null;
  extractorInfoOutput: string | null;
  error: string | null;
  lastCommand: 'list-keywords' | 'extractor-info' | null;
}

export interface KeywordInfoResponse {
  success: boolean;
  data?: {
    output: string;
    sections?: KeywordSection[];
  };
  error?: string;
}

interface CachedListKeywords {
  output: string;
  sections: KeywordSection[] | null;
}

const initialState: KeywordInfoState = {
  isLoading: false,
  currentUrl: '',
  listKeywordsOutput: null,
  listKeywordsSections: null,
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

const currentSections = $derived(() => {
  if (keywordInfoState.lastCommand === 'list-keywords') {
    return keywordInfoState.listKeywordsSections;
  }
  return null;
});

const getStorageKey = (url: string, command: 'list-keywords' | 'extractor-info'): string => {
  return `keyword-info-${command}-${encodeURIComponent(url)}`;
};

interface LoadedOutput {
  output: string;
  sections: KeywordSection[] | null;
}

// list-keywords entries are cached as a JSON `{ output, sections }` blob so the
// structured table survives a cache hit; extractor-info stays a raw string.
// Older raw-string entries (or a failed parse) degrade gracefully to raw only
const loadFromStorage = (
  url: string,
  command: 'list-keywords' | 'extractor-info',
): LoadedOutput | null => {
  if (!browser) {
    return null;
  }

  try {
    const key = getStorageKey(url, command);
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return null;
    }

    if (command === 'list-keywords') {
      try {
        const parsed = JSON.parse(stored) as Partial<CachedListKeywords>;
        if (parsed && typeof parsed.output === 'string') {
          return {
            output: parsed.output,
            sections: Array.isArray(parsed.sections) ? parsed.sections : null,
          };
        }
      } catch {
        // Legacy raw-string entry - fall through to raw handling below
      }
    }

    return { output: stored, sections: null };
  } catch (error) {
    logger.warn(`Failed to load ${command} data from localStorage for URL: ${url}`, error);
    return null;
  }
};

const saveToStorage = (
  url: string,
  command: 'list-keywords' | 'extractor-info',
  output: string,
  sections: KeywordSection[] | null,
): void => {
  if (!browser) {
    return;
  }

  try {
    const key = getStorageKey(url, command);
    const value =
      command === 'list-keywords'
        ? JSON.stringify({ output, sections } satisfies CachedListKeywords)
        : output;
    localStorage.setItem(key, value);
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

  const cached = loadFromStorage(url, command);
  if (cached) {
    logger.info(`Using cached ${command} data for URL: ${url}`);

    if (command === 'list-keywords') {
      keywordInfoState.listKeywordsOutput = cached.output;
      keywordInfoState.listKeywordsSections = cached.sections;
    } else {
      keywordInfoState.extractorInfoOutput = cached.output;
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
    const sections = Array.isArray(payload.data.sections) ? payload.data.sections : null;

    if (command === 'list-keywords') {
      keywordInfoState.listKeywordsOutput = output;
      keywordInfoState.listKeywordsSections = sections;
    } else {
      keywordInfoState.extractorInfoOutput = output;
    }

    saveToStorage(url, command, output, sections);

    logger.info(`Successfully executed ${command} command for URL: ${url}`);
  } catch (error) {
    keywordInfoState.error =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    logger.error(`Failed to execute ${command} command:`, error);
  } finally {
    keywordInfoState.isLoading = false;
  }
};

// Switch the displayed command without hitting the network. If the newly
// selected command has no in-memory output yet, hydrate it from cache so a
// previously run command's result reappears when its segment is selected
const selectCommand = (command: 'list-keywords' | 'extractor-info'): void => {
  keywordInfoState.lastCommand = command;

  if (!keywordInfoState.currentUrl) {
    return;
  }

  if (command === 'list-keywords' && keywordInfoState.listKeywordsOutput === null) {
    const cached = loadFromStorage(keywordInfoState.currentUrl, command);
    if (cached) {
      keywordInfoState.listKeywordsOutput = cached.output;
      keywordInfoState.listKeywordsSections = cached.sections;
    }
  } else if (command === 'extractor-info' && keywordInfoState.extractorInfoOutput === null) {
    const cached = loadFromStorage(keywordInfoState.currentUrl, command);
    if (cached) {
      keywordInfoState.extractorInfoOutput = cached.output;
    }
  }
};

const clearOutput = (): void => {
  keywordInfoState.listKeywordsOutput = null;
  keywordInfoState.listKeywordsSections = null;
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

  get currentSections() {
    return currentSections;
  },

  executeCommand,
  selectCommand,
  clearOutput,
  clearAllCachedData,
};
