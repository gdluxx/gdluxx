/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

process.env.TZ = 'UTC';

import { describe, expect, test } from 'vitest';
import {
  formatPastTime,
  formatUpcomingTime,
  formatZonedTime,
  zonesShareOffset,
} from '../src/lib/utils/relativeTime';

describe('formatUpcomingTime', () => {
  const now = Date.UTC(2026, 7, 21, 9, 0); // Fri Aug 21 2026 09:00 UTC

  test('same calendar day: "Today at HH:mm"', () => {
    const timestamp = Date.UTC(2026, 7, 21, 14, 30);
    expect(formatUpcomingTime(timestamp, now)).toBe('Today at 14:30');
  });

  test('next calendar day: "Tomorrow at HH:mm"', () => {
    const timestamp = Date.UTC(2026, 7, 22, 9, 0);
    expect(formatUpcomingTime(timestamp, now)).toBe('Tomorrow at 09:00');
  });

  test('later this year: weekday, month, day at HH:mm (no year suffix)', () => {
    const timestamp = Date.UTC(2026, 7, 25, 9, 0); // Tue Aug 25 2026
    expect(formatUpcomingTime(timestamp, now)).toBe('Tue, Aug 25 at 09:00');
  });

  test('a future year: weekday, month, day, year at HH:mm', () => {
    const timestamp = Date.UTC(2027, 0, 5, 9, 0); // Tue Jan 5 2027
    expect(formatUpcomingTime(timestamp, now)).toBe('Tue, Jan 5, 2027 at 09:00');
  });
});

describe('formatPastTime', () => {
  test('under 7 days: relative phrasing, matching real wall-clock (no fake timers)', () => {
    const now = Date.now();
    const timestamp = now - 2 * 60 * 60 * 1000; // 2 hours ago, safely inside the bucket
    expect(formatPastTime(timestamp, now)).toBe('2 hours ago');
  });

  test('7 days or older, same year: absolute "Mon D at HH:mm" (no year suffix)', () => {
    const now = Date.UTC(2026, 7, 21, 9, 0);
    const timestamp = now - 8 * 24 * 60 * 60 * 1000; // Aug 13 2026 09:00 UTC
    expect(formatPastTime(timestamp, now)).toBe('Aug 13 at 09:00');
  });

  test('older, different year: absolute "Mon D, YYYY at HH:mm"', () => {
    const now = Date.UTC(2026, 7, 21, 9, 0);
    const timestamp = Date.UTC(2025, 7, 13, 18, 12);
    expect(formatPastTime(timestamp, now)).toBe('Aug 13, 2025 at 18:12');
  });
});

describe('formatZonedTime', () => {
  test('formats with a short zone-name suffix', () => {
    const timestamp = Date.UTC(2026, 7, 21, 13, 0); // 09:00 EDT
    expect(formatZonedTime(timestamp, 'America/New_York')).toBe('Aug 21, 09:00 EDT');
  });
});

describe('zonesShareOffset', () => {
  const at = Date.UTC(2026, 7, 21, 12, 0);

  test('IANA aliases compare equal by offset, not id: UTC vs Etc/UTC', () => {
    expect(zonesShareOffset('UTC', 'Etc/UTC', at)).toBe(true);
  });

  test('Asia/Calcutta vs Asia/Kolkata (renamed alias) compare equal', () => {
    expect(zonesShareOffset('Asia/Calcutta', 'Asia/Kolkata', at)).toBe(true);
  });

  test('different offsets compare unequal: America/New_York vs Europe/Berlin', () => {
    expect(zonesShareOffset('America/New_York', 'Europe/Berlin', at)).toBe(false);
  });
});
