/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import fs from 'node:fs';
import { PATHS } from '$lib/server/constants';
import { validateAndBuildCliArgs } from '$lib/server/validation/option-validation';
import { executeGalleryDlCommand } from './commandExecutor';
import { assertConfigFileSafeForExecution } from './configGuard';

export class BinaryUnavailableError extends Error {}

export interface LaunchResult {
  url: string;
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface LaunchRequest {
  urls: string[];
  args: Array<[string, string | number | boolean]>;
  excludedOptions: string[];
  resolveSiteOptions: (url: string) => Promise<Array<[string, string | number | boolean]>>;
  onLaunched?: (result: LaunchResult) => void;
}

export async function launchUrls(req: LaunchRequest): Promise<LaunchResult[]> {
  try {
    fs.accessSync(PATHS.BIN_FILE, fs.constants.X_OK);
  } catch {
    throw new BinaryUnavailableError('gallery-dl.bin not found or not executable');
  }

  // Fails the whole batch once rather than once per URL; neither this nor
  // the ProhibitedOptionError from validateAndBuildCliArgs is caught here —
  // both propagate to the caller (REM-006).
  await assertConfigFileSafeForExecution();

  const excluded = new Set(req.excludedOptions);
  const results: LaunchResult[] = [];

  for (const url of req.urls) {
    const siteOptions = (await req.resolveSiteOptions(url)).filter(
      ([optionId]) => !excluded.has(optionId),
    );

    const mergedArgs = new Map<string, string | number | boolean>();
    for (const [optionId, value] of [...siteOptions, ...req.args]) {
      mergedArgs.set(optionId, value);
    }

    const cliArgs = validateAndBuildCliArgs(mergedArgs);
    const executed = await executeGalleryDlCommand(url, cliArgs);

    const result: LaunchResult =
      executed.success && executed.jobId
        ? { url, success: true, jobId: executed.jobId }
        : { url, success: false, error: executed.error || 'Failed to start job' };

    results.push(result);
    req.onLaunched?.(result);
  }

  return results;
}
