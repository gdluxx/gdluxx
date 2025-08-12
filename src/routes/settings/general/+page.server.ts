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
import { userSettingsManager, type UserSettings } from '$lib/server/userSettingsManager';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    throw new Error('User not authenticated');
  }

  const userSettings: UserSettings = userSettingsManager.getUserSettings(user.id);

  return {
    userSettings,
  };
};
