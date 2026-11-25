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
import { jobQueue } from './jobQueue';
import { buildQueuedExecution, type QueuedExecutionInput } from './queuedExecution';
import { serverLogger as logger } from '$lib/server/logger';
import { GALLERY_DL_MODE } from '$lib/server/galleryDlMode';
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
  status?: 'waiting' | 'running';
}

export interface GalleryDlCommandOptions {
  fallbackUrls?: string[];
  fallbackCliArgs?: string[];
  fallbackDiagnostic?: string;
}

export interface GalleryDlBatchCommandOptions {
  cookieUrl?: string;
}

const START_FAILURE_MESSAGE = 'gallery-dl could not be started. Check the server logs for details.';

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

async function queueExecution(
  input: QueuedExecutionInput,
  batchCount?: number,
): Promise<CommandExecutionResult> {
  try {
    const jobId = await jobManager.createQueuedJob(
      input.url,
      buildQueuedExecution(input, GALLERY_DL_MODE),
      batchCount,
    );
    const job = await jobManager.getJob(jobId);
    return { success: true, jobId, status: job?.status === 'running' ? 'running' : 'waiting' };
  } catch (error) {
    logger.error('Failed to queue gallery-dl command:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function reportStartFailure(jobId: string, error: unknown): Promise<void> {
  logger.error(`Failed to start gallery-dl for job ${jobId}:`, error);
  const message =
    error instanceof ConfigExecutionBlockedError ? error.clientMessage : START_FAILURE_MESSAGE;
  await jobManager.failJob(jobId, message);
}

// Kills the process when its job was deleted while it was starting.
async function attachProcess(jobId: string, ptyProcess: IPty): Promise<boolean> {
  if (await jobManager.setJobProcess(jobId, ptyProcess)) {
    return true;
  }
  logger.info(`Job ${jobId} was deleted while starting; killing PID ${ptyProcess.pid}`);
  ptyProcess.kill();
  return false;
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

  return queueExecution({ kind: 'single', url, cliArgs, options });
}

async function startGalleryDlCommand(
  jobId: string,
  url: string,
  cliArgs: string[],
  options?: GalleryDlCommandOptions,
): Promise<void> {
  try {
    await assertConfigFileSafeForExecution();

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

    if (!(await attachProcess(jobId, ptyProcess))) {
      return;
    }
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

        let handedOff = false;
        if (isUnsupportedUrlExit(exitCode)) {
          if (options?.fallbackUrls?.length) {
            try {
              const fb = await executeGalleryDlBatchCommand(
                options.fallbackUrls,
                options.fallbackCliArgs ?? [],
                { cookieUrl: url },
              );
              if (fb.success && fb.jobId) {
                handedOff = true;
                const queued = fb.status === 'waiting';
                await jobManager.addOutput(
                  fb.jobId,
                  'info',
                  `${queued ? 'Queued' : 'Started'} as a direct-link fallback for unsupported URL ${url} (job ${jobId})`,
                );
                await jobManager.addOutput(
                  jobId,
                  'info',
                  `Unsupported URL, ${queued ? 'queued' : 'started'} direct-link fallback job ${fb.jobId} for ${options.fallbackUrls.length} extracted URL(s)`,
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

        // A handed-off job can't replay as a retry would queue a second fallback batch.
        await jobManager.completeJob(jobId, exitCode || 0, { retryable: !handedOff });
      },
    );
  } catch (error) {
    await reportStartFailure(jobId, error);
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

  return queueExecution(
    { kind: 'batch', url: 'directlink batch', urls, cliArgs, options },
    urls.length,
  );
}

async function startGalleryDlBatchCommand(
  jobId: string,
  urls: string[],
  cliArgs: string[],
  options?: GalleryDlBatchCommandOptions,
): Promise<void> {
  try {
    await assertConfigFileSafeForExecution();
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

    if (!(await attachProcess(jobId, ptyProcess))) {
      return;
    }
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
  } catch (error) {
    await reportStartFailure(jobId, error);
  }
}

jobQueue.registerHandlers({
  start: async (jobId, payload, startTime) => {
    if (!jobManager.markQueuedJobRunning(jobId, startTime)) {
      return;
    }
    if (payload.kind === 'single') {
      const { fallbackUrls, fallbackCliArgs, fallbackDiagnostic } = payload.options ?? {};
      await startGalleryDlCommand(jobId, payload.url, payload.cliArgs, {
        fallbackUrls,
        fallbackCliArgs,
        fallbackDiagnostic,
      });
    } else {
      await startGalleryDlBatchCommand(jobId, payload.urls ?? [], payload.cliArgs, {
        cookieUrl: payload.options?.cookieUrl,
      });
    }
  },
  fail: (jobId, message, retryable) => jobManager.failJob(jobId, message, { retryable }),
});
