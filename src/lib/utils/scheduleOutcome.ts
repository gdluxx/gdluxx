/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ScheduleRunOutcome } from '$lib/types/schedules';

export const OUTCOME_LABELS: Record<ScheduleRunOutcome, string> = {
  dispatching: 'Dispatching',
  launched: 'Launched',
  partial: 'Partial',
  launch_failed: 'Launch failed',
  skipped_overlap: 'Skipped (overlap)',
  skipped_misfire: 'Skipped (misfire)',
};

export function outcomeDotClass(outcome: ScheduleRunOutcome): string {
  switch (outcome) {
    case 'launched':
      return 'bg-success';
    case 'partial':
    case 'skipped_overlap':
    case 'skipped_misfire':
      return 'bg-warning';
    case 'launch_failed':
      return 'bg-error';
    case 'dispatching':
      return 'bg-info';
  }
}

export function outcomeTextClass(outcome: ScheduleRunOutcome): string {
  switch (outcome) {
    case 'launch_failed':
      return 'text-error';
    case 'partial':
    case 'skipped_overlap':
    case 'skipped_misfire':
      return 'text-warning';
    case 'launched':
    case 'dispatching':
      return 'text-muted-foreground';
  }
}

export function outcomeChipVariant(
  outcome: ScheduleRunOutcome,
): 'success' | 'warning' | 'danger' | 'info' {
  switch (outcome) {
    case 'dispatching':
      return 'info';
    case 'launched':
      return 'success';
    case 'partial':
    case 'skipped_overlap':
    case 'skipped_misfire':
      return 'warning';
    case 'launch_failed':
      return 'danger';
  }
}
