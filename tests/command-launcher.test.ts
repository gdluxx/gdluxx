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

vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const executeGalleryDlCommandMock = vi.fn();
vi.mock('$lib/server/jobs/commandExecutor', () => ({
  executeGalleryDlCommand: (...args: unknown[]) => executeGalleryDlCommandMock(...args),
}));

const accessSyncMock = vi.fn();
vi.mock('node:fs', () => ({
  default: {
    accessSync: (...args: unknown[]) => accessSyncMock(...args),
    constants: { X_OK: 1 },
  },
}));

// Isolate option-containment assertions from machine-local persisted config.
vi.mock('$lib/server/jobs/configGuard', () => ({
  assertConfigFileSafeForExecution: vi.fn().mockResolvedValue(undefined),
  resetConfigGuardCache: vi.fn(),
}));

const { launchUrls, BinaryUnavailableError } = await import('$lib/server/jobs/commandLauncher');
const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

async function loadLauncherMode(mode: 'restricted' | 'unrestricted') {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
  const [commandLauncher, execPolicy, optionValidation] = await Promise.all([
    import('$lib/server/jobs/commandLauncher'),
    import('$lib/server/validation/exec-policy'),
    import('$lib/server/validation/option-validation'),
  ]);
  return { commandLauncher, execPolicy, optionValidation };
}

afterEach(() => {
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
  vi.resetModules();
});

describe('commandLauncher.launchUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessSyncMock.mockReturnValue(undefined);
  });

  test('throws BinaryUnavailableError (not a result array) when the binary check fails', async () => {
    accessSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(
      launchUrls({
        urls: ['https://example.com/a'],
        args: [],
        excludedOptions: [],
        resolveSiteOptions: vi.fn().mockResolvedValue([]),
      }),
    ).rejects.toBeInstanceOf(BinaryUnavailableError);

    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
  });

  test('merges site options and user args (user wins on conflicting ids); excluded ids never reach the merge', async () => {
    executeGalleryDlCommandMock.mockResolvedValue({ success: true, jobId: 'job-1' });
    const resolveSiteOptions = vi.fn().mockResolvedValue([
      ['username', 'site-user'],
      ['simulate', true],
    ]);

    await launchUrls({
      urls: ['https://example.com/a'],
      args: [['username', 'user-supplied']],
      excludedOptions: ['simulate'],
      resolveSiteOptions,
    });

    expect(executeGalleryDlCommandMock).toHaveBeenCalledTimes(1);
    const [, cliArgs] = executeGalleryDlCommandMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).toEqual(['--username', 'user-supplied']);
    expect(cliArgs).not.toContain('--simulate');
  });

  test('validateAndBuildCliArgs (real, unmocked) drops unknown option ids', async () => {
    executeGalleryDlCommandMock.mockResolvedValue({ success: true, jobId: 'job-1' });

    await launchUrls({
      urls: ['https://example.com/a'],
      args: [
        ['not-a-real-option', 'value'],
        ['simulate', true],
      ],
      excludedOptions: [],
      resolveSiteOptions: vi.fn().mockResolvedValue([]),
    });

    const [, cliArgs] = executeGalleryDlCommandMock.mock.calls[0] as [string, string[]];
    expect(cliArgs).toEqual(['--simulate']);
  });

  test('dispatches sequentially, one executor call per URL in request order', async () => {
    const callOrder: string[] = [];
    executeGalleryDlCommandMock.mockImplementation(async (url: string) => {
      callOrder.push(url);
      return { success: true, jobId: `job-for-${url}` };
    });

    await launchUrls({
      urls: ['https://a.example', 'https://b.example', 'https://c.example'],
      args: [],
      excludedOptions: [],
      resolveSiteOptions: vi.fn().mockResolvedValue([]),
    });

    expect(callOrder).toEqual(['https://a.example', 'https://b.example', 'https://c.example']);
  });

  test('onLaunched fires per URL with the settled result, success and failure alike', async () => {
    executeGalleryDlCommandMock
      .mockResolvedValueOnce({ success: true, jobId: 'job-a' })
      .mockResolvedValueOnce({ success: false, error: 'boom' });

    const onLaunched = vi.fn();

    const results = await launchUrls({
      urls: ['https://a.example', 'https://b.example'],
      args: [],
      excludedOptions: [],
      resolveSiteOptions: vi.fn().mockResolvedValue([]),
      onLaunched,
    });

    expect(results).toEqual([
      { url: 'https://a.example', success: true, jobId: 'job-a' },
      { url: 'https://b.example', success: false, error: 'boom' },
    ]);
    expect(onLaunched).toHaveBeenNthCalledWith(1, results[0]);
    expect(onLaunched).toHaveBeenNthCalledWith(2, results[1]);
  });

  test('a failed executor call with no error message falls back to a default message', async () => {
    executeGalleryDlCommandMock.mockResolvedValue({ success: false });

    const results = await launchUrls({
      urls: ['https://example.com/a'],
      args: [],
      excludedOptions: [],
      resolveSiteOptions: vi.fn().mockResolvedValue([]),
    });

    expect(results).toEqual([
      { url: 'https://example.com/a', success: false, error: 'Failed to start job' },
    ]);
  });
});

