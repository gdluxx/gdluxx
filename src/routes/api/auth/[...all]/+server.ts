/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { auth } from '$lib/server/better-auth';
import type { RequestHandler } from '@sveltejs/kit';

const handler: RequestHandler = async ({ request }) => {
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
