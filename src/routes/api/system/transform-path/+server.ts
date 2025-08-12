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
import { transformLogPathSafe } from '$lib/server/config-utils';
import { serverLogger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { path, type } = await request.json();

    if (!path || typeof path !== 'string') {
      return json({ error: 'Path is required and must be a string' }, { status: 400 });
    }

    if (type === 'log') {
      const result = transformLogPathSafe(path);
      return json({
        originalPath: path,
        transformedPath: result.path,
        wasTransformed: result.wasTransformed,
        warnings: result.warnings,
        errors: result.errors,
      });
    }

    return json({ error: 'Invalid type parameter. Only "log" is supported.' }, { status: 400 });
  } catch (error) {
    serverLogger.error('Failed to transform path:', error);
    return json({ error: 'Failed to transform path' }, { status: 500 });
  }
};
