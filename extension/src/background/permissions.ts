/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

const OVERLAY_SCRIPT_ID = 'gdluxx-overlay-script';
const OVERLAY_SCRIPT_PATH = 'content-scripts/overlay.js';

export async function ensureOrigins(origins: string[]): Promise<boolean> {
  try {
    const hasAccess = await browser.permissions.contains({ origins });
    if (hasAccess) return true;
    return await browser.permissions.request({ origins });
  } catch (error) {
    console.error('Failed to ensure origins', error);
    return false;
  }
}

export type CookieAccessCheck =
  { ok: true } | { ok: false; reason: 'cookies' | 'origin' | 'error'; detail?: string };

/**
 * Report whether cookie capture is currently permitted for an origin
 *
 * Deliberately check-only, `permissions.request()` must run inside a user
 * input handler, and `runtime.onMessage` is not one, so requesting from the
 * background would throw. The `cookies` permission is granted from the popup
 * instead and the origin from the popup's existing enable buttons.
 *
 * The two `contains()` calls are kept separate caller can tell user
 * which grant is actually missing
 */
export async function checkCookieAccess(originPattern: string): Promise<CookieAccessCheck> {
  try {
    const hasCookies = await browser.permissions.contains({ permissions: ['cookies'] });
    if (!hasCookies) return { ok: false, reason: 'cookies' };

    const hasOrigin = await browser.permissions.contains({ origins: [originPattern] });
    if (!hasOrigin) return { ok: false, reason: 'origin' };

    return { ok: true };
  } catch (error) {
    console.error('Failed to check cookie permissions', error);
    return {
      ok: false,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function registerOverlayForOrigins(origins: string[]): Promise<void> {
  try {
    await browser.scripting
      .unregisterContentScripts({ ids: [OVERLAY_SCRIPT_ID] })
      .catch(() => undefined);

    if (!origins.length) return;

    await browser.scripting.registerContentScripts([
      {
        id: OVERLAY_SCRIPT_ID,
        js: [OVERLAY_SCRIPT_PATH],
        matches: origins,
        runAt: 'document_idle',
      },
    ]);
  } catch (error) {
    console.error('Failed to register overlay content script', error);
  }
}

export async function syncOverlayRegistrationFromPermissions(): Promise<void> {
  try {
    const granted = await browser.permissions.getAll();
    await registerOverlayForOrigins(granted.origins ?? []);
  } catch (error) {
    console.error('Failed to sync overlay registration', error);
  }
}

browser.permissions.onRemoved.addListener(async (perms) => {
  if (!perms.origins?.length) return;

  await syncOverlayRegistrationFromPermissions();
});
