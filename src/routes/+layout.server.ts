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
import { GALLERY_DL_MODE } from '$lib/server/galleryDlMode';
import { PROHIBITED_OPTION_IDS } from '$lib/server/validation/exec-policy';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user, // from hooks.server.ts
    appVersion: APP_VERSION,
    ...(locals.user && {
      galleryDlMode: GALLERY_DL_MODE,
      prohibitedOptionIds: Array.from(PROHIBITED_OPTION_IDS),
    }),
  };
};
