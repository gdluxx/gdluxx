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
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validateInput } from '$lib/server/validation/validation-utils';
import { createApiResponse, createApiError, handleApiError } from '$lib/server/api-utils';
import { siteConfigSchema } from '$lib/server/validation/site-config-validation';
import { serverLogger as logger } from '$lib/server/logger';

export const GET: RequestHandler = async () => {
  try {
    const configs = await siteConfigManager.getSiteConfigsAll();

    return createApiResponse({ configs });
  } catch (error) {
    logger.error('Failed to fetch site configs:', error);
    return handleApiError(error as Error);
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    validateInput(data, siteConfigSchema);

    const id = await siteConfigManager.createSiteConfig(data);
    const config = await siteConfigManager.getSiteConfigById(id);

    return createApiResponse({ config });
  } catch (error) {
    logger.error('Failed to create site config:', error);
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return createApiError('Invalid site configuration data', 400);
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return createApiError('Site pattern already exists', 409);
    }
    return handleApiError(error as Error);
  }
};
