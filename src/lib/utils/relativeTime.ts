/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Formats a timestamp as a coarse, human-readable relative time string
 * (e.g. "just now", "5 min ago", "2 hours ago", "3 days ago").
 * Falls back to a locale date string once the difference exceeds a week.
 */
export function formatRelativeTime(timestamp: number | string | Date): string {
  const then = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diffMs = Date.now() - then.getTime();

  if (Number.isNaN(diffMs)) {
    return 'Unknown';
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 0) {
    return 'just now';
  }
  if (seconds < 45) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return then.toLocaleDateString();
}

function hhmm(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Formats an upcoming timestamp in the viewer's local zone: "Today at 09:00",
 * "Tomorrow at 09:00", or "Sat, Aug 22 at 09:00" (plus ", YYYY" when
 * `timestamp` falls outside `now`'s calendar year).
 */
export function formatUpcomingTime(timestamp: number, now: number): string {
  const target = new Date(timestamp);
  const reference = new Date(now);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(reference)) / (24 * 60 * 60 * 1000));
  const time = hhmm(target);

  if (dayDiff === 0) {
    return `Today at ${time}`;
  }
  if (dayDiff === 1) {
    return `Tomorrow at ${time}`;
  }

  const yearSuffix =
    target.getFullYear() === reference.getFullYear() ? '' : `, ${target.getFullYear()}`;
  const weekdayMonthDay = target.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${weekdayMonthDay}${yearSuffix} at ${time}`;
}

/**
 * Formats a past timestamp: relative ("2 hours ago") under 7 days, otherwise
 * an absolute "Aug 13 at 18:12" — never a bare date, so a past run always
 * carries the time it happened.
 */
export function formatPastTime(timestamp: number, now: number): string {
  const days = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));

  if (days < 7) {
    return formatRelativeTime(timestamp);
  }

  const target = new Date(timestamp);
  const yearSuffix =
    target.getFullYear() === new Date(now).getFullYear() ? '' : `, ${target.getFullYear()}`;
  const monthDay = target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${monthDay}${yearSuffix} at ${hhmm(target)}`;
}

/**
 * Formats a timestamp in an explicit IANA zone with a short zone-name suffix,
 * e.g. "Aug 21, 09:00 EDT".
 */
export function formatZonedTime(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).formatToParts(new Date(timestamp));

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} ${get('timeZoneName')}`;
}

function utcOffsetAt(timeZone: string, at: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(at));
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
}

/**
 * Compares two IANA zones by UTC offset at a given instant, not id equality,
 * so aliases (UTC vs Etc/UTC, Asia/Calcutta vs Asia/Kolkata) compare equal.
 */
export function zonesShareOffset(tzA: string, tzB: string, at: number): boolean {
  return utcOffsetAt(tzA, at) === utcOffsetAt(tzB, at);
}
