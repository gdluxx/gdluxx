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
import {
  scheduleCreateSchema,
  MAX_SCHEDULES_PER_USER,
  MAX_SCHEDULE_URLS,
} from '$lib/server/validation/schedules-validation';
import { createSchedule, readSchedulesForUser } from '$lib/server/schedules/scheduleManager';
import { readLatestRunOutcomes } from '$lib/server/schedules/scheduleRunManager';
import { computeNextOccurrence, describeRecurrence } from '$lib/server/schedules/recurrence';
import {
  buildSiteOptionsSnapshot,
  maskSensitiveOptionPairs,
} from '$lib/server/schedules/snapshotService';
import { userSettingsManager } from '$lib/server/userSettingsManager';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }

    const schedules = readSchedulesForUser(user.id);
    const latestRuns = readLatestRunOutcomes(schedules.map((schedule) => schedule.id));

    const data = schedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      status: schedule.status,
      recurrenceSummary: describeRecurrence(schedule.recurrence, schedule.startDate),
      timezone: schedule.timezone,
      nextOccurrenceAt: schedule.nextOccurrenceAt,
      lastOccurrenceAt: schedule.lastOccurrenceAt,
      latestRun: latestRuns.get(schedule.id) ?? null,
    }));

    const response = createApiResponse(data);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }

    const parseResult = await parseJson(request, scheduleCreateSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    if (readSchedulesForUser(user.id).length >= MAX_SCHEDULES_PER_USER) {
      return createApiError(
        `You already have the maximum of ${MAX_SCHEDULES_PER_USER} schedules.`,
        400,
      );
    }

    const maxUrls = Math.min(
      MAX_SCHEDULE_URLS,
      userSettingsManager.getUserSettings(user.id).maxBatchUrls,
    );
    if (input.commandSource.urls.length > maxUrls) {
      return createApiError(`Schedule exceeds the allowed maximum of ${maxUrls} URLs.`, 400);
    }

    const now = Date.now();
    const nextOccurrenceAt = computeNextOccurrence(
      {
        recurrence: input.recurrence,
        timezone: input.timezone,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      now,
    );
    if (nextOccurrenceAt === null) {
      const message =
        input.recurrence.kind === 'once'
          ? 'start is in the past'
          : 'This recurrence has no occurrences after now.';
      return createApiError(message, 400);
    }

    const siteOptionsSnapshot = await buildSiteOptionsSnapshot(input.commandSource.urls);

    const schedule = createSchedule({
      userId: user.id,
      name: input.name,
      status: 'active',
      timezone: input.timezone,
      recurrence: input.recurrence,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      misfirePolicy: input.misfirePolicy,
      commandSource: input.commandSource,
      siteOptionsSnapshot,
      nextOccurrenceAt,
    });

    return createApiResponse({
      id: schedule.id,
      name: schedule.name,
      status: schedule.status,
      timezone: schedule.timezone,
      recurrence: schedule.recurrence,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      misfirePolicy: schedule.misfirePolicy,
      commandSource: {
        ...schedule.commandSource,
        userOptions: maskSensitiveOptionPairs(schedule.commandSource.userOptions),
      },
      siteOptionsSnapshot: Object.fromEntries(
        Object.entries(schedule.siteOptionsSnapshot).map(([url, pairs]) => [
          url,
          maskSensitiveOptionPairs(pairs),
        ]),
      ),
      nextOccurrenceAt: schedule.nextOccurrenceAt,
      lastOccurrenceAt: schedule.lastOccurrenceAt,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
