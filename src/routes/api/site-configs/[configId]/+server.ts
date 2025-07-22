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
import {
  siteConfigUpdateSchema,
  siteConfigIdSchema,
} from '$lib/server/validation/site-config-validation';
import { logger } from '$lib/shared/logger';

export const GET: RequestHandler = async ({ params }) => {
  try {
    validateInput(params, siteConfigIdSchema);
    const configId = parseInt(params.configId || '0');

    const config = await siteConfigManager.getSiteConfigById(configId);
    if (!config) {
      return createApiError('Site config not found', 404);
    }

    return createApiResponse({ config });
  } catch (error) {
    logger.error('Failed to fetch site config:', error);
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return createApiError('Invalid config ID', 400);
    }
    return handleApiError(error as Error);
  }
};

export const PUT: RequestHandler = async ({ request, params }) => {
  try {
    validateInput(params, siteConfigIdSchema);
    const configId = parseInt(params.configId || '0');
    const data = await request.json();

    validateInput(data, siteConfigUpdateSchema);

    const success = await siteConfigManager.updateSiteConfig(configId, data);
    if (!success) {
      return createApiError('Site config not found', 404);
    }

    const config = await siteConfigManager.getSiteConfigById(configId);
    return createApiResponse({ config });
  } catch (error) {
    logger.error('Failed to update site config:', error);
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return createApiError('Invalid site configuration data', 400);
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return createApiError('Site pattern already exists', 409);
    }
    return handleApiError(error as Error);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    validateInput(params, siteConfigIdSchema);
    const configId = parseInt(params.configId || '0');

    const success = await siteConfigManager.deleteSiteConfig(configId);
    if (!success) {
      return createApiError('Site config not found', 404);
    }

    return createApiResponse({ message: 'Site config deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete site config:', error);
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return createApiError('Invalid config ID', 400);
    }
    return handleApiError(error as Error);
  }
};
