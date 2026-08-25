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
import type { Recurrence } from '$lib/server/schedules/recurrence';
import { isOptionValueValidForWrite, validOptions } from '$lib/server/validation/option-validation';
import { isProhibitedOptionId } from '$lib/server/validation/exec-policy';

export const MAX_SCHEDULE_NAME_LENGTH = 100;
export const MAX_SCHEDULES_PER_USER = 100;
export const MAX_SCHEDULE_URLS = 100;
export const MIN_INTERVAL_MINUTES = 5;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_NOTIFICATION_DELETE_IDS = 500;

const URL_PATTERN = /^https?:\/\/.+/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const dateStringSchema = z.string().regex(DATE_PATTERN, 'Expected date in YYYY-MM-DD format.');
const timeSchema = z.string().regex(TIME_PATTERN, 'Expected time in HH:mm (24h) format.');

function isValidTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: 'Not a recognized IANA timezone.' });

// Every member is spelled out literally (rather than an intersection base)
// because Zod 4 discriminatedUnion introspects each member's literal
// discriminator directly.
const recurrenceUnionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), time: timeSchema }),
  z.object({
    kind: z.literal('interval'),
    time: timeSchema,
    unit: z.enum(['minutes', 'hours']),
    every: z.number().int().min(1),
  }),
  z.object({ kind: z.literal('daily'), time: timeSchema }),
  z.object({
    kind: z.literal('weekly'),
    time: timeSchema,
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .transform((days) => Array.from(new Set(days))),
  }),
  z.object({
    kind: z.literal('monthly'),
    time: timeSchema,
    dayOfMonth: z.number().int().min(1).max(31),
  }),
]);

export const recurrenceSchema = recurrenceUnionSchema.superRefine((value, ctx) => {
  if (value.kind === 'interval') {
    const totalMinutes = value.unit === 'minutes' ? value.every : value.every * 60;
    if (totalMinutes < MIN_INTERVAL_MINUTES) {
      ctx.addIssue({
        code: 'custom',
        message: `Interval must total at least ${MIN_INTERVAL_MINUTES} minutes.`,
        path: ['every'],
      });
    }
  }
});

type RecurrenceSchemaOutput = z.infer<typeof recurrenceSchema>;

// Compile-time drift guard between this schema and recurrence.ts's Recurrence union.
type IfEquals<T, U, Y = true, N = never> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N;
type RecurrenceParityCheck = IfEquals<RecurrenceSchemaOutput, Recurrence>;
const _recurrenceParityCheck: RecurrenceParityCheck = true;

const optionValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const keepSentinelSchema = z.object({ keep: z.literal(true) }).strict();

function isKeepSentinelValue(value: unknown): value is { keep: true } {
  return typeof value === 'object' && value !== null && (value as { keep?: unknown }).keep === true;
}

const urlListSchema = z
  .array(z.string().trim().regex(URL_PATTERN, 'Must be an http(s) URL.'))
  .min(1)
  .max(MAX_SCHEDULE_URLS);

// excludedOptions is not checked: it only removes ids from the merge and
// cannot add a flag
function rejectProhibitedOptionIds(
  value: { userOptions: Array<[string, unknown]> },
  ctx: z.RefinementCtx,
): void {
  value.userOptions.forEach(([optionId], index) => {
    if (isProhibitedOptionId(optionId)) {
      ctx.addIssue({
        code: 'custom',
        message: `"${optionId}" is not a permitted option.`,
        path: ['userOptions', index, 0],
      });
    }
  });
}

function rejectInvalidKnownOptionValues(
  value: { userOptions: Array<[string, unknown]> },
  ctx: z.RefinementCtx,
): void {
  value.userOptions.forEach(([optionId, optionValue], index) => {
    if (isKeepSentinelValue(optionValue)) {
      return;
    }
    const option = validOptions.get(optionId);
    if (!option) {
      return;
    }
    if (!isOptionValueValidForWrite(option, optionValue)) {
      ctx.addIssue({
        code: 'custom',
        message: `"${optionId}" has a value that is not valid for this option.`,
        path: ['userOptions', index, 1],
      });
    }
  });
}

