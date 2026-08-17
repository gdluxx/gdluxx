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
import { DEFAULT_VERSION_INFO } from '$lib/server/version/versionManager';

export const load = createPageLoad({
  endpoint: '/api/settings/version',
  fallback: DEFAULT_VERSION_INFO,
  errorMessage: 'Failed to load gallery-dl version information',
});
