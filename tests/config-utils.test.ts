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
import { mkdtemp, readdir, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const ORIGINAL_DOWNLOAD_PATH = process.env.DOWNLOAD_PATH;
const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;

const warnMock = vi.fn();

vi.mock('../src/lib/server/environment', () => ({
  isRunningInDockerCached: () => dockerMockValue,
}));

vi.mock('../src/lib/server/logger', () => ({
  serverLogger: {
    warn: (...args: unknown[]) => warnMock(...args),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mutable flag read by the environment mock above; each test sets this
// before importing the module under test.
let dockerMockValue = true;

async function loadConfigUtils() {
  vi.resetModules();
  return import('../src/lib/server/config-utils');
}

type ConfigUtilsModule = Awaited<ReturnType<typeof loadConfigUtils>>;

function transformBaseDirectory(mod: ConfigUtilsModule, value: string): string {
  return mod.transformPath(value, {
    replacementPath: () => mod.getDownloadRoot().base,
    preserveFilename: false,
    usesDownloadRoot: true,
  });
}

function transformPartDirectory(mod: ConfigUtilsModule, value: string): string {
  return mod.transformPath(value, {
    replacementPath: () => mod.getDownloadRoot().partDirectory,
    preserveFilename: false,
    usesDownloadRoot: true,
  });
}

function transformArchive(mod: ConfigUtilsModule, value: string): string {
  return mod.transformPath(value, {
    replacementPath: '/app/data/archives',
    preserveFilename: true,
  });
}

beforeEach(() => {
  warnMock.mockClear();
  dockerMockValue = true;
  if (ORIGINAL_DOWNLOAD_PATH === undefined) {
    delete process.env.DOWNLOAD_PATH;
  } else {
    process.env.DOWNLOAD_PATH = ORIGINAL_DOWNLOAD_PATH;
  }
});

afterEach(() => {
  if (ORIGINAL_DOWNLOAD_PATH === undefined) {
    delete process.env.DOWNLOAD_PATH;
  } else {
    process.env.DOWNLOAD_PATH = ORIGINAL_DOWNLOAD_PATH;
  }
});

describe('config-utils download root (Docker)', () => {
  test('default (unset DOWNLOAD_PATH) rewrites to /app/data/downloads and /app/data/temp', async () => {
    delete process.env.DOWNLOAD_PATH;
    const mod = await loadConfigUtils();

    expect(mod.getDownloadRoot()).toEqual({
      base: '/app/data/downloads',
      partDirectory: '/app/data/temp',
    });
    expect(transformBaseDirectory(mod, '~/gallery-dl/')).toBe('/app/data/downloads');
    expect(transformPartDirectory(mod, '~/gallery-dl/tmp')).toBe('/app/data/temp');
    expect(warnMock).not.toHaveBeenCalled();
  });

  test('custom root rewrites base-directory and part-directory, leaves paths under root untouched, applies prefix semantics, and keeps archives under /app/data', async () => {
    process.env.DOWNLOAD_PATH = '/downloads';
    const mod = await loadConfigUtils();

    expect(mod.getDownloadRoot()).toEqual({
      base: '/downloads',
      partDirectory: '/downloads/temp',
    });

    expect(transformBaseDirectory(mod, '~/gallery-dl/')).toBe('/downloads');
    expect(transformPartDirectory(mod, '~/gallery-dl/tmp')).toBe('/downloads/temp');

    // Already under the configured root: left untouched.
    expect(transformBaseDirectory(mod, '/downloads/foo')).toBe('/downloads/foo');
    expect(transformBaseDirectory(mod, '/downloads')).toBe('/downloads');

    // Prefix semantics: a sibling directory that merely starts with the same
    // string must still be rewritten.
    expect(transformBaseDirectory(mod, '/downloads-other/x')).toBe('/downloads');

    // Archive/cookies keys are unaffected by the custom download root.
    expect(transformArchive(mod, '/some/archive.sqlite3')).toBe(
      '/app/data/archives/archive.sqlite3',
    );

    expect(warnMock).not.toHaveBeenCalled();
  });

  test('custom root migrates existing /app/data download paths from earlier saves', async () => {
    process.env.DOWNLOAD_PATH = '/downloads';
    const mod = await loadConfigUtils();

    // An existing install has already had its paths rewritten to the old
    // defaults; setting DOWNLOAD_PATH and re-saving must move them.
    expect(transformBaseDirectory(mod, '/app/data/downloads')).toBe('/downloads');
    expect(transformPartDirectory(mod, '/app/data/temp')).toBe('/downloads/temp');
    expect(transformBaseDirectory(mod, '/app/data/gallery-dl/whatever')).toBe('/downloads');
  });

  test('custom root does not exempt non-download keys already under it', async () => {
    process.env.DOWNLOAD_PATH = '/media';
    const mod = await loadConfigUtils();

    // Archive files must still be collected under /app/data/archives even
    // when they happen to live under the custom download root.
    expect(transformArchive(mod, '/media/archive.db')).toBe('/app/data/archives/archive.db');
  });

  test('transformConfigPaths end-to-end with a custom root', async () => {
    process.env.DOWNLOAD_PATH = '/media';
    const mod = await loadConfigUtils();

    const input = JSON.stringify({
      extractor: {
        'base-directory': '/app/data/downloads',
        twitter: {
          archive: '/media/archive.db',
        },
      },
      downloader: {
        'part-directory': '/app/data/temp',
      },
    });

    const output = JSON.parse(mod.transformConfigPaths(input)) as {
      extractor: { 'base-directory': string; twitter: { archive: string } };
      downloader: { 'part-directory': string };
    };

    expect(output.extractor['base-directory']).toBe('/media');
    expect(output.downloader['part-directory']).toBe('/media/temp');
    expect(output.extractor.twitter.archive).toBe('/app/data/archives/archive.db');
  });

  test('unset DOWNLOAD_PATH leaves existing /app/data values untouched (legacy behavior)', async () => {
    delete process.env.DOWNLOAD_PATH;
    const mod = await loadConfigUtils();

    expect(transformBaseDirectory(mod, '/app/data/downloads')).toBe('/app/data/downloads');
    expect(transformBaseDirectory(mod, '/app/data/gallery-dl/whatever')).toBe(
      '/app/data/gallery-dl/whatever',
    );
    expect(transformPartDirectory(mod, '/app/data/temp')).toBe('/app/data/temp');
  });

  test('trailing slash on DOWNLOAD_PATH is normalized', async () => {
    process.env.DOWNLOAD_PATH = '/downloads/';
    const mod = await loadConfigUtils();

    expect(mod.getDownloadRoot()).toEqual({
      base: '/downloads',
      partDirectory: '/downloads/temp',
    });
  });

  test('invalid relative DOWNLOAD_PATH falls back to defaults and warns once', async () => {
    process.env.DOWNLOAD_PATH = 'downloads';
    const mod = await loadConfigUtils();

    expect(mod.getDownloadRoot()).toEqual({
      base: '/app/data/downloads',
      partDirectory: '/app/data/temp',
    });
    expect(transformBaseDirectory(mod, '~/gallery-dl/')).toBe('/app/data/downloads');
    expect(warnMock).toHaveBeenCalledTimes(1);
  });

  test('not running in Docker: paths are left untouched regardless of DOWNLOAD_PATH', async () => {
    dockerMockValue = false;
    process.env.DOWNLOAD_PATH = '/downloads';
    const mod = await loadConfigUtils();

    expect(transformBaseDirectory(mod, '~/gallery-dl/')).toBe('~/gallery-dl/');
    expect(transformPartDirectory(mod, '~/gallery-dl/tmp')).toBe('~/gallery-dl/tmp');
    expect(warnMock).not.toHaveBeenCalled();
  });
});

describe('writeConfigFile (atomic write + rotating history)', () => {
  let dataDir: string;

  beforeEach(async () => {
    dockerMockValue = false;
    dataDir = await mkdtemp(join(tmpdir(), 'gdluxx-config-utils-'));
    process.env.FILE_STORAGE_PATH = dataDir;
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    if (ORIGINAL_FILE_STORAGE_PATH === undefined) {
      delete process.env.FILE_STORAGE_PATH;
    } else {
      process.env.FILE_STORAGE_PATH = ORIGINAL_FILE_STORAGE_PATH;
    }
  });

  test('first write (no existing config.json): writes via tmp+rename, no history snapshot', async () => {
    const mod = await loadConfigUtils();
    const content = JSON.stringify({ a: 1 }, null, 2);

    const result = await mod.writeConfigFile(content);

    expect(result.success).toBe(true);
    expect(result.transformed).toBe(false);

    const written = await readFile(join(dataDir, 'config.json'), 'utf-8');
    expect(written).toBe(content);

    await expect(readFile(join(dataDir, 'config.json.tmp'), 'utf-8')).rejects.toThrow();

    await expect(readdir(join(dataDir, 'config-history'))).rejects.toThrow();
  });

  test('changed content: snapshots the previous content to config-history before overwriting', async () => {
    const mod = await loadConfigUtils();
    const first = JSON.stringify({ a: 1 }, null, 2);
    const second = JSON.stringify({ a: 2 }, null, 2);

    await mod.writeConfigFile(first);
    const result = await mod.writeConfigFile(second);

    expect(result.success).toBe(true);
    const written = await readFile(join(dataDir, 'config.json'), 'utf-8');
    expect(written).toBe(second);

    const historyDir = join(dataDir, 'config-history');
    const snapshots = await readdir(historyDir);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatch(/^config-.*\.json$/);

    const snapshotContent = await readFile(join(historyDir, snapshots[0]), 'utf-8');
    expect(snapshotContent).toBe(first);
  });

  test('identical content: skips both the history snapshot and the write itself', async () => {
    const mod = await loadConfigUtils();
    const content = JSON.stringify({ a: 1 }, null, 2);

    await mod.writeConfigFile(content);
    const configPath = join(dataDir, 'config.json');
    const statBefore = await stat(configPath);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const result = await mod.writeConfigFile(content);
    const statAfter = await stat(configPath);

    expect(result.success).toBe(true);
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);

    await expect(readdir(join(dataDir, 'config-history'))).rejects.toThrow();
  });

  test('prunes config-history to the newest CONFIG_HISTORY_LIMIT snapshots', async () => {
    const mod = await loadConfigUtils();
    expect(mod.CONFIG_HISTORY_LIMIT).toBe(5);

    for (let i = 0; i < 7; i++) {
      await mod.writeConfigFile(JSON.stringify({ n: i }, null, 2));
    }

    const historyDir = join(dataDir, 'config-history');
    const snapshots = await readdir(historyDir);
    expect(snapshots).toHaveLength(mod.CONFIG_HISTORY_LIMIT);

    const contents = await Promise.all(
      snapshots.map((name) => readFile(join(historyDir, name), 'utf-8')),
    );
    const values = contents.map((c) => (JSON.parse(c) as { n: number }).n).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4, 5]);
  });
});
