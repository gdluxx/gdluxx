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
import { validateInput } from '$lib/server/validation-utils';
import { configUpdateSchema } from '$lib/server/config-validation';
import { readConfigFile, writeConfigFile } from '$lib/server/config-utils';


export const GET: RequestHandler = async (): Promise<Response> => {
  try {
    const result = await readConfigFile();
    return createApiResponse(result);
  } catch (error) {
    logger.error('Error reading config file:', error);
    return handleApiError(error as Error);
  }
};

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
  try {
    const body = await request.json();
    
    validateInput(body, configUpdateSchema);
    
    const { content } = body;

    const result = await writeConfigFile(content);
    return createApiResponse(result);
  } catch (error) {
    logger.error('Error saving file:', error);
    return handleApiError(error as Error);
  }
};