/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CreateScheduleInput } from '$lib/server/schedules/scheduleManager';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync: readSchema } = await import('node:fs');
  const database = new Database(':memory:');
  const schemaUrl = new URL('../src/lib/server/schema.sql', import.meta.url);
  database.exec(readSchema(schemaUrl, 'utf8'));
  return { db: database };
});

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => db,
  getSharedDatabase: () => db,
}));

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('$lib/server/environment', () => ({
  isRunningInDockerCached: () => false,
}));

let currentGuardConfigFile = '';
let currentDataDir = '';
vi.mock('$lib/server/constants', () => ({
  PATHS: {
    get BIN_FILE() {
      return join(currentDataDir, 'gallery-dl.bin');
    },
    get DATA_DIR() {
      return currentDataDir;
    },
    get CONFIG_FILE() {
      return currentGuardConfigFile;
    },
    get COOKIES_DIR() {
      return join(currentDataDir, 'cookies');
    },
  },
  TERMINAL: { NAME: 'xterm-256color', COLS: 120, ROWS: 30 },
  API_LIMITS: { MAX_BATCH_URLS: 10000 },
}));

const executeGalleryDlCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
  executeGalleryDlBatchCommand: vi.fn(),
}));

const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;
const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;
const SEED_TS = 1_700_000_000_000;

function seedUser(): void {
  db.prepare('INSERT INTO user (id, email, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(
    'user-1',
    'user-1@example.test',
    SEED_TS,
    SEED_TS,
  );
}

function scheduleInput(): CreateScheduleInput {
  return {
    userId: 'user-1',
    name: 'Mode flip schedule',
    status: 'active',
    timezone: 'UTC',
    recurrence: { kind: 'daily', time: '09:00' },
    startDate: '2026-01-01',
    endDate: null,
    misfirePolicy: 'skip',
    commandSource: {
      urls: ['https://schedule.mode-flip.invalid/gallery/1'],
      userOptions: [['exec', 'schedule-command-sentinel']],
      excludedOptions: [],
    },
    siteOptionsSnapshot: {},
    nextOccurrenceAt: SEED_TS + 1000,
  };
}

async function loadMode(mode: 'restricted' | 'unrestricted') {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
  const [configUtils, configGuard, commandLauncher, execPolicy, siteConfigModule, scheduleManager] =
    await Promise.all([
      import('$lib/server/config-utils'),
      import('$lib/server/jobs/configGuard'),
      import('$lib/server/jobs/commandLauncher'),
      import('$lib/server/validation/exec-policy'),
      import('$lib/server/siteConfigManager'),
      import('$lib/server/schedules/scheduleManager'),
    ]);
  return {
    configUtils,
    configGuard,
    launchUrls: commandLauncher.launchUrls,
    execPolicy,
    siteConfigManager: siteConfigModule.siteConfigManager,
    scheduleManager,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.exec('DELETE FROM schedules; DELETE FROM site_configs; DELETE FROM user;');
  currentDataDir = mkdtempSync(join(tmpdir(), 'gdluxx-mode-flip-'));
  currentGuardConfigFile = join(currentDataDir, 'config.json');
  writeFileSync(join(currentDataDir, 'gallery-dl.bin'), '', { mode: 0o755 });
  process.env.FILE_STORAGE_PATH = currentDataDir;
});

afterEach(() => {
  db.exec('DELETE FROM schedules; DELETE FROM site_configs; DELETE FROM user;');
  rmSync(currentDataDir, { recursive: true, force: true });
  if (ORIGINAL_FILE_STORAGE_PATH === undefined) {
    delete process.env.FILE_STORAGE_PATH;
  } else {
    process.env.FILE_STORAGE_PATH = ORIGINAL_FILE_STORAGE_PATH;
  }
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
  vi.resetModules();
});

describe('gallery-dl deployment mode restart integration', () => {
  test('switching to Restricted retains stored data and blocks later writes and launches', async () => {
    const unrestricted = await loadMode('unrestricted');
    seedUser();
    const configBytes = JSON.stringify({
      extractor: { command: ['config-command-sentinel'] },
    });
    await unrestricted.configUtils.writeConfigFile(configBytes);
    await unrestricted.configGuard.assertConfigFileSafeForExecution();

    const siteConfigId = await unrestricted.siteConfigManager.createSiteConfig({
      site_pattern: 'site.mode-flip.invalid',
      display_name: 'Mode flip rule',
      cli_options: [['exec-after', 'site-command-sentinel']],
      is_default: false,
      enabled: true,
    });
    const schedule = unrestricted.scheduleManager.createSchedule(scheduleInput());
    const siteRowBefore = db.prepare('SELECT * FROM site_configs WHERE id = ?').get(siteConfigId);
    const scheduleRowBefore = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id);

    const restricted = await loadMode('restricted');
    executeGalleryDlCommandMock.mockClear();
    const storedSchedule = restricted.scheduleManager.readScheduleForUser(schedule.id, 'user-1');
    const storedSiteConfig = await restricted.siteConfigManager.getSiteConfigById(siteConfigId);

    await expect(
      restricted.configUtils.writeConfigFile(
        JSON.stringify({ extractor: { commands: ['replacement-command-sentinel'] } }),
      ),
    ).rejects.toThrow();
    expect(readFileSync(join(currentDataDir, 'config.json'), 'utf8')).toBe(configBytes);

    await expect(
      restricted.launchUrls({
        urls: ['https://config.mode-flip.invalid/gallery/1'],
        args: [],
        excludedOptions: [],
        resolveSiteOptions: async () => [],
      }),
    ).rejects.toBeInstanceOf(restricted.execPolicy.ConfigExecutionBlockedError);

    currentGuardConfigFile = join(currentDataDir, 'benign-config.json');
    writeFileSync(currentGuardConfigFile, JSON.stringify({ extractor: {} }), 'utf8');
    restricted.configGuard.resetConfigGuardCache();

    expect(storedSchedule).not.toBeNull();
    await expect(
      restricted.launchUrls({
        urls: storedSchedule?.commandSource.urls ?? [],
        args: (storedSchedule?.commandSource.userOptions ?? []) as Array<
          [string, string | number | boolean]
        >,
        excludedOptions: storedSchedule?.commandSource.excludedOptions ?? [],
        resolveSiteOptions: async () => [],
      }),
    ).rejects.toBeInstanceOf(restricted.execPolicy.ProhibitedOptionError);

    await expect(
      restricted.launchUrls({
        urls: ['https://site.mode-flip.invalid/gallery/1'],
        args: [],
        excludedOptions: [],
        resolveSiteOptions: (url) => restricted.siteConfigManager.getCliOptionsForUrl(url),
      }),
    ).rejects.toBeInstanceOf(restricted.execPolicy.ProhibitedOptionError);

    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
    expect(storedSiteConfig?.cli_options).toEqual([['exec-after', 'site-command-sentinel']]);
    expect(db.prepare('SELECT * FROM site_configs WHERE id = ?').get(siteConfigId)).toEqual(
      siteRowBefore,
    );
    expect(db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id)).toEqual(
      scheduleRowBefore,
    );
    expect(readFileSync(join(currentDataDir, 'config.json'), 'utf8')).toBe(configBytes);
  });
});
