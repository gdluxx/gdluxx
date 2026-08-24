/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { jobManager } from '$lib/server/jobs/jobManager';
import type { RequestHandler } from './$types';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { attachOrigins } from '$lib/server/jobs/jobOrigins';
import { requireUser } from '$lib/server/auth/requireUser';

export const GET: RequestHandler = async ({ locals }): Promise<Response> => {
  const user = requireUser(locals);
  try {
    const summary = await jobManager.getJobsSummary();
    const recent = attachOrigins(summary.recent, user.id);

    const resp = createApiResponse({ ...summary, recent });
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
