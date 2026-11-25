/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { serverLogger as logger } from '$lib/server/logger';
import { createApiError } from '$lib/server/api-utils';
import { ConfigExecutionBlockedError } from '$lib/server/validation/exec-policy';
import { assertBinaryAvailable, BinaryUnavailableError } from './commandLauncher';
import { assertConfigFileSafeForExecution } from './configGuard';

/**
 * Checks what would fail every retry, so retry routes can refuse up front
 * instead of queueing jobs that fail at start. Returns null when retrying can proceed.
 */
export async function retryPreconditionError(): Promise<Response | null> {
  try {
    assertBinaryAvailable();
    await assertConfigFileSafeForExecution();
    return null;
  } catch (error) {
    if (error instanceof BinaryUnavailableError) {
      logger.error('gallery-dl.bin not found or not executable');
      return createApiError('gallery-dl.bin not found or not executable', 500);
    }
    if (error instanceof ConfigExecutionBlockedError) {
      logger.error('Blocked job retry on stored config:', error.violations);
      return createApiError(error.clientMessage, 409);
    }
    throw error;
  }
}
