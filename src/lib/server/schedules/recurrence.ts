/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { Temporal } from '@js-temporal/polyfill';

export interface RecurrenceOnce {
  kind: 'once';
  time: string;
}

export interface RecurrenceInterval {
  kind: 'interval';
  time: string;
  unit: 'minutes' | 'hours';
  every: number;
}

export interface RecurrenceDaily {
  kind: 'daily';
  time: string;
}

export interface RecurrenceWeekly {
  kind: 'weekly';
  time: string;
  weekdays: number[];
}

export interface RecurrenceMonthly {
  kind: 'monthly';
  time: string;
  dayOfMonth: number;
}

export type Recurrence =
  | RecurrenceOnce
  | RecurrenceInterval
  | RecurrenceDaily
  | RecurrenceWeekly
  | RecurrenceMonthly;

export interface RecurrenceInput {
  recurrence: Recurrence;
  timezone: string;
  startDate: string;
  endDate?: string;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

function zonedInstantMs(
  date: Temporal.PlainDate,
  time: { hour: number; minute: number },
  timezone: string,
): number {
  return Temporal.ZonedDateTime.from(
    {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute,
      timeZone: timezone,
    },
    { disambiguation: 'compatible' },
  ).epochMilliseconds;
}

function calendarDateOfMs(ms: number, timezone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timezone).toPlainDate();
}

function daysInMonthOf(year: number, month: number): number {
  return Temporal.PlainDate.from({ year, month, day: 1 }).daysInMonth;
}

function nextOnce(
  recurrence: RecurrenceOnce,
  timezone: string,
  startDate: string,
  afterMs: number,
): number | null {
  const occurrence = zonedInstantMs(
    Temporal.PlainDate.from(startDate),
    parseTime(recurrence.time),
    timezone,
  );
  return occurrence > afterMs ? occurrence : null;
}

function nextInterval(
  recurrence: RecurrenceInterval,
  timezone: string,
  startDate: string,
  afterMs: number,
): number {
  const start = zonedInstantMs(
    Temporal.PlainDate.from(startDate),
    parseTime(recurrence.time),
    timezone,
  );
  const stepMs = recurrence.every * (recurrence.unit === 'minutes' ? 60_000 : 3_600_000);
  if (afterMs < start) {
    return start;
  }
  // Anchored on `start`, not the previous occurrence: pure epoch-ms duration
  // math, so DST wall-clock shifts never perturb the cadence.
  return start + Math.ceil((afterMs - start + 1) / stepMs) * stepMs;
}

function nextByDayMatcher(
  time: { hour: number; minute: number },
  timezone: string,
  startDate: string,
  afterMs: number,
  matches: (date: Temporal.PlainDate) => boolean,
  maxIterations: number,
): number {
  const start = Temporal.PlainDate.from(startDate);
  const afterDate = calendarDateOfMs(afterMs, timezone);
  let candidate = Temporal.PlainDate.compare(afterDate, start) > 0 ? afterDate : start;

  for (let i = 0; i < maxIterations; i++) {
    if (matches(candidate)) {
      const occurrence = zonedInstantMs(candidate, time, timezone);
      if (occurrence > afterMs) {
        return occurrence;
      }
    }
    candidate = candidate.add({ days: 1 });
  }
  throw new Error(`no matching occurrence found within ${maxIterations} days`);
}

function nextDaily(
  recurrence: RecurrenceDaily,
  timezone: string,
  startDate: string,
  afterMs: number,
): number {
  return nextByDayMatcher(parseTime(recurrence.time), timezone, startDate, afterMs, () => true, 3);
}

function nextWeekly(
  recurrence: RecurrenceWeekly,
  timezone: string,
  startDate: string,
  afterMs: number,
): number {
  const weekdays = new Set(recurrence.weekdays);
  return nextByDayMatcher(
    parseTime(recurrence.time),
    timezone,
    startDate,
    afterMs,
    (date) => weekdays.has(date.dayOfWeek),
    8,
  );
}

