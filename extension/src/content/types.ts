/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { Settings } from './lib/utils/settings';
import type { ProfileScope, SavedSelectorProfile } from './lib/utils/storageProfiles';
import type { ProfileBackupPayload } from './lib/utils/gdluxxApi';

export type DisplayMode = 'modal' | 'fullscreen';
export type AppTab = 'links' | 'images' | 'settings';
export type SettingsTab = 'appearance' | 'gdluxx' | 'keyboard' | 'preview';
export type HoverPreviewMode = 'off' | 'small' | 'medium' | 'large';
export type HotkeyString = string;

export interface RemoteBackupMeta {
  hasBackup: boolean;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface AppInitializationContext {
  shadowContainer: HTMLElement | null;
}

export interface AppInitializationResult {
  settings: Settings;
  theme: string;
  displayMode: DisplayMode;
}

export interface SelectorProfileContext {
  scope: ProfileScope;
  activeProfileId: string | null;
  activeProfile: SavedSelectorProfile | null;
}

export interface BackupSyncResult {
  remote: RemoteBackupMeta | null;
  payload?: ProfileBackupPayload;
}

export interface GlobalEffectsConfig {
  onClose: () => void;
  canSaveProfile: () => boolean;
  saveProfile: () => Promise<void>;
}
