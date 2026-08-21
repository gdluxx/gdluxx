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
import { acknowledge } from '$lib/server/schedules/scheduleNotificationManager';

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return createApiError('Not authenticated', 401);
    }
    const notificationId = params.notificationId;
    if (!notificationId) {
      return createApiError('Not found', 404);
    }

    const notification = acknowledge(notificationId, user.id);
    if (!notification) {
      return createApiError('Not found', 404);
    }

    const { userId: _owner, ...shaped } = notification;
    return createApiResponse(shaped);
  } catch (error) {
    return handleApiError(error as Error);
  }
};
