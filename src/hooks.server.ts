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
import { building } from '$app/environment';
import { isRedirect, json, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth/better-auth';
// Keep the better-auth import above the coordinator's: better-auth's module
// side effect execs schema.sql, and the schedule managers in the coordinator's
// import graph open the shared database handle at module scope.
import { createScheduler, type Scheduler } from '$lib/server/schedules/coordinator';
import { launchUrls } from '$lib/server/jobs/commandLauncher';
import { jobManager } from '$lib/server/jobs/jobManager';
import { userSettingsManager } from '$lib/server/userSettingsManager';
import { getCurrentTimestamp } from '$lib/server/settingsManager';
import { getUserCountState } from '$lib/server/auth/userExistence';

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

// Public PAGE routes match exactly, no startsWith over-match of /auth/loginX.
const publicPageRoutes = new Set(['/auth/login', '/auth/setup']);
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

function isPublicRoute(pathname: string): boolean {
  if (publicPageRoutes.has(pathname)) {
    return true;
  }
  // Better Auth needs its whole /api/auth subtree public, but only at a segment
  // boundary so /api/authX is NOT treated as public.
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    return true;
  }
  return isExtensionApiRoute(pathname);
}

// AUTH-013: normalize before the denylist so /api/auth//list-sessions and
// /api/auth%2Flist-sessions cannot slip past it into the public subtree.
function normalizePathname(pathname: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed percent-encoding: keep the raw path so a bad sequence can't
    // slip a denied route past the check.
    decoded = pathname;
  }
  return decoded.replace(/\/{2,}/g, '/');
}

// REM-011/AUTH-015: an unauthenticated API call gets 401 JSON, not a 302 to an
// HTML login page an XHR cannot use. Page routes still redirect (this throws).
function unauthenticated(pathname: string): Response {
  if (pathname.startsWith('/api/')) {
    return json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  redirect(302, '/auth/login');
}

export const handle: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname;

  if (pathname.startsWith('/.well-known/appspecific/com.chrome.devtools')) {
    return new Response(null, { status: 204 });
  }

  if (deniedAuthRoutes.has(normalizePathname(pathname))) {
    return json({ error: 'Not found' }, { status: 404 });
  }

  if (!isPublicRoute(pathname)) {
    const userCountState = await getUserCountState();

    if (userCountState === 'unknown') {
      return json({ error: 'Service temporarily unavailable' }, { status: 503 });
    }

    if (userCountState === 'zero') {
      redirect(302, '/auth/setup');
    }

    let session: Awaited<ReturnType<typeof auth.api.getSession>>;
    try {
      session = await auth.api.getSession({ headers: event.request.headers });
    } catch (error) {
      if (isRedirect(error)) {
        throw error;
      }
      // eslint-disable-next-line no-console
      console.error('Auth error:', error);
      session = null;
    }

    if (!session) {
      return unauthenticated(pathname);
    }

    event.locals.session = session;
    event.locals.user = session.user;
  }

  if (isExtensionApiRoute(pathname)) {
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
