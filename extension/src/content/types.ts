/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { Settings } from '#utils/settings.ts';
import type { ProfileScope } from '#utils/storageExtractionProfiles.ts';
import type { ProfileBackupPayload } from '#utils/gdluxxApi.ts';
import type { SubRule } from '#utils/substitution.ts';

export type DisplayMode = 'modal' | 'fullscreen';
export type AppTab = 'links' | 'images' | 'settings';
export type SettingsTab = 'appearance' | 'gdluxx' | 'keyboard' | 'preview' | 'extraction-profiles';
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

export interface BackupSyncResult {
  remote: RemoteBackupMeta | null;
  payload?: ProfileBackupPayload;
}

export interface GlobalEffectsConfig {
  onClose: () => void;
  canSaveProfile: () => boolean;
  saveProfile: () => Promise<void>;
}

// EXTRACTION PROFILES

export type { SubRule };

export type ExtractionMode = 'range' | 'targeted';

export interface RangeExtractionConfig {
  mode: 'range';
  startSelector: string;
  endSelector: string;
}

export type ContainerSource =
  | { via: 'selector'; selector: string }
  | { via: 'string'; begin: string; end: string }
  | { via: 'body' };

export type ImageSource =
  | { via: 'selector'; selector: string; attr: string }
  | { via: 'string'; begin: string; end: string };

export interface TargetedExtractionConfig {
  mode: 'targeted';
  container: ContainerSource;
  images: ImageSource;
}

export type ExtractionConfig = RangeExtractionConfig | TargetedExtractionConfig;

export interface GalleryDisplayConfig {
  thumbSizes: [number, number, number];
  gap: number;
  border: number;
  buttonCorner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface ExtractionProfile {
  id: string;
  name?: string;
  scope: ProfileScope;
  host: string;
  origin?: string;
  path?: string;
  extraction: ExtractionConfig;
  rules: SubRule[];
  applyToPreview: boolean;
  autoApply: boolean;
  gallery?: GalleryDisplayConfig;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface ExtractionBundle {
  version: 1;
  profiles: Record<string, ExtractionProfile>;
}

export interface ActiveExtractionConfig {
  extraction: ExtractionConfig;
  rules: SubRule[];
  applyToPreview: boolean;
}
