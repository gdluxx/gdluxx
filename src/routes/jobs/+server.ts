/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json } from '@sveltejs/kit';
import { type Job, jobManager } from '$lib/server/jobManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (): Promise<Response> => {
  const jobs: Job[] = await jobManager.getAllJobs();
  return json({ success: true, jobs });
};