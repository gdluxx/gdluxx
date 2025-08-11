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
import { userSettingsManager, type UserSettings } from '$lib/server/userSettingsManager';

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

    const body = (await request.json()) as Partial<UserSettings>;
    userSettingsManager.updateUserSettings(user.id, body);

    return json({ success: true, message: 'Settings updated successfully' });
  } catch (_error) {
    return json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
};
