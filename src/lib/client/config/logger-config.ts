/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface ClientLogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  sendToServer: boolean;
  bufferSize: number;
  batchInterval: number; // milliseconds
  includeUserAgent: boolean;
  includeUrl: boolean;
}

export const DEFAULT_CLIENT_CONFIG: ClientLogConfig = {
  enabled: import.meta.env.DEV,
  level: import.meta.env.DEV ? 'debug' : 'info',
  sendToServer: false,
  bufferSize: 100,
  batchInterval: 10000, // 10 seconds
  includeUserAgent: false,
  includeUrl: true,
};
