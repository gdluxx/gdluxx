/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface ServerLogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'simple';
  outputs: {
    console: boolean;
    file: {
      enabled: boolean;
      directory: string;
      maxSize: string;
      maxFiles: string;
    };
    database: boolean;
  };
  performance: {
    logSlowQueries: boolean;
    slowQueryThreshold: number; // milliseconds
  };
}

export const DEFAULT_SERVER_CONFIG: ServerLogConfig = {
  enabled: true,
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: process.env.NODE_ENV === 'development' ? 'simple' : 'json',
  outputs: {
    console: true,
    file: {
      enabled: process.env.NODE_ENV === 'production',
      directory: './logs',
      maxSize: '10m',
      maxFiles: '7d',
    },
    database: false, // Future use
  },
  performance: {
    logSlowQueries: true,
    slowQueryThreshold: 1000,
  },
};
