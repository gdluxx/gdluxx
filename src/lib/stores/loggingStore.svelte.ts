/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { toastStore } from '$lib/stores/toast';
import { logger } from '$lib/shared/logger';

export interface LoggingSettings {
  enabled: boolean;
  level?: string;
}

let _enabled: boolean = $state(false);
let _isLoading: boolean = $state(false);
let _error: string | null = $state<string | null>(null);

export async function fetchLoggingStatus(): Promise<void> {
  _isLoading = true;
  _error = null;
  try {
    logger.info('[Store TRACE] Client store calling fetchLoggingStatus.');
    const response: Response = await fetch('/settings/debug', {
      cache: 'no-store',
    });
    if (!response.ok) {
      const errData = await response
        .json()
        .catch((): { message: string } => ({ message: 'Server error fetching logging settings' }));
      //eslint-disable-next-line
      throw new Error(errData.message || `Failed to fetch logging settings (${response.status})`);
    }
    const data: LoggingSettings = await response.json();
    logger.info(`[Store TRACE] Client store received from API: ${JSON.stringify(data)}`);
    _enabled = data.enabled;

    await logger.setConfig({ enabled: data.enabled });
  } catch (e) {
    const errorMsg: string =
      e instanceof Error ? e.message : 'Unknown error loading logging status';
    _error = errorMsg;
    toastStore.error('Logging Settings', `Failed to load: ${errorMsg}`);
  } finally {
    _isLoading = false;
  }
}

export async function updateLoggingStatus(newEnabledState: boolean): Promise<void> {
  _isLoading = true;
  _error = null;
  try {
    const response: Response = await fetch('/settings/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabledState }),
    });
    if (!response.ok) {
      const errData = await response
        .json()
        .catch((): { message: string } => ({ message: 'Server error updating logging settings' }));
      //eslint-disable-next-line
      throw new Error(errData.message || `Failed to update logging settings (${response.status})`);
    }
    const data: LoggingSettings = await response.json();
    _enabled = data.enabled;

    await logger.setConfig({ enabled: data.enabled });

    toastStore.success('Logging Settings', `Logging ${data.enabled ? 'enabled' : 'disabled'}.`);
  } catch (e) {
    const errorMsg: string =
      e instanceof Error ? e.message : 'Unknown error updating logging status';
    _error = errorMsg;
    toastStore.error('Logging Settings', `Failed to update: ${errorMsg}`);
  } finally {
    _isLoading = false;
  }
}

export const loggingStore = {
  get enabled(): boolean {
    return _enabled;
  },
  get isLoading(): boolean {
    return _isLoading;
  },
  get error(): string | null {
    return _error;
  },
  fetchStatus: fetchLoggingStatus,
  updateStatus: updateLoggingStatus,
};
