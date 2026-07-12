/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { z } from 'zod';

const JOB_STATUSES = ['running', 'success', 'no_action', 'error'] as const;

const MAX_DELETE_IDS = 500;

export const jobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(z.enum(JOB_STATUSES)).optional()),
  sort: z.enum(['time', 'downloads']).default('time'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export type JobsQuery = z.infer<typeof jobsQuerySchema>;

export const jobsDeleteSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(MAX_DELETE_IDS).optional(),
    all: z.literal(true).optional(),
  })
  .refine((value) => (value.ids !== undefined) !== (value.all !== undefined), {
    message: 'Provide exactly one of "ids" or "all".',
  });

export type JobsDeletePayload = z.infer<typeof jobsDeleteSchema>;
