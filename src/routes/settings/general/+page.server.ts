/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { createPageLoad } from '$lib/utils/page-load';
import { DEFAULT_SETTINGS } from '$lib/server/userSettingsManager';

export const load = createPageLoad({
  endpoint: '/api/settings/user',
  fallback: DEFAULT_SETTINGS,
  errorMessage: 'Failed to load user settings',
});
