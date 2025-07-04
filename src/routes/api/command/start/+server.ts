/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { jobManager } from '$lib/server/jobManager';
import { logger } from '$lib/shared/logger';
import { PATHS, TERMINAL } from '$lib/server/constants';
import type { BatchUrlResult } from '$lib/stores/jobs';

export async function POST({ request }: { request: Request }): Promise<Response> {
  const { spawn } = await import('@homebridge/node-pty-prebuilt-multiarch');

  try {
    const { urls, useUserConfigPath = false } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return json(
        {
          overallSuccess: false,
          results: [],
          error: 'An array of URLs is required and cannot be empty',
        },
        { status: 400 }
      );
    }

    try {
      fs.accessSync(PATHS.BIN_FILE, fs.constants.X_OK);
    } catch (err) {
      logger.error('gallery-dl.bin not found or not executable:', err);
      return json(
        {
          overallSuccess: false,
          results: urls.map((url: string) => ({
            url,
            success: false,
            error: 'gallery-dl.bin not found or not executable',
          })),
        },
        { status: 500 }
      );
    }

    const batchResults: BatchUrlResult[] = [];
    let overallSuccess = true;

    for (const url of urls) {
      if (typeof url !== 'string' || !url.trim()) {
        batchResults.push({
          url: url || 'INVALID_URL_ENTRY',
          success: false,
          error: 'Invalid URL entry provided in the list.',
        });
        overallSuccess = false;
        continue;
      }

      const jobId: string = await jobManager.createJob(url, useUserConfigPath);
      await jobManager.addOutput(jobId, 'info', `Starting download for: ${url}`);
      await jobManager.addOutput(jobId, 'info', `Job ID: ${jobId}`);

      const args: string[] = [url, '--config', './data/config.json'];

      try {
        const ptyProcess: IPty = spawn(PATHS.BIN_FILE, args, {
          name: TERMINAL.NAME,
          cols: TERMINAL.COLS,
          rows: TERMINAL.ROWS,
          cwd: process.cwd(),
          env: { ...process.env, NO_COLOR: '0', TERM: TERMINAL.NAME },
        });

        await jobManager.setJobProcess(jobId, ptyProcess);
        await jobManager.addOutput(jobId, 'info', `Process started with PID: ${ptyProcess.pid}`);

        ptyProcess.onData(async (data: string): Promise<void> => {
          // very verbose - need different solution
          // logger.info(`[Job ${jobId}] Output:`, JSON.stringify(data));
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
            logger.info(`[Job ${jobId}] Process exited with code ${exitCode}, signal ${signal}`);
            await jobManager.addOutput(
              jobId,
              'info',
              `Process exited with code ${exitCode}${signal ? ` (signal ${signal})` : ''}`
            );
            await jobManager.completeJob(jobId, exitCode || 0);
          }
        );

        batchResults.push({ jobId, url, success: true, message: 'Job started successfully' });
      } catch (spawnError) {
        const errorMessage: string =
          spawnError instanceof Error ? spawnError.message : 'Unknown spawn error';
        logger.error(`[Job ${jobId}] Failed to start process for ${url}:`, spawnError);
        await jobManager.addOutput(jobId, 'error', `Failed to start process: ${errorMessage}`);
        await jobManager.completeJob(jobId, 1); // Mark job as error
        batchResults.push({
          jobId,
          url,
          success: false,
          error: `Failed to start process: ${errorMessage}`,
        });
        overallSuccess = false;
      }
    }

    return json({
      overallSuccess,
      results: batchResults,
    });
  } catch (error) {
    const errorMessage: string = error instanceof Error ? error.message : 'Unknown server error';
    logger.error('Error in /api/command/start endpoint:', error);
    return json(
      {
        overallSuccess: false,
        results: [],
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
