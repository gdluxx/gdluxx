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
import { scheduleStatusSchema } from '$lib/server/validation/schedules-validation';
import {
  readScheduleForUser,
  setScheduleStatus,
  type Schedule,
} from '$lib/server/schedules/scheduleManager';
import { computeNextOccurrence } from '$lib/server/schedules/recurrence';
import { maskSensitiveOptionPairs } from '$lib/server/schedules/snapshotService';

function toScheduleDetail(schedule: Schedule) {
  return {
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
  };
}

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

    const parseResult = await parseJson(request, scheduleStatusSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const { status: requestedStatus } = parseResult.data;

    const schedule = readScheduleForUser(scheduleId, user.id);
    if (!schedule) {
      return createApiError('Not found', 404);
    }

    if (requestedStatus === 'paused') {
      if (schedule.status === 'completed') {
        return createApiError('Cannot pause a completed schedule.', 400);
      }
      const updated = setScheduleStatus(scheduleId, user.id, {
        status: 'paused',
        nextOccurrenceAt: null,
      });
      if (!updated) {
        return createApiError('Not found', 404);
      }
      return createApiResponse(toScheduleDetail(updated));
    }

    const nextOccurrenceAt = computeNextOccurrence(
      {
        recurrence: schedule.recurrence,
        timezone: schedule.timezone,
        startDate: schedule.startDate,
        endDate: schedule.endDate ?? undefined,
      },
      Date.now(),
    );

    if (nextOccurrenceAt === null && schedule.status === 'completed') {
      return createApiResponse(toScheduleDetail(schedule));
    }

    const updated = setScheduleStatus(scheduleId, user.id, {
      status: nextOccurrenceAt === null ? 'completed' : 'active',
      nextOccurrenceAt,
    });
    if (!updated) {
      return createApiError('Not found', 404);
    }
    return createApiResponse(toScheduleDetail(updated));
  } catch (error) {
    return handleApiError(error as Error);
  }
};
