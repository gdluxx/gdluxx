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
import type { RequestHandler } from './$types';
import { isRunningInDockerCached } from '$lib/server/environment';
import { serverLogger } from '$lib/server/logger';

export const GET: RequestHandler = async () => {
  try {
    const isDocker = isRunningInDockerCached();
    return json({ isDocker });
  } catch (error) {
    serverLogger.error('Failed to detect Docker environment:', error);
    return json({ isDocker: false });
  }
};
