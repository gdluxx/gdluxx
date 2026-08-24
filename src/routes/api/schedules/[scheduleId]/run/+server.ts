/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { createApiResponse, createApiError, handleApiError } from '$lib/server/api-utils';
import { parseJson } from '$lib/server/validation/zod';
import { scheduleRunRequestSchema } from '$lib/server/validation/schedules-validation';
import { readScheduleForUser } from '$lib/server/schedules/scheduleManager';
import {
  createRun,
  hasBlockingActivityForSchedule,
} from '$lib/server/schedules/scheduleRunManager';
import { acknowledge } from '$lib/server/schedules/scheduleNotificationManager';
import { dispatchRun, PROCESS_START_MS } from '$lib/server/schedules/dispatchRun';
import { launchUrls } from '$lib/server/jobs/commandLauncher';
import { userSettingsManager } from '$lib/server/userSettingsManager';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }
    const scheduleId = params.scheduleId;
    if (!scheduleId) {
      return createApiError('Not found', 404);
    }

    const parseResult = await parseJson(request, scheduleRunRequestSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const { notificationId } = parseResult.data;

    const schedule = readScheduleForUser(scheduleId, user.id);
    if (!schedule) {
      return createApiError('Not found', 404);
    }

    if (hasBlockingActivityForSchedule(scheduleId, PROCESS_START_MS)) {
      return createApiError('This schedule already has a run in progress.', 409);
    }

    const run = createRun({
      scheduleId: schedule.id,
      userId: user.id,
      scheduleName: schedule.name,
      trigger: notificationId ? 'recovery' : 'manual',
      outcome: 'dispatching',
      scheduledFor: Date.now(),
      urlCount: schedule.commandSource.urls.length,
    });

    const { results, outcome } = await dispatchRun(schedule, run.id, {
      launch: launchUrls,
      getMaxBatchUrls: (userId) => userSettingsManager.getUserSettings(userId).maxBatchUrls,
    });

    if (outcome === 'launched' && notificationId) {
      acknowledge(notificationId, user.id);
    }

    return createApiResponse({ overallSuccess: outcome === 'launched', results, runId: run.id });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
