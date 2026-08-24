/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { error, redirect } from '@sveltejs/kit';
import { getUserCountState } from '$lib/server/auth/userExistence';
import type { PageServerLoad } from './$types';

// This is only a UX guard; the data layer closes signup. Treat an unknown count
// as unavailable so transient database failures never reopen setup.
export const load: PageServerLoad = async () => {
  const state = await getUserCountState();

  if (state === 'nonzero') {
    redirect(302, '/auth/login');
  }

  if (state === 'unknown') {
    error(503, 'Service temporarily unavailable');
  }

  return {};
};
