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
export type SettingsTab = 'appearance' | 'gdluxx' | 'keyboard' | 'preview' | 'gallerized';
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

// GALLERIZED

export interface GallerizedTransform {
  find: string;
  replace: string;
}

export interface GallerizedContainerConfig {
  selector: string | null;
  begin: string | null;
  end: string | null;
}

export interface GallerizedImagesConfig {
  selector: string | null;
  attr: string;
  begin: string | null;
  end: string | null;
  transform: GallerizedTransform | GallerizedTransform[] | null;
}

export interface GallerizedGalleryConfig {
  thumbSizes: [number, number, number];
  gap: number;
  border: number;
  buttonCorner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface GallerizedConfig {
  container: GallerizedContainerConfig;
  images: GallerizedImagesConfig;
  gallery: GallerizedGalleryConfig;
}

export interface GallerizedProfile {
  key: string;
  config: {
    container?: Partial<GallerizedContainerConfig>;
    images?: Partial<GallerizedImagesConfig>;
    gallery?: Partial<GallerizedGalleryConfig>;
  };
}

export interface GallerizedSettings {
  enabled: boolean;
  defaultConfig: GallerizedConfig;
  profiles: GallerizedProfile[];
}
