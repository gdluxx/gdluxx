/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { PATHS } from './constants';
import type { ThemeName } from '$lib/themes/themeUtils.js';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');

export interface UserSettings {
  warnOnSiteRuleOverride: boolean;
  selectedTheme: ThemeName;
}

const DEFAULT_SETTINGS: UserSettings = {
  warnOnSiteRuleOverride: false,
  selectedTheme: 'indigo',
};

export const userSettingsManager = {
  // Get user current settings
  getUserSettings(userId: string): UserSettings {
    try {
      const db = new Database(dbPath);
      const stmt = db.prepare(
        'SELECT warnOnSiteRuleOverride, selectedTheme FROM user WHERE id = ?'
      );
      const row = stmt.get(userId) as
        | { warnOnSiteRuleOverride: number; selectedTheme: string }
        | undefined;
      db.close();

      if (row) {
        return {
          warnOnSiteRuleOverride: Boolean(row.warnOnSiteRuleOverride),
          selectedTheme: (row.selectedTheme || 'indigo') as ThemeName,
        };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to read user settings:', error);
      return DEFAULT_SETTINGS;
    }
  },

  // Update user settings
  updateUserSettings(userId: string, settings: Partial<UserSettings>): void {
    try {
      const db = new Database(dbPath);
      const timestamp = Math.floor(Date.now() / 1000);

      if (settings.warnOnSiteRuleOverride !== undefined) {
        const stmt = db.prepare(`
          UPDATE user 
          SET warnOnSiteRuleOverride = ?, updatedAt = ? 
          WHERE id = ?
        `);
        stmt.run(settings.warnOnSiteRuleOverride ? 1 : 0, timestamp, userId);
      }

      if (settings.selectedTheme !== undefined) {
        const stmt = db.prepare(`
          UPDATE user 
          SET selectedTheme = ?, updatedAt = ? 
          WHERE id = ?
        `);
        stmt.run(settings.selectedTheme, timestamp, userId);
      }

      db.close();
    } catch (error) {
      console.error('Failed to update user settings:', error);
      throw error;
    }
  },
};
