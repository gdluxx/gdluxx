/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { readJobOrigins, type JobOrigin } from '$lib/server/schedules/scheduleRunManager';
import type { JobListItem, JobScheduleOrigin } from '$lib/types/jobs';

// Session-only shaping — never wire this into jobsManager or the extension
// routes. scheduleId is gated to the schedule's owner: /schedules lists only
// the viewer's own schedules, so the link is a dead end for anyone else.
// scheduleName stays populated for every viewer — the jobs list already shows
// every job's URL to every user.
export function attachOrigins(jobs: JobListItem[], viewerId: string | undefined): JobListItem[] {
  const origins: Map<string, JobOrigin> = readJobOrigins(jobs.map((job) => job.id));
  return jobs.map((job) => {
    const origin = origins.get(job.id);
    if (!origin) {
      return job;
    }
    const scheduled: JobScheduleOrigin = {
      scheduleId:
        origin.scheduleId !== null && origin.ownerUserId === viewerId ? origin.scheduleId : null,
      scheduleName: origin.scheduleName,
    };
    return { ...job, origin: scheduled };
  });
}
