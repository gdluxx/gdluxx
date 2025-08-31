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
import { siteConfigManager } from '$lib/server/siteConfigManager';
import { serverLogger as logger } from '$lib/server/logger';

interface LookupRequestBody {
  urls: string[];
}

interface LookupResult {
  url: string;
  hostname: string;
  hasMatch: boolean;
  matchedPattern?: string;
  configName?: string;
  options: Record<string, string | number | boolean>;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: LookupRequestBody = await request.json();

    if (!body.urls || !Array.isArray(body.urls)) {
      return json({ success: false, error: 'URLs array is required' }, { status: 400 });
    }

    const results: LookupResult[] = [];

    for (const url of body.urls) {
      if (typeof url !== 'string' || !url.trim()) {
        continue; // Skip invalid URLs
      }

      try {
        const configData = await siteConfigManager.getConfigMetadataForUrl(url);
        const hostname = new URL(url).hostname;

        results.push({
          url,
          hostname,
          ...configData,
        });
      } catch (error) {
        logger.warn(`Failed to process URL ${url}:`, error);
        // Continue processing other URLs even if one fails
        continue;
      }
    }

    // Only return results that have matches
    const matchedResults = results.filter((result) => result.hasMatch);

    return json({
      success: true,
      data: matchedResults,
    });
  } catch (error) {
    logger.error('Error in site-configs lookup endpoint:', error);
    return json({ success: false, error: 'Failed to lookup site configurations' }, { status: 500 });
  }
};
