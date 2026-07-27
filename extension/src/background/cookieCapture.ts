/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { checkCookieAccess } from '#src/background/permissions';
import { originUrlFromPattern } from '#src/shared/originPattern';
import type { CookiePayload, CookieSameSite } from '#src/background/apiProxy';

type BrowserCookie = Browser.cookies.Cookie;

export interface CookieCaptureResult {
  success: boolean;
  cookies?: CookiePayload[];
  error?: string;
}

const PERMISSION_MESSAGES: Record<'cookies' | 'origin', string> = {
  cookies:
    "Cookie access isn't enabled yet. Open the gdluxx popup, turn on cookie sync, then try again.",
  origin:
    "gdluxx doesn't have permission for this site. Enable it from the gdluxx popup, then try again.",
};

function mapSameSite(value: unknown): CookieSameSite {
  switch (value) {
    case 'no_restriction':
    case 'lax':
    case 'strict':
    case 'unspecified':
      return value;
    default:
      return 'unspecified';
  }
}

export async function captureCookiesForDomain(
  domain: string,
  originPattern: string,
  storeId?: string,
): Promise<CookieCaptureResult> {
  const access = await checkCookieAccess(originPattern);
  if (!access.ok) {
    return {
      success: false,
      error:
        access.reason === 'error'
          ? `Could not verify cookie permissions: ${access.detail ?? 'unknown error'}`
          : PERMISSION_MESSAGES[access.reason],
    };
  }

  if (typeof browser.cookies === 'undefined') {
    return {
      success: false,
      error: 'Cookie access was granted but is not active yet. Reload the extension and try again.',
    };
  }

  // Without storeId, getAll reads the background script's cookie store rather
  // than the tab's, wrong and silently empty inside a firefox container tab
  const store = storeId ? { storeId } : {};

  try {
    const collected = new Map<string, BrowserCookie>();
    const collect = (found: BrowserCookie[]): void => {
      for (const cookie of found) {
        collected.set(`${cookie.name}|${cookie.domain}|${cookie.path}`, cookie);
      }
    };

    // Every cookie the browser would *send* to the origin root. Standard
    // cookie-send matching, so this is what picks up registrable-domain
    // cookies such as `.example.com`, where session cookies almost always
    // live. Path-filtered to '/'
    const originUrl = originUrlFromPattern(originPattern);
    if (originUrl) {
      collect(await browser.cookies.getAll({ url: originUrl, ...store }));
    }

    // Host-only and subdomain cookies at any path. The domain filter matches
    // `domain` and its subdomains only, never a parent, so it complements
    // rather than replaces the query above.
    collect(await browser.cookies.getAll({ domain, ...store }));

    const cookies: CookiePayload[] = [...collected.values()].map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      hostOnly: cookie.hostOnly,
      sameSite: mapSameSite(cookie.sameSite),
      session: cookie.session,
      expirationDate: cookie.expirationDate,
    }));
    return { success: true, cookies };
  } catch (error) {
    console.error('Failed to capture cookies', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read cookies from browser',
    };
  }
}
