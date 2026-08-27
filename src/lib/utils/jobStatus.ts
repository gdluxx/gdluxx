/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ClientJob } from '$lib/stores/jobs.svelte';

export interface StatusColorOptions {
  /**
   * When true, adds the heavier "list item" treatment (running pulse and a
   * more visible unknown-status fallback). Defaults to the plainer "modal
   * header" treatment used elsewhere.
   */
  emphasized?: boolean;
}

/**
 * Maps a job status to its indicator background color classes.
 *
 * Pass `{ emphasized: true }` to reproduce the JobsList list-item styling
 * (`animate-pulse` for running jobs, `bg-surface-sunken` for unknown
 * statuses). Without it, this reproduces the plainer JobOutputModal styling,
 * falling back to `bg-muted-foreground`.
 */
export function getStatusColor(
  status: ClientJob['status'],
  options: StatusColorOptions = {},
): string {
  const { emphasized = false } = options;

  switch (status) {
    case 'running':
      return emphasized ? 'bg-info animate-pulse' : 'bg-info';
    case 'success':
      return 'bg-success';
    case 'no_action':
      return 'bg-warning';
    case 'error':
      return 'bg-error';
    default:
      return emphasized ? 'bg-surface-sunken' : 'bg-muted-foreground';
  }
}

export function getStatusText(status: ClientJob['status']): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'success':
      return 'Success';
    case 'no_action':
      return 'Skips';
    case 'error':
      return 'Error';
    default:
      // eslint-disable-next-line no-console
      console.warn(
        `Unknown job status encountered: "${status}". This may indicate a data migration issue.`,
      );
      return 'Unknown';
  }
}
