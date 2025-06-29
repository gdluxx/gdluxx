/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { type Job, jobManager } from '$lib/server/jobManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }: RequestEvent): Promise<Response> => {
  const { jobId } = params;

  if (!jobId) {
    return json({ success: false, error: 'Job ID is required' }, { status: 400 });
  }

  const job: Job | undefined = await jobManager.getJob(jobId);
  if (!job) {
    return json({ success: false, error: 'Job not found' }, { status: 404 });
  }

  const { process: _process, subscribers: _subscribers, ...jobData } = job;
  return json({ success: true, job: jobData });
};

export const DELETE: RequestHandler = async ({ params }: RequestEvent): Promise<Response> => {
  const { jobId } = params;

  if (!jobId) {
    return json({ success: false, error: 'Job ID is required' }, { status: 400 });
  }

  const deleted: boolean = await jobManager.deleteJob(jobId);

  if (!deleted) {
    return json({ success: false, error: 'Job not found' }, { status: 404 });
  }

  return json({ success: true, message: 'Job deleted successfully' });
};
