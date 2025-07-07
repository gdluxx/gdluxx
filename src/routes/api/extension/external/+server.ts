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
import { type AuthResult, validateApiKey } from '$lib/server/apiAuth';
import type { BatchJobStartResult } from '$lib/stores/jobs.svelte';
import { createApiResponse, handleApiError } from '$lib/server/api-utils';
import { validateInput } from '$lib/server/validation-utils';
import { externalApiSchema } from '$lib/server/command-validation';

interface ExternalApiRequestBody {
  urlToProcess: unknown;
  apiKey?: unknown;
}

export const POST: RequestHandler = async ({
  request,
  fetch: serverFetch,
}: RequestEvent): Promise<Response> => {
  let plainApiKey: string | null = null;
  let urlToProcess: string;
  let body: ExternalApiRequestBody;

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

    // Try Authorization header first
    const authHeader: string | null = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      plainApiKey = authHeader.substring(7);
    }

    // Or X-API-Key header
    if (!plainApiKey) {
      plainApiKey = request.headers.get('x-api-key');
    }

    // Or JSON body
    if (!plainApiKey && typeof body.apiKey === 'string') {
      plainApiKey = body.apiKey;
    }

    // Validate input
    try {
      validateInput({ 
        apiKey: plainApiKey,
        urlToProcess: body.urlToProcess 
      }, externalApiSchema);
    } catch (error) {
      return handleApiError(error as Error);
    }
    
    urlToProcess = body.urlToProcess as string;
  } catch (error) {
    logger.warn('Unexpected error processing external endpoint request:', error);
    return handleApiError(error as Error);
  }

  const authResult: AuthResult = await validateApiKey(plainApiKey);

  if (!authResult.success) {
    logger.warn(
      `Invalid API key attempt via extension endpoint: ${(plainApiKey as string).substring(0, Math.min(5, (plainApiKey as string).length))}... Error: ${authResult.error}`
    );
    return handleApiError(new Error(authResult.error || 'Invalid API key.'));
  }

  logger.info(
    `API key validated for: ${authResult.keyInfo?.name} (ID: ${authResult.keyInfo?.id}). Forwarding URL: ${urlToProcess}`
  );

  try {
    const commandStartResponse: Response = await serverFetch('/api/command/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [urlToProcess],
        useUserConfigPath: false,
      }),
    });

    let commandStartResult: BatchJobStartResult | { error: string };
    try {
      commandStartResult = await commandStartResponse.json();
    } catch (parseError) {
      const responseText: string = await commandStartResponse.text();
      logger.error(
        'Failed to parse JSON response from start endpoint:',
        parseError,
        'Status:',
        commandStartResponse.status,
        'Response Text:',
        responseText
      );
      return handleApiError(new Error('Internal error: Could not process response from command service.'));
    }

    return createApiResponse(commandStartResult);
  } catch (error) {
    logger.error('Error forwarding request to start endpoint:', error);
    return handleApiError(new Error('Failed to process the URL via the command service.'));
  }
};
