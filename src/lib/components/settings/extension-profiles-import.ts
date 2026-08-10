/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const REQUEST_TOO_LARGE_MESSAGE =
  'This profile file exceeds the server’s request-size limit. Split it into smaller files, or raise BODY_SIZE_LIMIT on the server.';

/**
 * Turns a failed import response into something a user can act on
 */
export function describeImportFailure(status: number, payload: { error?: unknown } | null): string {
  if (status === 413) {
    return REQUEST_TOO_LARGE_MESSAGE;
  }
  if (payload && typeof payload.error === 'string' && payload.error.length > 0) {
    return payload.error;
  }
  return `Server error: ${status}`;
}
