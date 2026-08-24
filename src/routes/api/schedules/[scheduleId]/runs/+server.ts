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
import { scheduleRunsQuerySchema } from '$lib/server/validation/schedules-validation';
import { readScheduleForUser } from '$lib/server/schedules/scheduleManager';
import { readRunsForSchedule } from '$lib/server/schedules/scheduleRunManager';

const QUERY_KEYS = ['limit', 'offset'] as const;

export const GET: RequestHandler = async ({ params, url, locals }) => {
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

    const raw: Record<string, string> = {};
    for (const key of QUERY_KEYS) {
      const value = url.searchParams.get(key);
      if (value !== null) {
        raw[key] = value;
      }
    }

    const parsed = scheduleRunsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid query parameters.';
      return createApiError(message, 400);
    }
    const { limit, offset } = parsed.data;

    const runs = readRunsForSchedule(scheduleId, user.id, { limit, offset }).map(
      ({ userId: _owner, ...run }) => run,
    );

    const response = createApiResponse({ runs, limit, offset });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
