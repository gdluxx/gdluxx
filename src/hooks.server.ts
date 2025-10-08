/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth/better-auth';

const publicRoutes = [
  '/auth/login',
  '/auth/setup',
  '/api/auth',
  '/api/extension/external',
  '/api/extension/profiles',
  '/api/extension/ping',
];

async function getUserCount(): Promise<number> {
  try {
    const Database = await import('better-sqlite3');
    const { join } = await import('path');
    const { existsSync } = await import('fs');

    const dbPath: string = join(process.cwd(), 'data', 'gdluxx.db');

    if (!existsSync(dbPath)) {
      return 0;
    }

    const db = new Database.default(dbPath);

    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
      .all();

    if (tableCheck.length === 0) {
      db.close();
      return 0;
    }

    const result = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number };
    db.close();

    return result.count;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking user count:', error);
    return 0;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/.well-known/appspecific/com.chrome.devtools')) {
    return new Response(null, { status: 204 });
  }

  // Skip auth for browser extension API endpoint
  const isPublicRoute = publicRoutes.some((route) => event.url.pathname.startsWith(route));

  if (!isPublicRoute) {
    const userCount = await getUserCount();
    if (userCount === 0 && event.url.pathname !== '/auth/setup') {
      redirect(302, '/auth/setup');
    }

    if (userCount > 0) {
      try {
        const session = await auth.api.getSession({
          headers: event.request.headers,
        });

        if (!session) {
          redirect(302, '/auth/login');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event.locals.session = session as any;
        event.locals.user = session.user;
      } catch (error) {
        if (error instanceof Response && error.status === 302) {
          throw error;
        }
        // eslint-disable-next-line no-console
        console.error('Auth error:', error);
        redirect(302, '/auth/login');
      }
    }
  }

  // CORS for browser extension endpoint
  if (
    event.url.pathname === '/api/extension/external' ||
    event.url.pathname === '/api/extension/profiles' ||
    event.url.pathname === '/api/extension/ping'
  ) {
    const origin = event.request.headers.get('origin');

    // Determine appropriate Access-Control-Allow-Origin value
    const allowOrigin = origin || '*';

    if (event.request.method === 'OPTIONS') {
      return json(null, {
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          // Two way comm between extension and gdluxx requires expanding methods allowed
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Private-Network': 'true',
          ...(origin ? { Vary: 'Origin' } : {}),
        },
      });
    }

    const response = await resolve(event);
    response.headers.set('Access-Control-Allow-Origin', allowOrigin);
    response.headers.set('Access-Control-Allow-Private-Network', 'true');
    if (origin) {
      response.headers.set('Vary', 'Origin');
    }

    return response;
  }

  return resolve(event);
};
