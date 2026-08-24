/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { spawn } from '@homebridge/node-pty-prebuilt-multiarch';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { jobManager } from './jobManager';
import { serverLogger as logger } from '$lib/server/logger';
import { PATHS, TERMINAL } from '$lib/server/constants';
import { redactSensitiveArgs } from '$lib/server/validation/option-validation';
import { getCookieFileForUrl } from '$lib/server/cookieFileManager';
import { isUnsupportedUrlExit } from './galleryDlExit';
import { assertConfigFileSafeForExecution } from './configGuard';
import { ConfigExecutionBlockedError } from '$lib/server/validation/exec-policy';

export interface CommandExecutionResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface GalleryDlCommandOptions {
  fallbackUrls?: string[];
  fallbackCliArgs?: string[];
  fallbackDiagnostic?: string;
}

export interface GalleryDlBatchCommandOptions {
  cookieUrl?: string;
}

async function withCookieArgs(candidateUrls: string[], cliArgs: string[]): Promise<string[]> {
  if (cliArgs.includes('--cookies')) {
    return cliArgs;
  }

  for (const url of candidateUrls) {
    if (!url) {
      continue;
    }
    const cookieFile = await getCookieFileForUrl(url);
    if (cookieFile) {
      return [...cliArgs, '--cookies', cookieFile];
    }
  }

  return cliArgs;
}

export async function executeGalleryDlCommand(
  url: string,
  cliArgs: string[],
  options?: GalleryDlCommandOptions,
): Promise<CommandExecutionResult> {
  // This layer reports per-URL failures as results; throwing a policy failure
  // would let callers flatten it into an unrelated route-level error.
  try {
    await assertConfigFileSafeForExecution();
  } catch (error) {
    if (error instanceof ConfigExecutionBlockedError) {
      logger.error('Refusing to spawn gallery-dl:', error.violations);
      return { success: false, error: error.clientMessage };
    }
    throw error;
  }

  let createdJobId: string | undefined;
  try {
    const jobId = await jobManager.createJob(url);
    createdJobId = jobId;

    const argsWithCookies = await withCookieArgs([url], cliArgs);
    const processArgs = [...argsWithCookies, '--config', PATHS.CONFIG_FILE, url];

    logger.info(
      `Starting gallery-dl process for job ${jobId} with args:`,
      redactSensitiveArgs(processArgs),
    );

    const ptyProcess: IPty = spawn(PATHS.BIN_FILE, processArgs, {
      name: TERMINAL.NAME,
      cols: TERMINAL.COLS,
      rows: TERMINAL.ROWS,
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: '0', TERM: TERMINAL.NAME },
    });

    await jobManager.setJobProcess(jobId, ptyProcess);
    await jobManager.addOutput(jobId, 'info', `Process started with PID: ${ptyProcess.pid}`);

    ptyProcess.onData(async (data: string): Promise<void> => {
      await jobManager.addOutput(jobId, 'stdout', data);
    });

    ptyProcess.onExit(
      async ({
        exitCode,
        signal,
      }: {
        exitCode: number;
        signal?: number | undefined;
      }): Promise<void> => {
        logger.info(`Process for job ${jobId} exited with code ${exitCode}, signal ${signal}`);

        if (isUnsupportedUrlExit(exitCode)) {
          if (options?.fallbackUrls?.length) {
            try {
              const fb = await executeGalleryDlBatchCommand(
                options.fallbackUrls,
                options.fallbackCliArgs ?? [],
                { cookieUrl: url },
              );
              if (fb.success && fb.jobId) {
                await jobManager.addOutput(
                  fb.jobId,
                  'info',
                  `Started as a direct-link fallback for unsupported URL ${url} (job ${jobId})`,
                );
                await jobManager.addOutput(
                  jobId,
                  'info',
                  `Unsupported URL, started direct-link fallback job ${fb.jobId} for ${options.fallbackUrls.length} extracted URL(s)`,
                );
              }
            } catch (error) {
              logger.error(`Fallback batch failed for job ${jobId}:`, error);
            }
          } else if (options?.fallbackDiagnostic) {
            logger.warn(
              `Job ${jobId} exited unsupported (code ${exitCode}) with no fallback batch to run: ${options.fallbackDiagnostic}. url=${url}`,
            );
          }
          // No `options` at all e.g. /api/command/start, which never passes
          // a GalleryDlCommandOptions
        }

        await jobManager.completeJob(jobId, exitCode || 0);
      },
    );

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    logger.error('Failed to execute gallery-dl command:', error);
    if (createdJobId) {
      await jobManager.completeJob(createdJobId, 1);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function executeGalleryDlBatchCommand(
  urls: string[],
  cliArgs: string[],
  options?: GalleryDlBatchCommandOptions,
): Promise<CommandExecutionResult> {
  try {
    await assertConfigFileSafeForExecution();
  } catch (error) {
    if (error instanceof ConfigExecutionBlockedError) {
      logger.error('Refusing to spawn gallery-dl:', error.violations);
      return { success: false, error: error.clientMessage };
    }
    throw error;
  }

  let createdJobId: string | undefined;
  try {
    const jobId = await jobManager.createBatchJob(urls);
    createdJobId = jobId;
    const cookieCandidates = [...new Set([options?.cookieUrl, urls[0]])].filter((u): u is string =>
      Boolean(u),
    );
    const argsWithCookies = await withCookieArgs(cookieCandidates, cliArgs);
    const processArgs = [...argsWithCookies, '--config', PATHS.CONFIG_FILE, ...urls];

    logger.info(`Starting gallery-dl batch process for job ${jobId} with ${urls.length} URL(s)`);

    const ptyProcess: IPty = spawn(PATHS.BIN_FILE, processArgs, {
      name: TERMINAL.NAME,
      cols: TERMINAL.COLS,
      rows: TERMINAL.ROWS,
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: '0', TERM: TERMINAL.NAME },
    });

    await jobManager.setJobProcess(jobId, ptyProcess);
    await jobManager.addOutput(
      jobId,
      'info',
      `Batch process started with PID: ${ptyProcess.pid} for ${urls.length} URL(s)`,
    );

    ptyProcess.onData(async (data: string): Promise<void> => {
      await jobManager.addOutput(jobId, 'stdout', data);
    });

    ptyProcess.onExit(
      async ({
        exitCode,
        signal,
      }: {
        exitCode: number;
        signal?: number | undefined;
      }): Promise<void> => {
        logger.info(
          `Batch process for job ${jobId} exited with code ${exitCode}, signal ${signal}`,
        );
        await jobManager.completeJob(jobId, exitCode || 0);
      },
    );

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    logger.error('Failed to execute gallery-dl batch command:', error);
    if (createdJobId) {
      await jobManager.completeJob(createdJobId, 1);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
