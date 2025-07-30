/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { PageServerLoad } from './$types';
import { siteConfigManager } from '$lib/server/siteConfigManager';

export const load: PageServerLoad = async () => {
  try {
    const [configs, supportedSites, categories] = await Promise.all([
      siteConfigManager.getSiteConfigsAll(),
      siteConfigManager.getSupportedSites(),
      siteConfigManager.getSupportedSiteCategories(),
    ]);

    return {
      configs,
      supportedSites,
      categories,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load extension config data:', error);
    return {
      configs: [],
      supportedSites: [],
      categories: [],
    };
  }
};
