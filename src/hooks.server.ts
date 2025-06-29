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
import { auth } from '$lib/server/better-auth';

const publicRoutes = ['/auth/login', '/auth/setup', '/api/auth', '/api/extension/external'];

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
  const isPublicRoute = publicRoutes.some(route => event.url.pathname.startsWith(route));

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
  if (event.url.pathname === '/api/extension/external') {
    const origin = event.request.headers.get('origin');

    const isExtensionOrigin =
      origin && (origin.startsWith('moz-extension://') || origin.startsWith('chrome-extension://'));

    if (event.request.method === 'OPTIONS') {
      return json(null, {
        headers: {
          'Access-Control-Allow-Origin': isExtensionOrigin ? origin : '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
      });
    }

    const response = await resolve(event);
    response.headers.set('Access-Control-Allow-Origin', isExtensionOrigin ? origin : '*');

    return response;
  }

  return resolve(event);
};
