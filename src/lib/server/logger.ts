/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { ServerLoggingConfig } from './loggingManager';
import { DEFAULT_SERVER_LOGGING_CONFIG, readServerLoggingConfig } from './loggingManager';

// Patterns to redact
const REDACT_PATTERNS = [
  /password["\s]*[=:]["\s]*([^"'\s,}]+)/gi,
  /token["\s]*[=:]["\s]*([^"'\s,}]+)/gi,
  /key["\s]*[=:]["\s]*([^"'\s,}]+)/gi,
  /secret["\s]*[=:]["\s]*([^"'\s,}]+)/gi,
  /Bearer\s+([^\s]+)/gi,
  /Authorization:\s*([^\s,}]+)/gi,
];

function sanitizeMessage(message: string): string {
  let sanitized = message;
  REDACT_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match, group1) => {
      return match.replace(group1, '[REDACTED]');
    });
  });
  return sanitized;
}

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return sanitizeMessage(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        const str = JSON.stringify(arg);
        const sanitized = sanitizeMessage(str);
        return JSON.parse(sanitized);
      } catch {
        return arg;
      }
    }
    return arg;
  });
}

class ServerLogger {
  private winston: winston.Logger;
  private config: ServerLoggingConfig;

  constructor() {
    this.config = DEFAULT_SERVER_LOGGING_CONFIG;
    this.winston = this.createWinstonLogger();
    this.loadConfigAsync();
  }

  private async loadConfigAsync(): Promise<void> {
    try {
      this.config = await readServerLoggingConfig();
      this.winston = this.createWinstonLogger();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ServerLogger] Failed to load config from database:', error);
    }
  }

  private createWinstonLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.consoleEnabled) {
      transports.push(
        new winston.transports.Console({
          format:
            this.config.format === 'simple'
              ? winston.format.combine(
                  winston.format.colorize(),
                  winston.format.timestamp(),
                  winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} [${level}] ${message}${metaStr}`;
                  }),
                )
              : winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      );
    }

    // File transport
    if (this.config.fileEnabled) {
      transports.push(
        new DailyRotateFile({
          filename: `${this.config.fileDirectory}/gdluxx-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.fileMaxSize,
          maxFiles: this.config.fileMaxFiles,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      );
    }

    return winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false,
    });
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.config.enabled) {
      return;
    }
    const sanitized = sanitizeArgs([message, ...args]);
    this.winston.debug(sanitized[0] as string, ...sanitized.slice(1));
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.config.enabled) {
      return;
    }
    const sanitized = sanitizeArgs([message, ...args]);
    this.winston.info(sanitized[0] as string, ...sanitized.slice(1));
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.config.enabled) {
      return;
    }
    const sanitized = sanitizeArgs([message, ...args]);
    this.winston.warn(sanitized[0] as string, ...sanitized.slice(1));
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.config.enabled) {
      return;
    }
    const sanitized = sanitizeArgs([message, ...args]);
    this.winston.error(sanitized[0] as string, ...sanitized.slice(1));
  }

  // Performance log utilities
  logSlowOperation(operation: string, duration: number, threshold?: number): void {
    const actualThreshold = threshold || this.config.slowQueryThreshold;
    if (duration > actualThreshold) {
      this.warn(`Slow operation detected: ${operation} took ${duration}ms`);
    }
  }

  // Job specific logging
  logJobStart(jobId: string, urls: string[]): void {
    this.info(`Job started`, { jobId, urlCount: urls.length, urls: urls.slice(0, 3) });
  }

  logJobProgress(jobId: string, status: string, output?: string): void {
    this.debug(`Job progress`, { jobId, status, output: output?.slice(0, 200) });
  }

  logJobComplete(jobId: string, success: boolean, duration?: number): void {
    this.info(`Job completed`, { jobId, success, duration });
  }

  // Config management
  async updateConfig(newConfig: Partial<ServerLoggingConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.winston = this.createWinstonLogger();
    this.info('Server logger configuration updated', { config: this.config });
  }

  getConfig(): ServerLoggingConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const serverLogger = new ServerLogger();
