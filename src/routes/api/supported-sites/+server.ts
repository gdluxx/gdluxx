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
import { siteDataFetcher } from '$lib/server/siteDataFetcher';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { logger } from '$lib/shared/logger';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const category: string | undefined = url.searchParams.get('category') || undefined;
    const sites = await siteConfigManager.getSupportedSites(category);
    const categories: string[] = await siteConfigManager.getSupportedSiteCategories();
    const meta = await siteConfigManager.getSiteDataMeta();

    return createApiResponse({
      sites,
      categories,
      meta: {
        last_successful_fetch: meta.last_successful_fetch,
        sites_count: meta.sites_count,
        fetch_error: meta.fetch_error,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch supported sites:', error);
    return handleApiError(error as Error);
  }
};

export const POST: RequestHandler = async () => {
  try {
    logger.info('Manual refresh of supported sites requested');
    await siteDataFetcher.fetchAndParseSites();

    const meta = await siteConfigManager.getSiteDataMeta();

    return createApiResponse({
      message: 'Site data refreshed successfully',
      sites_count: meta.sites_count,
      last_updated: meta.last_successful_fetch,
    });
  } catch (error) {
    logger.error('Failed to refresh site data:', error);
    return handleApiError(error as Error);
  }
};
