/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export type ProfileScope = 'host' | 'origin' | 'path';

export interface SelectorProfile {
  id: string;
  scope: ProfileScope;
  host: string;
  path?: string;
  origin?: string;
  startSelector: string;
  endSelector: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface SelectorBundle {
  version: number;
  profiles: Record<string, SelectorProfile>;
}

export interface SubRule {
  id: string;
  pattern: string;
  replacement: string;
  flags: string;
  enabled: boolean;
  order: number;
}

export interface SubProfile {
  id: string;
  scope: ProfileScope;
  host: string;
  path?: string;
  origin?: string;
  rules: SubRule[];
  name?: string;
  applyToPreview: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface SubBundle {
  version: number;
  profiles: Record<string, SubProfile>;
}

export interface BackupMeta {
  hasBackup: boolean;
  profileCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface SelectorBackupView extends BackupMeta {
  bundle: SelectorBundle;
}

export interface SubBackupView extends BackupMeta {
  bundle: SubBundle;
}

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

export interface ExtractionBackupView extends BackupMeta {
  bundle: ExtractionBundle;
}

export interface ApiKeySummary {
  id: string;
  name: string;
}

export interface ExtensionProfilesPageData {
  apiKeys: ApiKeySummary[];
  selectorBackups: Record<string, SelectorBackupView>;
  subBackups: Record<string, SubBackupView>;
  extractionBackups: Record<string, ExtractionBackupView>;
}
