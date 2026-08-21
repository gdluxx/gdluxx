/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { Handle, ServerInit } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth/better-auth';
import { DATABASE_PATH, openDatabase } from '$lib/server/database';
// Keep the better-auth import above the coordinator's: better-auth's module
// side effect execs schema.sql, and the schedule managers in the coordinator's
// import graph open the shared database handle at module scope.
import { createScheduler, type Scheduler } from '$lib/server/schedules/coordinator';
import { launchUrls } from '$lib/server/jobs/commandLauncher';
import { jobManager } from '$lib/server/jobs/jobManager';
import { userSettingsManager } from '$lib/server/userSettingsManager';
import { getCurrentTimestamp } from '$lib/server/settingsManager';
import { existsSync } from 'node:fs';

export const init: ServerInit = async () => {
  if (building) {
    return;
  }
  // Survives dev-HMR re-execution of this module: a second init must not arm a
  // second scan timer against the same database.
  const g = globalThis as typeof globalThis & { __gdluxxScheduler?: Scheduler };
  if (g.__gdluxxScheduler) {
    return;
  }
  const scheduler = createScheduler({
    now: getCurrentTimestamp,
    whenReady: () => jobManager.whenReady(),
    launch: launchUrls,
    getMaxBatchUrls: (userId) => userSettingsManager.getUserSettings(userId).maxBatchUrls,
  });
  g.__gdluxxScheduler = scheduler;
  scheduler.start().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Scheduler failed to start:', error);
  });
};

const publicRoutes = ['/auth/login', '/auth/setup', '/api/auth'];
const deniedAuthRoutes = new Set(['/api/auth/change-email', '/api/auth/list-sessions']);

const extensionApiRoutes = [
  '/api/extension/external',
  '/api/extension/extraction',
  '/api/extension/profiles',
  '/api/extension/subs',
  '/api/extension/ping',
  '/api/extension/cookies',
  '/api/extension/jobs',
];

function isExtensionApiRoute(pathname: string): boolean {
  return extensionApiRoutes.some((route) => pathname === route);
}

async function getUserCount(): Promise<number> {
  try {
    if (!existsSync(DATABASE_PATH)) {
      return 0;
    }

    const db = openDatabase();

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

  if (deniedAuthRoutes.has(event.url.pathname)) {
    return json({ error: 'Not found' }, { status: 404 });
  }

  const isPublicRoute =
    publicRoutes.some((route) => event.url.pathname.startsWith(route)) ||
    isExtensionApiRoute(event.url.pathname);

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

  if (isExtensionApiRoute(event.url.pathname)) {
    const origin = event.request.headers.get('origin');

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
