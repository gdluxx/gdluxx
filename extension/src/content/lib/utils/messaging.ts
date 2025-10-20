/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export {
  sendUrls,
  testConnection,
  fetchProfileBackup,
  saveProfileBackup,
  deleteProfileBackup,
  type ProfileBackupPayload,
  fetchSubBackup,
  saveSubBackup,
  deleteSubBackup,
  type SubBackupPayload,
  type ApiResult,
} from './gdluxxApi';

export async function sendBackgroundMessage<T = unknown>(message: unknown): Promise<T | undefined> {
  try {
    if (typeof browser === 'undefined' || !browser.runtime?.sendMessage) {
      return undefined;
    }
    return (await browser.runtime.sendMessage(message)) as T;
  } catch (error) {
    console.error('Background messaging failed', error);
    return undefined;
  }
}

export async function requestOverlayToggle(): Promise<void> {
  await sendBackgroundMessage({ action: 'toggleOverlay' });
}
