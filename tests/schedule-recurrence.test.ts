/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { describe, expect, test } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  computeNextOccurrence,
  describeRecurrence,
  listMissedOccurrences,
  type RecurrenceInput,
} from '../src/lib/server/schedules/recurrence';

function zonedMs(y: number, m: number, d: number, h: number, min: number, tz: string): number {
  return Temporal.ZonedDateTime.from(
    { year: y, month: m, day: d, hour: h, minute: min, timeZone: tz },
    { disambiguation: 'compatible' },
  ).epochMilliseconds;
}

describe('once', () => {
  test('returns the single occurrence only when strictly after afterMs', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'once', time: '08:00' },
      timezone: 'UTC',
      startDate: '2026-05-01',
    };
    const occurrence = zonedMs(2026, 5, 1, 8, 0, 'UTC');

    expect(computeNextOccurrence(input, occurrence - 1)).toBe(occurrence);
    expect(computeNextOccurrence(input, occurrence)).toBeNull();
    expect(computeNextOccurrence(input, occurrence + 1)).toBeNull();
  });
});

describe('interval', () => {
  const step = 6 * 3_600_000;
  const input: RecurrenceInput = {
    recurrence: { kind: 'interval', time: '00:00', unit: 'hours', every: 6 },
    timezone: 'UTC',
    startDate: '2026-01-01',
  };
  const start = zonedMs(2026, 1, 1, 0, 0, 'UTC');

  test('afterMs before the start instant returns the start instant', () => {
    expect(computeNextOccurrence(input, start - 1)).toBe(start);
    expect(computeNextOccurrence(input, start - 1_000_000)).toBe(start);
  });

  test('floor arithmetic: next(after) = S + ceil((after - S + 1ms) / step) * step', () => {
    expect(computeNextOccurrence(input, start)).toBe(start + step);
    expect(computeNextOccurrence(input, start + step - 1)).toBe(start + step);
    expect(computeNextOccurrence(input, start + step)).toBe(start + 2 * step);
    expect(computeNextOccurrence(input, start + step + 1)).toBe(start + 2 * step);
  });

  test('phase stability after a simulated downtime gap', () => {
    // A system anchored at `start` goes down after the 4th occurrence and
    // resumes mid-interval; the next occurrence must stay on the
    // start-anchored grid rather than rephasing from the resume time.
    const resumeMs = start + 6 * step + Math.floor(step * 0.7);
    expect(computeNextOccurrence(input, resumeMs)).toBe(start + 7 * step);
  });
});

describe('daily', () => {
  const input: RecurrenceInput = {
    recurrence: { kind: 'daily', time: '09:15' },
    timezone: 'America/New_York',
    startDate: '2026-01-01',
  };

  test('wall-clock time each day in the schedule timezone', () => {
    const day1 = zonedMs(2026, 1, 1, 9, 15, 'America/New_York');
    const day2 = zonedMs(2026, 1, 2, 9, 15, 'America/New_York');
    const day3 = zonedMs(2026, 1, 3, 9, 15, 'America/New_York');

    expect(computeNextOccurrence(input, day1 - 1)).toBe(day1);
    expect(computeNextOccurrence(input, day1)).toBe(day2);
    expect(computeNextOccurrence(input, day2)).toBe(day3);
  });

  test('afterMs far before startDate anchors to the first occurrence on/after startDate', () => {
    const day1 = zonedMs(2026, 1, 1, 9, 15, 'America/New_York');
    expect(computeNextOccurrence(input, 0)).toBe(day1);
  });
});

describe('weekly', () => {
  const input: RecurrenceInput = {
    recurrence: { kind: 'weekly', time: '10:00', weekdays: [1, 3, 5] },
    timezone: 'UTC',
    startDate: '2026-01-01', // Thursday
  };

  // Mon/Wed/Fri from a Thursday start: Jan2(Fri), Jan5(Mon), Jan7(Wed),
  // Jan9(Fri), Jan12(Mon), Jan14(Wed) -- two Fri->Mon week-boundary jumps.
  const dates = [
    '2026-01-02',
    '2026-01-05',
    '2026-01-07',
    '2026-01-09',
    '2026-01-12',
    '2026-01-14',
  ];
  const occurrences = dates.map((date) => {
    const [y, m, d] = date.split('-').map(Number);
    return zonedMs(y, m, d, 10, 0, 'UTC');
  });

  test('multi-weekday ordering across week boundaries', () => {
    expect(computeNextOccurrence(input, 0)).toBe(occurrences[0]);
    for (let i = 0; i < occurrences.length - 1; i++) {
      expect(computeNextOccurrence(input, occurrences[i])).toBe(occurrences[i + 1]);
    }
  });
});

