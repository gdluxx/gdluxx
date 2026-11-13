/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { createMultiPageLoad } from '$lib/utils/page-load';
import { DEFAULT_SETTINGS } from '$lib/server/userSettingsManager';
import { DEFAULT_JOB_QUEUE_SETTINGS } from '$lib/server/jobQueueSettings';

const loadSettings = createMultiPageLoad({
  user: { endpoint: '/api/settings/user', fallback: DEFAULT_SETTINGS, errorMessage: 'Failed to load user settings' },
  queue: { endpoint: '/api/settings/job-queue', fallback: DEFAULT_JOB_QUEUE_SETTINGS, errorMessage: 'Failed to load queue settings' },
});

export const load = async (event: Parameters<typeof loadSettings>[0]) => {
  const result = await loadSettings(event) as Record<string, Record<string, unknown>>;
  const queue = result.queue ?? {};
  return {
    ...result.user,
    jobQueueSettings: {
      maxConcurrent: Number(queue.maxConcurrent ?? DEFAULT_JOB_QUEUE_SETTINGS.maxConcurrent),
      perHostEnabled: Boolean(queue.perHostEnabled ?? DEFAULT_JOB_QUEUE_SETTINGS.perHostEnabled),
      maxConcurrentPerHost: Number(queue.maxConcurrentPerHost ?? DEFAULT_JOB_QUEUE_SETTINGS.maxConcurrentPerHost),
      sameHostDelayMs: Number(queue.sameHostDelayMs ?? DEFAULT_JOB_QUEUE_SETTINGS.sameHostDelayMs),
    },
  };
};