const commandSourceCreateSchema = z
  .object({
    urls: urlListSchema,
    userOptions: z.array(z.tuple([z.string().min(1), optionValueSchema])),
    excludedOptions: z.array(z.string().min(1)),
  })
  .superRefine((value, ctx) => {
    rejectProhibitedOptionIds(value, ctx);
    rejectInvalidKnownOptionValues(value, ctx);
  });

// Sensitive sentinels are permitted here (update only); a superRefine below
// rejects one attached to a non-sensitive option id.
const commandSourceUpdateSchema = z
  .object({
    urls: urlListSchema,
    userOptions: z.array(
      z.tuple([z.string().min(1), z.union([optionValueSchema, keepSentinelSchema])]),
    ),
    excludedOptions: z.array(z.string().min(1)),
  })
  .superRefine((value, ctx) => {
    rejectProhibitedOptionIds(value, ctx);
    rejectInvalidKnownOptionValues(value, ctx);
    value.userOptions.forEach(([optionId, optionValue], index) => {
      if (isKeepSentinelValue(optionValue) && !validOptions.get(optionId)?.sensitive) {
        ctx.addIssue({
          code: 'custom',
          message: `"${optionId}" is not a sensitive option and cannot use a keep sentinel.`,
          path: ['userOptions', index, 1],
        });
      }
    });
  });

export const scheduleCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_SCHEDULE_NAME_LENGTH),
    timezone: timezoneSchema,
    recurrence: recurrenceSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional(),
    misfirePolicy: z.enum(['skip', 'catch_up']),
    commandSource: commandSourceCreateSchema,
  })
  .superRefine((value, ctx) => {
    if (value.endDate === undefined) {
      return;
    }
    if (value.recurrence.kind === 'once') {
      ctx.addIssue({
        code: 'custom',
        message: "endDate is not allowed for a 'once' schedule.",
        path: ['endDate'],
      });
      return;
    }
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'endDate must be on or after startDate.',
        path: ['endDate'],
      });
    }
  });

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;

// All fields optional; endDate/kind/startDate cross-field checks run in the
// route against merged stored+incoming values, not here.
export const scheduleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_SCHEDULE_NAME_LENGTH).optional(),
  timezone: timezoneSchema.optional(),
  recurrence: recurrenceSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.nullable().optional(),
  misfirePolicy: z.enum(['skip', 'catch_up']).optional(),
  commandSource: commandSourceUpdateSchema.optional(),
});

export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;

export const schedulePreviewSchema = z.object({
  recurrence: recurrenceSchema,
  timezone: timezoneSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema.optional(),
});

export type SchedulePreviewInput = z.infer<typeof schedulePreviewSchema>;

export const scheduleStatusSchema = z.object({
  status: z.enum(['active', 'paused']),
});

export type ScheduleStatusInput = z.infer<typeof scheduleStatusSchema>;

export const scheduleRunRequestSchema = z.object({
  notificationId: z.string().min(1).optional(),
});

export type ScheduleRunRequestInput = z.infer<typeof scheduleRunRequestSchema>;

export const scheduleRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ScheduleRunsQuery = z.infer<typeof scheduleRunsQuerySchema>;

export const scheduleNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  unread: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export type ScheduleNotificationsQuery = z.infer<typeof scheduleNotificationsQuerySchema>;

export const scheduleNotificationsDeleteSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(MAX_NOTIFICATION_DELETE_IDS).optional(),
    acknowledged: z.literal(true).optional(),
  })
  .refine((value) => (value.ids !== undefined) !== (value.acknowledged !== undefined), {
    message: 'Provide exactly one of "ids" or "acknowledged".',
  });

export type ScheduleNotificationsDeletePayload = z.infer<typeof scheduleNotificationsDeleteSchema>;
