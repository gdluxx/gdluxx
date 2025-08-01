/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { type Job, jobManager } from '$lib/server/jobs/jobManager';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/shared/logger';

export const GET: RequestHandler = async ({ params, request }: RequestEvent): Promise<Response> => {
  const { jobId } = params;

  if (!jobId) {
    return new Response('Job ID is required', { status: 400 });
  }

  const job: Job | undefined = await jobManager.getJob(jobId);
  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController): Promise<void> {
      await jobManager.addSubscriber(jobId, controller);

      request.signal.addEventListener('abort', () => {
        jobManager.removeSubscriber(jobId, controller);
        try {
          if (controller.desiredSize === null || controller.desiredSize <= 0) {
            controller.close();
          }
        } catch (error) {
          logger.warn('Error closing controller on client disconnect:', error);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
