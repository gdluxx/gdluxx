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
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import { jobManager } from '$lib/server/jobs/jobManager';
import { logger } from '$lib/shared/logger';
import { PATHS, TERMINAL } from '$lib/server/constants';
import type { BatchUrlResult } from '$lib/stores/jobs.svelte';
import optionsData from '$lib/assets/options.json';
import type { Option, OptionsData } from '$lib/types/options';

const getClientSafeMessage = (error: Error) => {
  if (dev) {
    return error.message;
  }

  if (error.name === 'ValidationError') {
    return 'Invalid input provided.';
  }
  if (error.name === 'NotFoundError') {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
};

const validOptions = new Map<string, Option>();
Object.values(optionsData as OptionsData).forEach(category => {
  category.options.forEach(option => {
    validOptions.set(option.id, option as Option);
  });
});

function validateOptionValue(option: Option, value: unknown): string | null {
  if (option.type === 'boolean') {
    return typeof value === 'boolean' ? String(value) : null;
  }

  if (option.type === 'number') {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) ? String(num) : null;
  }

  if (option.type === 'string' || option.type === 'range') {
    const str = String(value).trim();

    if (str.includes(';') || str.includes('|') || str.includes('&') || str.includes('`')) {
      return null;
    }
    return str.length > 0 ? str : null;
  }

  return null;
}

export const POST: RequestHandler = async ({ request }) => {
  const { spawn } = await import('@homebridge/node-pty-prebuilt-multiarch');

  try {
    const requestData = await request.json();
    const { urls, args } = requestData;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return json(
        {
          overallSuccess: false,
          results: [],
          error: 'URLs are required and cannot be empty',
        },
        { status: 400 }
      );
    }

    // Filter out empty URLs
    const validUrls = urls
      .map((url: unknown) => (typeof url === 'string' ? url.trim() : ''))
      .filter((url: string) => url !== '');

    if (validUrls.length === 0) {
      return json(
        {
          overallSuccess: false,
          results: [],
          error: 'At least one valid URL is required',
        },
        { status: 400 }
      );
    }

    // Parse args
    let receivedArgs: Array<[string, string | number | boolean]> = [];
    if (args && Array.isArray(args)) {
      receivedArgs = args;
    }

    // does gallery-dl binary exist
    try {
      fs.accessSync(PATHS.BIN_FILE, fs.constants.X_OK);
    } catch (_err) {
      logger.error('gallery-dl.bin not found or not executable');
      return json(
        {
          overallSuccess: false,
          results: validUrls.map((url: string) => ({
            url,
            success: false,
            error: 'gallery-dl.bin not found or not executable',
          })),
          error: 'gallery-dl.bin not found or not executable',
        },
        { status: 500 }
      );
    }

    const batchResults: BatchUrlResult[] = [];
    let overallSuccess = true;

    for (const url of validUrls) {
      if (typeof url !== 'string' || !url.trim()) {
        batchResults.push({
          url: url || 'INVALID_URL_ENTRY',
          success: false,
          error: 'Invalid URL entry provided in the list.',
        });
        overallSuccess = false;
        continue;
      }

      const jobId: string = await jobManager.createJob(url);
      await jobManager.addOutput(jobId, 'info', `Starting download for: ${url}`);
      await jobManager.addOutput(jobId, 'info', `Job ID: ${jobId}`);

      const processArgs: string[] = [url, '--config', './data/config.json'];

      // Process arguments
      for (const [optionId, value] of receivedArgs) {
        const option = validOptions.get(optionId);
        if (!option) {
          logger.warn(`Invalid option attempted: ${optionId}`);
          continue; // Skip invalid options
        }

        // Validate and sanitize the value
        const sanitizedValue = validateOptionValue(option, value);
        if (sanitizedValue === null) {
          logger.warn(`Invalid value for option ${optionId}: ${value}`);
          continue; // Skip invalid values
        }

        // add command flag
        processArgs.push(option.command);

        // Add value for non-boolean options
        if (option.type !== 'boolean') {
          processArgs.push(sanitizedValue);
        }
      }

      try {
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
    logger.error('Error in POST endpoint:', error);
    return json(
      {
        overallSuccess: false,
        results: [],
        error: getClientSafeMessage(error as Error),
      },
      { status: 500 }
    );
  }
};
