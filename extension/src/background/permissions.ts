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

export async function registerOverlayForOrigins(origins: string[]): Promise<void> {
  if (!origins.length) return;

  try {
    await browser.scripting
      .unregisterContentScripts({ ids: [OVERLAY_SCRIPT_ID] })
      .catch(() => undefined);
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

  try {
    const remaining = await browser.permissions.getAll();
    const origins = remaining.origins ?? [];
    if (!origins.length) {
      await browser.scripting
        .unregisterContentScripts({ ids: [OVERLAY_SCRIPT_ID] })
        .catch(() => undefined);
    } else {
      await registerOverlayForOrigins(origins);
    }
  } catch (error) {
    console.error('Failed to update overlay registration after permissions removal', error);
  }
});
