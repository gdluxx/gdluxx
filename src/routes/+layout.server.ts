/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { LayoutServerLoad } from './$types';
import { APP_VERSION } from '$lib/server/appVersion';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user, // from hooks.server.ts
    appVersion: APP_VERSION,
  };
};
