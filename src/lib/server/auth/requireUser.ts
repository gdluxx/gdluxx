/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { error } from '@sveltejs/kit';
import type { User } from '$lib/server/auth/better-auth';

export type { User };

/*
 * Defense in depth for hook-protected API routes. SvelteKit serializes a
 * thrown +server error as JSON, preserving API 401 semantics if hook route
 * classification regresses.
 */
export function requireUser(locals: App.Locals): User {
  if (!locals.user) {
    error(401, 'Authentication required');
  }
  return locals.user;
}
