/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { z } from 'zod';
import { createApiError } from '$lib/server/api-utils';
import { serverLogger as logger } from '$lib/server/logger';

export type ParseResult<T> = { data: T } | { errorResponse: Response };

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.join('.') || 'payload';
  return `${path}: ${issue.message}`;
}

function formatIssues(error: z.ZodError): string {
  if (!error.issues.length) {
    return 'Invalid request payload.';
  }

  if (error.issues.length === 1) {
    return describeIssue(error.issues[0]);
  }

  const messages = error.issues.map((issue) => `• ${describeIssue(issue)}`);
  return `Multiple validation errors:\n${messages.join('\n')}`;
}

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    logger.warn('Failed to parse JSON payload for request:', error);
    return { errorResponse: createApiError('Invalid JSON payload.', 400) };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = formatIssues(result.error);
    logger.warn(`Validation failed for request: ${message}`);
    return { errorResponse: createApiError(message, 400) };
  }

  return { data: result.data };
}