describe('monthly', () => {
  test('Jan 31 -> Feb 28 -> Mar 31 (non-leap year, day derived from stored dayOfMonth each month)', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'monthly', time: '08:00', dayOfMonth: 31 },
      timezone: 'UTC',
      startDate: '2026-01-01',
    };
    // Independently verified: Temporal.PlainDate daysInMonth for 2026-02 is 28.
    const jan31 = 1769846400000;
    const feb28 = 1772265600000;
    const mar31 = 1774944000000;

    expect(computeNextOccurrence(input, 0)).toBe(jan31);
    expect(computeNextOccurrence(input, jan31)).toBe(feb28);
    // Mar 31, not Mar 28: the clamp is derived from dayOfMonth + the target
    // month, never from the previous (clamped) occurrence.
    expect(computeNextOccurrence(input, feb28)).toBe(mar31);
  });

  test('Jan 31 -> Feb 29 -> Mar 31 (leap year)', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'monthly', time: '08:00', dayOfMonth: 31 },
      timezone: 'UTC',
      startDate: '2028-01-01',
    };
    // Independently verified: Temporal.PlainDate daysInMonth for 2028-02 is 29.
    const jan31 = 1832918400000;
    const feb29 = 1835424000000;
    const mar31 = 1838102400000;

    expect(computeNextOccurrence(input, 0)).toBe(jan31);
    expect(computeNextOccurrence(input, jan31)).toBe(feb29);
    expect(computeNextOccurrence(input, feb29)).toBe(mar31);
  });
});

describe('endDate inclusivity (calendar-date comparison in the schedule timezone)', () => {
  test('America/New_York: a 21:00 local occurrence on endDate qualifies though its UTC date is the next day', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'daily', time: '21:00' },
      timezone: 'America/New_York',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    };
    // Independently verified: 2026-06-15T21:00 America/New_York is
    // 2026-06-16T01:00Z -- UTC date is the day *after* endDate.
    const jun15 = 1781571600000;

    expect(computeNextOccurrence(input, jun15 - 1)).toBe(jun15);
    // The following day's occurrence exists in wall-clock terms but its
    // local calendar date (Jun 16) is past endDate, so it is excluded.
    expect(computeNextOccurrence(input, jun15)).toBeNull();
  });

  test('Australia/Sydney: an occurrence past endDate is excluded even though its UTC date still equals endDate', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'daily', time: '05:00' },
      timezone: 'Australia/Sydney',
      startDate: '2026-07-01',
      endDate: '2026-07-15',
    };
    // Independently verified: 2026-07-15T05:00 Australia/Sydney (+10:00) is
    // 2026-07-14T19:00Z; 2026-07-16T05:00 Australia/Sydney is
    // 2026-07-15T19:00Z -- UTC date 2026-07-15, equal to endDate, yet the
    // occurrence's LOCAL date (Jul 16) is past endDate and must be excluded.
    // A naive UTC-date comparison would wrongly include it.
    const jul15 = 1784055600000;

    expect(computeNextOccurrence(input, jul15 - 1)).toBe(jul15);
    expect(computeNextOccurrence(input, jul15)).toBeNull();
  });
});

describe('DST', () => {
  test('spring-forward: daily 02:30 America/New_York fires at 03:30 on the gap day', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'daily', time: '02:30' },
      timezone: 'America/New_York',
      startDate: '2026-03-01',
    };
    const mar7 = zonedMs(2026, 3, 7, 2, 30, 'America/New_York');
    // Independently verified: 2026-03-08 is the US spring-forward date;
    // 'compatible' disambiguation resolves the nonexistent 02:30 wall time
    // forward by the one-hour gap to 03:30-04:00.
    const gapDayOccurrence = 1772955000000;

    expect(computeNextOccurrence(input, mar7)).toBe(gapDayOccurrence);

    const resolved =
      Temporal.Instant.fromEpochMilliseconds(gapDayOccurrence).toZonedDateTimeISO(
        'America/New_York',
      );
    expect(resolved.hour).toBe(3);
    expect(resolved.minute).toBe(30);
    expect(resolved.offset).toBe('-04:00');
  });

  test('fall-back: exactly one occurrence, at the earlier repeated instant', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'daily', time: '01:30' },
      timezone: 'America/New_York',
      startDate: '2026-10-30',
    };
    const oct31 = zonedMs(2026, 10, 31, 1, 30, 'America/New_York');
    // Independently verified: 2026-11-01 is the US fall-back date; 01:30
    // occurs twice (-04:00 then -05:00). 'compatible' picks the earlier.
    const earlierInstant = 1793511000000;
    const laterInstant = 1793514600000;

    expect(computeNextOccurrence(input, oct31)).toBe(earlierInstant);
    expect(computeNextOccurrence(input, oct31)).not.toBe(laterInstant);

    const resolved =
      Temporal.Instant.fromEpochMilliseconds(earlierInstant).toZonedDateTimeISO('America/New_York');
    expect(resolved.offset).toBe('-04:00');

    // Only one fire on the fall-back day: the next occurrence is Nov 2, not
    // a second Nov 1 instant at the later (-05:00) offset.
    const nov2 = zonedMs(2026, 11, 2, 1, 30, 'America/New_York');
    expect(computeNextOccurrence(input, earlierInstant)).toBe(nov2);
  });
});

