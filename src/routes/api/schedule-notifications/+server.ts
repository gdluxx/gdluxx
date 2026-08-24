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
  scheduleNotificationsQuerySchema,
  scheduleNotificationsDeleteSchema,
} from '$lib/server/validation/schedules-validation';
import { deleteForUser, readForUser } from '$lib/server/schedules/scheduleNotificationManager';

const QUERY_KEYS = ['limit', 'offset', 'unread'] as const;

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }

    const raw: Record<string, string> = {};
    for (const key of QUERY_KEYS) {
      const value = url.searchParams.get(key);
      if (value !== null) {
        raw[key] = value;
      }
    }

    const parsed = scheduleNotificationsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid query parameters.';
      return createApiError(message, 400);
    }
    const { limit, offset, unread } = parsed.data;

    const notifications = readForUser(user.id, { unreadOnly: unread, limit, offset }).map(
      ({ userId: _owner, ...notification }) => notification,
    );

    const response = createApiResponse({ notifications, limit, offset });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }

    const parseResult = await parseJson(request, scheduleNotificationsDeleteSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const payload = parseResult.data;

    const deletedCount = deleteForUser(
      user.id,
      payload.acknowledged ? { acknowledged: true } : { ids: payload.ids ?? [] },
    );

    return createApiResponse({ deletedCount });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