function nextMonthly(
  recurrence: RecurrenceMonthly,
  timezone: string,
  startDate: string,
  afterMs: number,
): number {
  const time = parseTime(recurrence.time);
  const start = Temporal.PlainDate.from(startDate);
  const afterDate = calendarDateOfMs(afterMs, timezone);
  const base = Temporal.PlainDate.compare(afterDate, start) > 0 ? afterDate : start;

  let year = base.year;
  let month = base.month;
  const maxIterations = 24;
  for (let i = 0; i < maxIterations; i++) {
    const day = Math.min(recurrence.dayOfMonth, daysInMonthOf(year, month));
    const candidateDate = Temporal.PlainDate.from({ year, month, day });
    const occurrence = zonedInstantMs(candidateDate, time, timezone);
    if (occurrence > afterMs && Temporal.PlainDate.compare(candidateDate, start) >= 0) {
      return occurrence;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  throw new Error(`no matching monthly occurrence found within ${maxIterations} months`);
}

function rawNextOccurrence(input: RecurrenceInput, afterMs: number): number | null {
  const { recurrence, timezone, startDate } = input;
  switch (recurrence.kind) {
    case 'once':
      return nextOnce(recurrence, timezone, startDate, afterMs);
    case 'interval':
      return nextInterval(recurrence, timezone, startDate, afterMs);
    case 'daily':
      return nextDaily(recurrence, timezone, startDate, afterMs);
    case 'weekly':
      return nextWeekly(recurrence, timezone, startDate, afterMs);
    case 'monthly':
      return nextMonthly(recurrence, timezone, startDate, afterMs);
  }
}

function withinEndDate(
  occurrenceMs: number,
  timezone: string,
  endDate: string | undefined,
): boolean {
  if (endDate === undefined) {
    return true;
  }
  // Calendar-date comparison in the schedule's own timezone, never epoch ms:
  // a 21:00 local occurrence on endDate is UTC-next-day but still qualifies.
  const occurrenceDate = calendarDateOfMs(occurrenceMs, timezone);
  return Temporal.PlainDate.compare(occurrenceDate, Temporal.PlainDate.from(endDate)) <= 0;
}

export function computeNextOccurrence(input: RecurrenceInput, afterMs: number): number | null {
  const raw = rawNextOccurrence(input, afterMs);
  if (raw === null) {
    return null;
  }
  return withinEndDate(raw, input.timezone, input.endDate) ? raw : null;
}

export function listMissedOccurrences(
  input: RecurrenceInput,
  fromMs: number,
  untilMs: number,
  cap: number,
): { occurrences: number[]; truncated: boolean } {
  const occurrences: number[] = [];
  let cursor = fromMs;

  while (occurrences.length < cap) {
    const next = computeNextOccurrence(input, cursor);
    if (next === null || next > untilMs) {
      return { occurrences, truncated: false };
    }
    occurrences.push(next);
    cursor = next;
  }

  const overflow = computeNextOccurrence(input, cursor);
  const truncated = overflow !== null && overflow <= untilMs;
  return { occurrences, truncated };
}

function formatOnceDate(startDate: string): string {
  return Temporal.PlainDate.from(startDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function describeRecurrence(recurrence: Recurrence, startDate?: string): string {
  switch (recurrence.kind) {
    case 'once': {
      if (startDate === undefined) {
        throw new Error("describeRecurrence: startDate is required for 'once' recurrences");
      }
      return `Once on ${formatOnceDate(startDate)} at ${recurrence.time}`;
    }
    case 'interval': {
      const unit = recurrence.unit === 'minutes' ? 'minute' : 'hour';
      const plural = recurrence.every === 1 ? unit : `${unit}s`;
      return `Every ${recurrence.every} ${plural}`;
    }
    case 'daily':
      return `Daily at ${recurrence.time}`;
    case 'weekly': {
      const labels = [...recurrence.weekdays]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_LABELS[day - 1])
        .join(', ');
      return `Weekly on ${labels} at ${recurrence.time}`;
    }
    case 'monthly':
      return `Monthly on day ${recurrence.dayOfMonth} at ${recurrence.time}`;
  }
}
