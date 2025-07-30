/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import path from 'path';
import Database from 'better-sqlite3';
import { PATHS } from '$lib/server/constants';
import { serverLogger } from '$lib/server/logger';

const dbPath = path.join(PATHS.DATA_DIR, 'gdluxx.db');
const db = new Database(dbPath);

function getCurrentTimestamp(): number {
  return Date.now();
}

export interface SiteConfig {
  id?: number;
  site_pattern: string;
  display_name: string;
  cli_options: Array<[string, string | number | boolean]>;
  is_default: boolean;
  enabled: boolean;
  created_at?: number;
  updated_at?: number;
}

export interface SupportedSite {
  id?: number;
  name: string;
  url: string;
  url_pattern: string;
  category?: string;
  capabilities: string[];
  auth_supported: boolean;
  last_fetched: number;
  created_at?: number;
  updated_at?: number;
}

export interface SiteDataMeta {
  id?: number;
  last_fetch_attempt: number;
  last_successful_fetch: number;
  sites_count: number;
  fetch_error?: string;
  created_at?: number;
  updated_at?: number;
}

class SiteConfigManager {
  private db: Database.Database;

  constructor() {
    this.db = db;
  }

  async createSiteConfig(
    config: Omit<SiteConfig, 'id' | 'created_at' | 'updated_at'>
  ): Promise<number> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO site_configs (site_pattern, display_name, cli_options, is_default, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const now = getCurrentTimestamp();
      const result = stmt.run(
        config.site_pattern,
        config.display_name,
        JSON.stringify(config.cli_options),
        config.is_default ? 1 : 0,
        config.enabled ? 1 : 0,
        now,
        now
      );
      return result.lastInsertRowid as number;
    } catch (error) {
      serverLogger.error('Error creating site config in database:', error);

      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ) {
        throw new Error('Site pattern already exists');
      }
      throw new Error('Failed to create site config');
    }
  }

  async getSiteConfigsAll(): Promise<SiteConfig[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM site_configs 
        WHERE enabled = 1 
      `);
      return stmt.all().map(row => this.rowToSiteConfig(row as Record<string, unknown>));
    } catch (error) {
      serverLogger.error('Error reading site configs from database:', error);
      return [];
    }
  }

  async getSiteConfigById(id: number): Promise<SiteConfig | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM site_configs WHERE id = ?');
      const row = stmt.get(id);
      return row ? this.rowToSiteConfig(row as Record<string, unknown>) : null;
    } catch (error) {
      serverLogger.error('Error reading site config from database:', error);
      return null;
    }
  }

  async updateSiteConfig(id: number, updates: Partial<SiteConfig>): Promise<boolean> {
    try {
      const fields = [];
      const values = [];

      if (updates.site_pattern) {
        fields.push('site_pattern = ?');
        values.push(updates.site_pattern);
      }
      if (updates.display_name) {
        fields.push('display_name = ?');
        values.push(updates.display_name);
      }
      if (updates.cli_options) {
        fields.push('cli_options = ?');
        values.push(JSON.stringify(updates.cli_options));
      }
      if (updates.is_default !== undefined) {
        fields.push('is_default = ?');
        values.push(updates.is_default ? 1 : 0);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = ?');
      values.push(getCurrentTimestamp(), id);

      const stmt = this.db.prepare(`UPDATE site_configs SET ${fields.join(', ')} WHERE id = ?`);
      const result = stmt.run(...values);
      return result.changes > 0;
    } catch (error) {
      serverLogger.error('Error updating site config in database:', error);
      throw new Error('Failed to update site config.');
    }
  }

  async deleteSiteConfig(id: number): Promise<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM site_configs WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      serverLogger.error('Error deleting site config from database:', error);
      throw new Error('Failed to delete site config.');
    }
  }

  async upsertSupportedSite(
    site: Omit<SupportedSite, 'id' | 'created_at' | 'updated_at'>
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO supported_sites 
        (name, url, url_pattern, category, capabilities, auth_supported, last_fetched, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 
          COALESCE((SELECT created_at FROM supported_sites WHERE url = ?), ?), 
          ?)
      `);
      const now = getCurrentTimestamp();
      stmt.run(
        site.name,
        site.url,
        site.url_pattern,
        site.category,
        JSON.stringify(site.capabilities),
        site.auth_supported ? 1 : 0,
        site.last_fetched,
        site.url,
        now,
        now
      );
    } catch (error) {
      serverLogger.error('Error upserting supported site in database:', error);
      throw new Error('Failed to update supported site.');
    }
  }

  async getSupportedSites(category?: string): Promise<SupportedSite[]> {
    try {
      let query = 'SELECT * FROM supported_sites ORDER BY name ASC';
      let params: unknown[] = [];

      if (category) {
        query = 'SELECT * FROM supported_sites WHERE category = ? ORDER BY name ASC';
        params = [category];
      }

      const stmt = this.db.prepare(query);
      return stmt
        .all(...params)
        .map(row => this.rowToSupportedSite(row as Record<string, unknown>));
    } catch (error) {
      serverLogger.error('Error reading supported sites from database:', error);
      return [];
    }
  }

  async getSupportedSiteCategories(): Promise<string[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT category FROM supported_sites 
        WHERE category IS NOT NULL 
        ORDER BY category ASC
      `);
      return stmt.all().map((row): string => (row as Record<string, unknown>).category as string);
    } catch (error) {
      serverLogger.error('Error reading site categories from database:', error);
      return [];
    }
  }

  async clearSupportedSites(): Promise<void> {
    try {
      this.db.prepare('DELETE FROM supported_sites').run();
    } catch (error) {
      serverLogger.error('Error clearing supported_sites table:', error);
      throw new Error('Failed to clear supported sites.');
    }
  }

  async getSiteDataMeta(): Promise<SiteDataMeta> {
    try {
      const stmt = this.db.prepare('SELECT * FROM site_data_meta WHERE id = 1');
      const row = stmt.get();
      return row
        ? this.rowToSiteDataMeta(row as Record<string, unknown>)
        : {
            last_fetch_attempt: 0,
            last_successful_fetch: 0,
            sites_count: 0,
            fetch_error: undefined,
          };
    } catch (error) {
      serverLogger.error('Error reading site data meta from database:', error);
      return {
        last_fetch_attempt: 0,
        last_successful_fetch: 0,
        sites_count: 0,
        fetch_error: undefined,
      };
    }
  }

  async updateSiteDataMeta(updates: Partial<SiteDataMeta>): Promise<void> {
    try {
      const now = getCurrentTimestamp();
      const fields = [];
      const values = [];

      if (updates.last_fetch_attempt !== undefined) {
        fields.push('last_fetch_attempt');
        values.push(updates.last_fetch_attempt);
      }
      if (updates.last_successful_fetch !== undefined) {
        fields.push('last_successful_fetch');
        values.push(updates.last_successful_fetch);
      }
      if (updates.sites_count !== undefined) {
        fields.push('sites_count');
        values.push(updates.sites_count);
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'fetch_error')) {
        fields.push('fetch_error');
        values.push(updates.fetch_error);
      }

      if (fields.length === 0) {
        return;
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO site_data_meta (id, ${fields.join(', ')}, created_at, updated_at)
        VALUES (1, ${fields.map(() => '?').join(', ')}, 
          COALESCE((SELECT created_at FROM site_data_meta WHERE id = 1), ?), 
          ?)
      `);

      stmt.run(...values, now, now);
    } catch (error) {
      serverLogger.error('Error updating site data meta in database:', error);
      throw new Error('Failed to update site data meta.');
    }
  }

  async getCliOptionsForUrl(url: string): Promise<Array<[string, string | number | boolean]>> {
    try {
      const configs = await this.getSiteConfigsAll();

      const matchingConfigs = configs.filter(
        config => config.enabled && this.urlMatchesPattern(url, config.site_pattern)
      );

      if (matchingConfigs.length === 0) {
        return [];
      }

      const selectedConfig = matchingConfigs[0];
      serverLogger.info('Matched URL to site config', {
        url,
        configName: selectedConfig.display_name,
        pattern: selectedConfig.site_pattern,
      });
      serverLogger.debug('Applying CLI options for site config', {
        options: selectedConfig.cli_options,
      });

      return selectedConfig.cli_options;
    } catch (error) {
      serverLogger.error('Error getting CLI options for URL:', error);
      return [];
    }
  }

  async getConfigMetadataForUrl(url: string): Promise<{
    hasMatch: boolean;
    matchedPattern?: string;
    configName?: string;
    options: Map<string, string | number | boolean>;
  }> {
    try {
      const configs = await this.getSiteConfigsAll();

      const matchingConfigs = configs.filter(
        config => config.enabled && this.urlMatchesPattern(url, config.site_pattern)
      );

      if (matchingConfigs.length === 0) {
        return {
          hasMatch: false,
          options: new Map(),
        };
      }

      const selectedConfig = matchingConfigs[0];
      serverLogger.info('Matched URL to site config', {
        url,
        configName: selectedConfig.display_name,
        pattern: selectedConfig.site_pattern,
      });

      // Convert cli_options array to Map
      const optionsMap = new Map<string, string | number | boolean>();
      for (const [key, value] of selectedConfig.cli_options) {
        optionsMap.set(key, value);
      }

      return {
        hasMatch: true,
        matchedPattern: selectedConfig.site_pattern,
        configName: selectedConfig.display_name,
        options: optionsMap,
      };
    } catch (error) {
      serverLogger.error('Error getting config metadata for URL:', error);
      return {
        hasMatch: false,
        options: new Map(),
      };
    }
  }

  private urlMatchesPattern(url: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const regexPattern = pattern.toLowerCase().replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(hostname);
    } catch {
      return false;
    }
  }

  private rowToSiteConfig(row: Record<string, unknown>): SiteConfig {
    return {
      id: row.id as number,
      site_pattern: row.site_pattern as string,
      display_name: row.display_name as string,
      cli_options: JSON.parse((row.cli_options as string) || '[]'),
      is_default: Boolean(row.is_default),
      enabled: Boolean(row.enabled),
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
    };
  }

  private rowToSupportedSite(row: Record<string, unknown>): SupportedSite {
    return {
      id: row.id as number,
      name: row.name as string,
      url: row.url as string,
      url_pattern: row.url_pattern as string,
      category: row.category as string | undefined,
      capabilities: JSON.parse((row.capabilities as string) || '[]'),
      auth_supported: Boolean(row.auth_supported),
      last_fetched: row.last_fetched as number,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
    };
  }

  private rowToSiteDataMeta(row: Record<string, unknown>): SiteDataMeta {
    return {
      id: row.id as number,
      last_fetch_attempt: row.last_fetch_attempt as number,
      last_successful_fetch: row.last_successful_fetch as number,
      sites_count: row.sites_count as number,
      fetch_error: row.fetch_error as string | undefined,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
    };
  }
}

export const siteConfigManager = new SiteConfigManager();
