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
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { serverLogger as logger } from '$lib/server/logger';
import { PATHS } from '$lib/server/constants';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation/validation-utils';
import { keywordInfoSchema } from '$lib/server/validation/keyword-validation';

const execAsync = promisify(exec);

interface KeywordInfoRequestBody {
  url: unknown;
  command: unknown;
}

interface KeywordInfoResponse {
  output: string;
}

export const POST: RequestHandler = async ({ request }: RequestEvent): Promise<Response> => {
  let body: KeywordInfoRequestBody;

  try {
    try {
      body = await request.json();
    } catch (jsonParseError) {
      logger.warn('Failed to parse request body as JSON for /api/keyword-info:', jsonParseError);
      return handleApiError(new Error('Invalid request body. Expected valid JSON.'));
    }

    if (typeof body !== 'object' || body === null) {
      logger.warn('Request body is not a valid JSON object for /api/keyword-info:', body);
      return handleApiError(new Error('Invalid request body. Expected a JSON object.'));
    }

    try {
      validateInput(
        {
          url: body.url,
          command: body.command,
        },
        keywordInfoSchema,
      );
    } catch (error) {
      return handleApiError(error as Error);
    }
  } catch (error) {
    logger.warn('Unexpected error processing keyword-info request:', error);
    return handleApiError(error as Error);
  }

  const url = body.url as string;
  const command = body.command as string;

  const galleryDlFlag = command === 'list-keywords' ? '--list-keywords' : '--extractor-info';
  const commandArgs = [galleryDlFlag, url];
  const fullCommand = `"${PATHS.BIN_FILE}" ${commandArgs.join(' ')}`;

  logger.info(`Executing keyword info command: ${fullCommand}`);

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    });

    const output = stdout.trim() || stderr.trim();

    if (!output) {
      logger.warn(`Empty output from gallery-dl command: ${fullCommand}`);
      return handleApiError(new Error('No output received from gallery-dl command.'));
    }

    logger.info(`Keyword info command completed successfully for URL: ${url}, command: ${command}`);

    const response: KeywordInfoResponse = {
      output,
    };

    return createApiResponse(response);
  } catch (error) {
    logger.error(`Failed to execute gallery-dl command: ${fullCommand}`, error);

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        return handleApiError(new Error('Gallery-dl binary not found. Please download it first.'));
      }
      if (error.message.includes('timeout')) {
        return handleApiError(new Error('Command timed out. Please try again.'));
      }
      if (error.message.includes('No module named')) {
        return handleApiError(new Error('Unsupported URL or extractor not available.'));
      }
    }

    return handleApiError(
      new Error('Failed to execute gallery-dl command. Please check the URL and try again.'),
    );
  }
};
