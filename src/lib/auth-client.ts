/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { createAuthClient } from 'better-auth/client';
import { browser } from '$app/environment';

export const authClient = createAuthClient({
  baseURL: browser ? window.location.origin : undefined,
});

export const { signIn, signUp, signOut, getSession, useSession } = authClient;
