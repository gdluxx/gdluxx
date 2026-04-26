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

export interface ApiKeySummary {
  id: string;
  name: string;
}

export interface ExtensionProfilesPageData {
  apiKeys: ApiKeySummary[];
  selectorBackups: Record<string, SelectorBackupView>;
  subBackups: Record<string, SubBackupView>;
}
