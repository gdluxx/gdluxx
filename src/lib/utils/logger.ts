/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ILogger } from '$lib/shared/logger-interface';

// Environment detection
const isServer = typeof window === 'undefined';

// Dynamic import to avoid bundling server code in client
let logger: ILogger;

if (isServer) {
  // Server side
  const { serverLogger } = await import('$lib/server/logger');
  logger = serverLogger;
} else {
  // Client side
  const { clientLogger } = await import('$lib/client/logger');
  logger = clientLogger;
}

export { logger };
