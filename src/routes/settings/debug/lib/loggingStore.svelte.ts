/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { createSettingsStore, type StoreActionResult } from '$lib/stores/settingsStore';
import { toastStore } from '$lib/stores/toast';
import { clientLogger as logger } from '$lib/client/logger';

export interface LoggingSettings {
  enabled: boolean;
  level?: string;
}

const defaultSettings: LoggingSettings = {
  enabled: false,
  level: 'INFO',
};

function createLoggingStore() {
  const baseStore = createSettingsStore('/settings/debug', defaultSettings);

  return {
    subscribe: baseStore.subscribe,

    load: async (): Promise<StoreActionResult> => {
      logger.info('[Store TRACE] Client store calling load.');
      const result = await baseStore.load();

      if (result.success) {
        const data = baseStore.getData();
        logger.info(`[Store TRACE] Client store received from API: ${JSON.stringify(data)}`);
        logger.updateConfig({ enabled: data.enabled });
      } else {
        toastStore.error('Logging Settings', `Failed to load: ${result.message}`);
      }

      return result;
    },

    // Enhanced update method with logger integration and toast notifications
    updateStatus: async (newEnabledState: boolean): Promise<StoreActionResult> => {
      const result = await baseStore.update({ enabled: newEnabledState });

      if (result.success) {
        const data = baseStore.getData();
        logger.updateConfig({ enabled: data.enabled });
        toastStore.success('Logging Settings', `Logging ${data.enabled ? 'enabled' : 'disabled'}.`);
      } else {
        toastStore.error('Logging Settings', `Failed to update: ${result.message}`);
      }

      return result;
    },

    fetchStatus: async (): Promise<void> => {
      await baseStore.load();
    },

    get enabled(): boolean {
      return baseStore.getData().enabled;
    },

    get isLoading(): boolean {
      let loading = false;
      baseStore.subscribe(state => {
        loading = state.loading;
      })();
      return loading;
    },

    get error(): string | null {
      let error = null;
      baseStore.subscribe(state => {
        error = state.error;
      })();
      return error;
    },

    reset: baseStore.reset,
  };
}

export const loggingStore = createLoggingStore();
