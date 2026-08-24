/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestHandler } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { parseJson } from '$lib/server/validation/zod';
import { configMergeSchema } from '$lib/server/validation/config-merge-validation';
import { readConfigFile, writeConfigFile } from '$lib/server/config-utils';
import { mergeIntoConfigText } from '$lib/server/config-merge';
import { requireUser } from '$lib/server/auth/requireUser';

export const POST: RequestHandler = async ({ request, locals }): Promise<Response> => {
  requireUser(locals);
  try {
    const parseResult = await parseJson(request, configMergeSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }

    const { path, value, overwrite } = parseResult.data;

    const { content } = await readConfigFile();
    const merge = mergeIntoConfigText(content, path, value);

    if (merge.existed && !overwrite) {
      return createApiResponse({
        merged: false,
        exists: true,
        currentValue: merge.currentValue,
      });
    }

    await writeConfigFile(merge.text);

    return createApiResponse({
      merged: true,
      action: merge.existed ? 'replaced' : 'created',
    });
  } catch (error) {
    logger.error('Error merging config value:', error);
    return handleApiError(error);
  }
};
