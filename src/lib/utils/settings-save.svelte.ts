/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { clientLogger as logger } from '$lib/client/logger';
import { toastStore } from '$lib/stores/toast';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface SettingsSaveOptions<T = unknown> {
  endpoint: string;
  method?: 'POST' | 'PATCH';
  body: unknown;
  /** Optimistically apply the new value. May be async e.g. also updates a side-effecting store */
  apply: () => void | Promise<void>;
  /** Revert to the previous value on failure. May be async. */
  rollback: () => void | Promise<void>;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  onSuccess?: (data: T | undefined) => void;
}

export interface SettingsSaver {
  readonly saving: boolean;
  save: <T = unknown>(options: SettingsSaveOptions<T>) => Promise<boolean>;
}

/**
 * Creates a per-call-site saver for the optimistic-update-with-rollback pattern used
 * throughout the settings pages: apply the change immediately, POST/PATCH it to the
 * server, and roll back if the server rejects it. Failures surface the server's exact
 * error message via a toast rather than a generic string.
 */
export function createSettingsSaver(): SettingsSaver {
  let saving = $state(false);

  async function save<T = unknown>(options: SettingsSaveOptions<T>): Promise<boolean> {
    const {
      endpoint,
      method = 'POST',
      body,
      apply,
      rollback,
      successTitle,
      successMessage,
      errorTitle = 'Settings Error',
      onSuccess,
    } = options;

    saving = true;

    try {
      await apply();

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload: ApiResponse<T> | null = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? `Server error: ${response.status}`);
      }

      if (successTitle) {
        toastStore.success(successTitle, successMessage);
      }
      onSuccess?.(payload.data);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      logger.error(`Failed to save settings (${endpoint}):`, error);
      await rollback();
      toastStore.error(errorTitle, message);
      return false;
    } finally {
      saving = false;
    }
  }

  return {
    get saving() {
      return saving;
    },
    save,
  };
}
