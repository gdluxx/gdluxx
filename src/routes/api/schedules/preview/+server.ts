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
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import { parseJson } from '$lib/server/validation/zod';
import { schedulePreviewSchema } from '$lib/server/validation/schedules-validation';
import { computeNextOccurrence, describeRecurrence } from '$lib/server/schedules/recurrence';

const PREVIEW_OCCURRENCE_COUNT = 3;

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    if (!locals.user) {
      return createApiError('Not authenticated', 401);
    }

    const parseResult = await parseJson(request, schedulePreviewSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const occurrences: number[] = [];
    let cursor = Date.now();
    for (let i = 0; i < PREVIEW_OCCURRENCE_COUNT; i++) {
      const next = computeNextOccurrence(input, cursor);
      if (next === null) {
        break;
      }
      occurrences.push(next);
      cursor = next;
    }

    return createApiResponse({
      occurrences,
      recurrenceSummary: describeRecurrence(input.recurrence, input.startDate),
    });
  } catch (error) {
    return handleApiError(error as Error);
  }
};
