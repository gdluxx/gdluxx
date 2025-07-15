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
import { logger } from '$lib/shared/logger';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { configUpdateSchema } from '$lib/server/validation/config-validation';
import { readConfigFile, writeConfigFile } from '$lib/server/config-utils';
import type { ConfigReadResult, ConfigWriteResult } from '$lib/server/config-utils';

export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const result: ConfigReadResult = await readConfigFile();
    return createApiResponse(result);
  } catch (error) {
    logger.error('Error reading config file:', error);
    return handleApiError(error as Error);
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const contentType = request.headers.get('content-type') || '';

    let content: string;

    if (contentType.includes('multipart/form-data')) {
      // Handling file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        throw new Error('No file uploaded');
      }

      if (!file.name.endsWith('.json')) {
        throw new Error('Only JSON files are allowed');
      }

      content = await file.text();
    } else {
      const body = await request.json();
      validateInput(body, configUpdateSchema);
      content = body.content;
    }

    const result: ConfigWriteResult = await writeConfigFile(content);
    return createApiResponse(result);
  } catch (error) {
    logger.error('Error saving file:', error);
    return handleApiError(error as Error);
  }
};
