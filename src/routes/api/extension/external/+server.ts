/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/shared/logger';
import { type AuthResult, validateApiKey } from '$lib/server/auth/apiAuth';
import type { BatchJobStartResult } from '$lib/stores/jobs.svelte';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { externalApiSchema } from '$lib/server/validation/command-validation';
import { jobManager } from '$lib/server/jobs/jobManager';
import { PATHS, TERMINAL } from '$lib/server/constants';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';

interface ExternalApiRequestBody {
  urlToProcess: unknown;
}

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  let body: ExternalApiRequestBody;

  // Extract bearer token from auth header
  const authHeader: string | null = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return handleApiError(new Error('Authorization header with Bearer token is required'));
  }

  const plainApiKey = authHeader.substring(7);
  if (!plainApiKey || plainApiKey.trim() === '') {
    return handleApiError(new Error('Bearer token cannot be empty'));
  }

  try {
    try {
      body = await request.json();
    } catch (jsonParseError) {
      logger.warn(
        'Failed to parse request body as JSON for /api/extension/external:',
        jsonParseError
      );
      return handleApiError(new Error('Invalid request body. Expected valid JSON.'));
    }

    if (typeof body !== 'object' || body === null) {
      logger.warn('Request body is not a valid JSON object for /api/extension/external:', body);
      return handleApiError(new Error('Invalid request body. Expected a JSON object.'));
    }

    // Validate input
    try {
      validateInput(
        {
          urlToProcess: body.urlToProcess,
        },
        externalApiSchema
      );
    } catch (error) {
      return handleApiError(error as Error);
    }
  } catch (error) {
    logger.warn('Unexpected error processing external endpoint request:', error);
    return handleApiError(error as Error);
  }

  const urlToProcess = body.urlToProcess as string;

  const authResult: AuthResult = await validateApiKey(plainApiKey);

  if (!authResult.success) {
    logger.warn(`Invalid API key attempt via extension endpoint. Error: ${authResult.error}`);
    return handleApiError(new Error(authResult.error || 'Invalid API key.'));
  }

  logger.info(
    `API key validated for: ${authResult.keyInfo?.name} (ID: ${authResult.keyInfo?.id}). Forwarding URL: ${urlToProcess}`
  );

  try {
    const { spawn } = await import('@homebridge/node-pty-prebuilt-multiarch');

    // Create job
    const jobId: string = await jobManager.createJob(urlToProcess);
    await jobManager.addOutput(jobId, 'info', `Starting download for: ${urlToProcess}`);
    await jobManager.addOutput(jobId, 'info', `Job ID: ${jobId}`);

    const processArgs: string[] = [urlToProcess, '--config', './data/config.json'];

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

      const result: BatchJobStartResult = {
        overallSuccess: true,
        results: [
          {
            jobId,
            url: urlToProcess,
            success: true,
            message: 'Job started successfully',
          },
        ],
      };

      return createApiResponse(result);
    } catch (spawnError) {
      const errorMessage: string =
        spawnError instanceof Error ? spawnError.message : 'Unknown spawn error';
      logger.error(`[Job ${jobId}] Failed to start process for ${urlToProcess}:`, spawnError);
      await jobManager.addOutput(jobId, 'error', `Failed to start process: ${errorMessage}`);
      await jobManager.completeJob(jobId, 1);

      return handleApiError(new Error(`Failed to start process: ${errorMessage}`));
    }
  } catch (error) {
    logger.error('Error creating job:', error);
    return handleApiError(new Error('Failed to create job.'));
  }
};