describe('commandLauncher.launchUrls deployment posture', () => {
  test('Restricted rejects every canonical prohibited option before execution', async () => {
    const { commandLauncher, execPolicy } = await loadLauncherMode('restricted');
    executeGalleryDlCommandMock.mockClear();
    const prohibitedOptions = Array.from(
      execPolicy.PROHIBITED_OPTION_IDS,
      (optionId) => [optionId, `restricted-${optionId}`] as [string, string],
    );

    await expect(
      commandLauncher.launchUrls({
        urls: ['https://example.com/a'],
        args: prohibitedOptions,
        excludedOptions: [],
        resolveSiteOptions: vi.fn().mockResolvedValue([]),
      }),
    ).rejects.toBeInstanceOf(execPolicy.ProhibitedOptionError);

    expect(executeGalleryDlCommandMock).not.toHaveBeenCalled();
  });

  test('Unrestricted builds every canonical catalog argv pair', async () => {
    const { commandLauncher, execPolicy, optionValidation } =
      await loadLauncherMode('unrestricted');
    executeGalleryDlCommandMock.mockClear();
    const options = Array.from(
      execPolicy.PROHIBITED_OPTION_IDS,
      (optionId) => [optionId, `value-${optionId}`] as [string, string],
    );
    const expectedArgs = options.flatMap(([optionId, value]) => [
      optionValidation.validOptions.get(optionId)?.command,
      value,
    ]);

    await commandLauncher.launchUrls({
      urls: ['https://example.com/a'],
      args: options,
      excludedOptions: [],
      resolveSiteOptions: vi.fn().mockResolvedValue([]),
    });

    expect(expectedArgs).not.toContain(undefined);
    expect(executeGalleryDlCommandMock).toHaveBeenCalledWith('https://example.com/a', expectedArgs);
  });

  test('Unrestricted keeps Run-over-Site-Rule Map precedence for canonical ids', async () => {
    const { commandLauncher, execPolicy, optionValidation } =
      await loadLauncherMode('unrestricted');
    executeGalleryDlCommandMock.mockClear();
    const siteOptions = Array.from(
      execPolicy.PROHIBITED_OPTION_IDS,
      (optionId) => [optionId, `site-${optionId}`] as [string, string],
    );
    const runOptions = Array.from(
      execPolicy.PROHIBITED_OPTION_IDS,
      (optionId) => [optionId, `run-${optionId}`] as [string, string],
    );
    const expectedArgs = runOptions.flatMap(([optionId, value]) => [
      optionValidation.validOptions.get(optionId)?.command,
      value,
    ]);

    await commandLauncher.launchUrls({
      urls: ['https://example.com/a'],
      args: runOptions,
      excludedOptions: [],
      resolveSiteOptions: vi.fn().mockResolvedValue(siteOptions),
    });

    expect(expectedArgs).not.toContain(undefined);
    expect(executeGalleryDlCommandMock).toHaveBeenCalledWith('https://example.com/a', expectedArgs);
    expect(JSON.stringify(executeGalleryDlCommandMock.mock.calls)).not.toContain('site-exec');
  });
});
