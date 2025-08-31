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
import { userSettingsManager } from '$lib/server/userSettingsManager';
import { AVAILABLE_THEMES, type ThemeName } from '$lib/themes/themeUtils.js';
import { z } from 'zod';

// Validation schema for user settings
const UserSettingsSchema = z
  .object({
    warnOnSiteRuleOverride: z.boolean().optional(),
    selectedTheme: z.enum(Object.keys(AVAILABLE_THEMES) as [ThemeName, ...ThemeName[]]).optional(),
  })
  .strict();

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const settings = userSettingsManager.getUserSettings(user.id);
    return json({ success: true, data: settings });
  } catch (_error) {
    return json({ success: false, error: 'Failed to get settings' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const user = locals.user;
    if (!user) {
      return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    // Validate the request body
    const validationResult = UserSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return json({ success: false, error: `Invalid settings: ${errorMessages}` }, { status: 400 });
    }

    const validatedSettings = validationResult.data;
    userSettingsManager.updateUserSettings(user.id, validatedSettings);

    return json({ success: true, message: 'Settings updated successfully' });
  } catch (_error) {
    return json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
};
