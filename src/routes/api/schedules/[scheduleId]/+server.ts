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
  scheduleUpdateSchema,
  MAX_SCHEDULE_URLS,
} from '$lib/server/validation/schedules-validation';
import {
  deleteScheduleForUser,
  readScheduleForUser,
  updateSchedule,
  type Schedule,
  type ScheduleCommandSource,
  type UpdateScheduleFields,
} from '$lib/server/schedules/scheduleManager';
import { computeNextOccurrence } from '$lib/server/schedules/recurrence';
import {
  buildSiteOptionsSnapshot,
  maskSensitiveOptionPairs,
  mergeSensitiveOnUpdate,
} from '$lib/server/schedules/snapshotService';
import { userSettingsManager } from '$lib/server/userSettingsManager';

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

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }
    const scheduleId = params.scheduleId;
    if (!scheduleId) {
      return createApiError('Not found', 404);
    }

    const schedule = readScheduleForUser(scheduleId, user.id);
    if (!schedule) {
      return createApiError('Not found', 404);
    }

    const response = createApiResponse(toScheduleDetail(schedule));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const PUT: RequestHandler = async ({ request, params, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }
    const scheduleId = params.scheduleId;
    if (!scheduleId) {
      return createApiError('Not found', 404);
    }

    const stored = readScheduleForUser(scheduleId, user.id);
    if (!stored) {
      return createApiError('Not found', 404);
    }

    const parseResult = await parseJson(request, scheduleUpdateSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const incoming = parseResult.data;

    const effectiveRecurrence = incoming.recurrence ?? stored.recurrence;
    const effectiveStartDate = incoming.startDate ?? stored.startDate;
    const effectiveEndDate = incoming.endDate === undefined ? stored.endDate : incoming.endDate;

    if (effectiveEndDate !== null) {
      if (effectiveRecurrence.kind === 'once') {
        return createApiError("endDate is not allowed for a 'once' schedule.", 400);
      }
      if (effectiveEndDate < effectiveStartDate) {
        return createApiError('endDate must be on or after startDate.', 400);
      }
    }

    const fields: UpdateScheduleFields = {};
    if (incoming.name !== undefined) {
      fields.name = incoming.name;
    }
    if (incoming.timezone !== undefined) {
      fields.timezone = incoming.timezone;
    }
    if (incoming.recurrence !== undefined) {
      fields.recurrence = incoming.recurrence;
    }
    if (incoming.startDate !== undefined) {
      fields.startDate = incoming.startDate;
    }
    if (incoming.endDate !== undefined) {
      fields.endDate = incoming.endDate;
    }
    if (incoming.misfirePolicy !== undefined) {
      fields.misfirePolicy = incoming.misfirePolicy;
    }

    if (incoming.commandSource !== undefined) {
      const mergedCommandSource: ScheduleCommandSource = {
        urls: incoming.commandSource.urls,
        userOptions: mergeSensitiveOnUpdate(
          stored.commandSource.userOptions,
          incoming.commandSource.userOptions,
        ),
        excludedOptions: incoming.commandSource.excludedOptions,
      };

      const maxUrls = Math.min(
        MAX_SCHEDULE_URLS,
        userSettingsManager.getUserSettings(user.id).maxBatchUrls,
      );
      if (mergedCommandSource.urls.length > maxUrls) {
        return createApiError(`Schedule exceeds the allowed maximum of ${maxUrls} URLs.`, 400);
      }

      fields.commandSource = mergedCommandSource;
      fields.siteOptionsSnapshot = await buildSiteOptionsSnapshot(mergedCommandSource.urls);
    }

    const timingTouched =
      incoming.recurrence !== undefined ||
      incoming.timezone !== undefined ||
      incoming.startDate !== undefined ||
      incoming.endDate !== undefined;

    // Paused schedules keep nextOccurrenceAt NULL until an explicit resume;
    // recomputing here would violate that deferred-to-resume contract.
    if (timingTouched && stored.status !== 'paused') {
      const nextOccurrenceAt = computeNextOccurrence(
        {
          recurrence: effectiveRecurrence,
          timezone: incoming.timezone ?? stored.timezone,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate ?? undefined,
        },
        Date.now(),
      );
      fields.nextOccurrenceAt = nextOccurrenceAt;
      fields.status = nextOccurrenceAt === null ? 'completed' : 'active';
    }

    const updated = updateSchedule(scheduleId, user.id, fields);
    if (!updated) {
      return createApiError('Not found', 404);
    }

    return createApiResponse(toScheduleDetail(updated));
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }
    const scheduleId = params.scheduleId;
    if (!scheduleId) {
      return createApiError('Not found', 404);
    }

    const deleted = deleteScheduleForUser(scheduleId, user.id);
    if (!deleted) {
      return createApiError('Not found', 404);
    }

    return createApiResponse({
      deleted: true,
      message: 'Schedule deleted. Run history and notifications are retained.',
    });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
