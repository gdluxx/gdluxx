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
