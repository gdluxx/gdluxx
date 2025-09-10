/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { createPageLoad } from '$lib/utils/page-load';
import { getClientSafeMessage } from '$lib/server/api-utils';
import { writeConfigFile } from '$lib/server/config-utils';

export const load = createPageLoad({
  endpoint: '/api/config',
  fallback: { content: '{}', source: 'fallback' },
  errorMessage: 'Failed to load configuration',
});

export const actions: Actions = {
  default: async ({ request }) => {
    try {
      const formData = await request.formData();
      const content = formData.get('content') as string;

      if (typeof content !== 'string') {
        return fail(400, { error: 'Invalid content - must be string' });
      }

      return await writeConfigFile(content);
    } catch (error) {
      logger.error('Error saving file:', error);
      return fail(500, { error: getClientSafeMessage(error as Error) });
    }
  },
};