describe('listMissedOccurrences', () => {
  const step = 3_600_000;
  const input: RecurrenceInput = {
    recurrence: { kind: 'interval', time: '00:00', unit: 'hours', every: 1 },
    timezone: 'UTC',
    startDate: '2026-01-01',
  };
  const start = zonedMs(2026, 1, 1, 0, 0, 'UTC');

  test('window is (from, until] -- exclusive from, inclusive until', () => {
    const result = listMissedOccurrences(input, start, start + 3 * step, 10);
    expect(result.occurrences).toEqual([start + step, start + 2 * step, start + 3 * step]);
    expect(result.truncated).toBe(false);
  });

  test('excludes the `from` boundary itself even when it is exactly an occurrence', () => {
    const from = start + 2 * step;
    const result = listMissedOccurrences(input, from, start + 4 * step, 10);
    expect(result.occurrences).toEqual([start + 3 * step, start + 4 * step]);
  });

  test('cap truncates and sets truncated when more occurrences remain in-window', () => {
    const result = listMissedOccurrences(input, start, start + 5 * step, 3);
    expect(result.occurrences).toEqual([start + step, start + 2 * step, start + 3 * step]);
    expect(result.truncated).toBe(true);
  });

  test('not truncated when the window is exhausted exactly at the cap', () => {
    const result = listMissedOccurrences(input, start, start + 3 * step, 3);
    expect(result.occurrences).toEqual([start + step, start + 2 * step, start + 3 * step]);
    expect(result.truncated).toBe(false);
  });

  test('cap of 0 returns no occurrences but still reports truncation', () => {
    const result = listMissedOccurrences(input, start, start + step, 0);
    expect(result.occurrences).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  test('empty window (nothing due) returns empty and not truncated', () => {
    const result = listMissedOccurrences(input, start + 10 * step, start + 10 * step, 10);
    expect(result.occurrences).toEqual([]);
    expect(result.truncated).toBe(false);
  });
});

describe('exhausted recurrences', () => {
  test('once already fired returns null', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'once', time: '08:00' },
      timezone: 'UTC',
      startDate: '2026-01-01',
    };
    const occurrence = zonedMs(2026, 1, 1, 8, 0, 'UTC');
    expect(computeNextOccurrence(input, occurrence)).toBeNull();
  });

  test('past endDate returns null for a recurring kind', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'daily', time: '08:00' },
      timezone: 'UTC',
      startDate: '2026-01-01',
      endDate: '2026-01-05',
    };
    const lastValid = zonedMs(2026, 1, 5, 8, 0, 'UTC');
    expect(computeNextOccurrence(input, lastValid)).toBeNull();
  });

  test('listMissedOccurrences on an exhausted recurrence returns empty and non-truncated, never throws', () => {
    const input: RecurrenceInput = {
      recurrence: { kind: 'once', time: '08:00' },
      timezone: 'UTC',
      startDate: '2026-01-01',
    };
    const occurrence = zonedMs(2026, 1, 1, 8, 0, 'UTC');
    const result = listMissedOccurrences(input, occurrence, occurrence + 1_000_000_000, 10);
    expect(result).toEqual({ occurrences: [], truncated: false });
  });
});

describe('describeRecurrence', () => {
  test('produces a human-readable summary per kind', () => {
    expect(describeRecurrence({ kind: 'interval', time: '00:00', unit: 'hours', every: 6 })).toBe(
      'Every 6 hours',
    );
    expect(describeRecurrence({ kind: 'interval', time: '00:00', unit: 'hours', every: 1 })).toBe(
      'Every 1 hour',
    );
    expect(describeRecurrence({ kind: 'daily', time: '02:30' })).toBe('Daily at 02:30');
    expect(describeRecurrence({ kind: 'weekly', time: '08:00', weekdays: [5, 1, 3] })).toBe(
      'Weekly on Mon, Wed, Fri at 08:00',
    );
    expect(describeRecurrence({ kind: 'monthly', time: '08:00', dayOfMonth: 31 })).toBe(
      'Monthly on day 31 at 08:00',
    );
    expect(describeRecurrence({ kind: 'once', time: '08:00' }, '2026-08-20')).toBe(
      'Once on Aug 20, 2026 at 08:00',
    );
  });
});
