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

export interface CommandExecutionResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export async function executeGalleryDlCommand(
  url: string,
  cliArgs: string[],
): Promise<CommandExecutionResult> {
  try {
    // Create job
    const jobId = await jobManager.createJob(url);

    // Build process arguments: [cliOptions..., --config, configPath, url]
    const processArgs = [...cliArgs, '--config', PATHS.CONFIG_FILE, url];

    logger.info(`Starting gallery-dl process for job ${jobId} with args:`, processArgs);

    // Spawn PTY process
    const ptyProcess: IPty = spawn(PATHS.BIN_FILE, processArgs, {
      name: TERMINAL.NAME,
      cols: TERMINAL.COLS,
      rows: TERMINAL.ROWS,
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: '0', TERM: TERMINAL.NAME },
    });

    // Set job process
    await jobManager.setJobProcess(jobId, ptyProcess);
    await jobManager.addOutput(jobId, 'info', `Process started with PID: ${ptyProcess.pid}`);

    // Set up data handler
    ptyProcess.onData(async (data: string): Promise<void> => {
      await jobManager.addOutput(jobId, 'stdout', data);
    });

    // Set up exit handler
    ptyProcess.onExit(
      async ({
        exitCode,
        signal,
      }: {
        exitCode: number;
        signal?: number | undefined;
      }): Promise<void> => {
        logger.info(`Process for job ${jobId} exited with code ${exitCode}, signal ${signal}`);
        await jobManager.completeJob(jobId, exitCode || 0);
      },
    );

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    logger.error('Failed to execute gallery-dl command:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
