/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ClientLogConfig } from '$lib/client/config/logger-config';
import { DEFAULT_CLIENT_CONFIG } from '$lib/client/config/logger-config';
import { browser } from '$app/environment';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  args: unknown[];
  url?: string;
  userAgent?: string;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class ClientLogger {
  private config: ClientLogConfig;
  private buffer: LogEntry[] = [];
  private batchTimer: number | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.setupBatchTimer();
  }

  private loadConfig(): ClientLogConfig {
    if (!browser) {
      return { ...DEFAULT_CLIENT_CONFIG };
    }

    try {
      const stored = localStorage.getItem('client-logging-config');
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ClientLogConfig>;
        return { ...DEFAULT_CLIENT_CONFIG, ...parsed };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[ClientLogger] Failed to load config from localStorage:', error);
    }
    return { ...DEFAULT_CLIENT_CONFIG };
  }

  private saveConfig(): void {
    if (!browser) {
      return;
    }

    try {
      localStorage.setItem('client-logging-config', JSON.stringify(this.config));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[ClientLogger] Failed to save config to localStorage:', error);
    }
  }

  private shouldLog(level: keyof typeof LOG_LEVELS): boolean {
    if (!this.config.enabled) {
      return false;
    }
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private createLogEntry(level: string, message: string, args: unknown[]): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      args,
    };

    if (browser) {
      if (this.config.includeUrl) {
        entry.url = window.location.href;
      }

      if (this.config.includeUserAgent) {
        entry.userAgent = navigator.userAgent;
      }
    }

    return entry;
  }

  private addToBuffer(entry: LogEntry): void {
    if (!this.config.sendToServer) {
      return;
    }

    this.buffer.push(entry);
    if (this.buffer.length > this.config.bufferSize) {
      this.buffer = this.buffer.slice(-this.config.bufferSize);
    }
  }

  private setupBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    if (browser && this.config.sendToServer) {
      this.batchTimer = window.setInterval(() => {
        this.flushBuffer();
      }, this.config.batchInterval);
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch('/api/logging/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[ClientLogger] Failed to send logs to server:', error);
      // Re-add failed logs to buffer with size limit
      this.buffer = [...logsToSend.slice(-50), ...this.buffer].slice(-this.config.bufferSize);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) {
      return;
    }

    const entry = this.createLogEntry('DEBUG', message, args);
    // eslint-disable-next-line no-console
    console.debug(`[gdluxx] ${message}`, ...args);
    this.addToBuffer(entry);
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) {
      return;
    }

    const entry = this.createLogEntry('INFO', message, args);
    // eslint-disable-next-line no-console
    console.info(`[gdluxx] ${message}`, ...args);
    this.addToBuffer(entry);
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) {
      return;
    }

    const entry = this.createLogEntry('WARN', message, args);
    // eslint-disable-next-line no-console
    console.warn(`[gdluxx] ${message}`, ...args);
    this.addToBuffer(entry);
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('error')) {
      return;
    }

    const entry = this.createLogEntry('ERROR', message, args);
    // eslint-disable-next-line no-console
    console.error(`[gdluxx] ${message}`, ...args);
    this.addToBuffer(entry);
  }

  logUserAction(action: string, component: string, data?: unknown): void {
    this.info(`User action: ${action}`, { component, data });
  }

  logUIError(error: Error, component: string): void {
    this.error(`UI Error in ${component}: ${error.message}`, {
      component,
      stack: error.stack,
      url: browser ? window.location.href : undefined,
    });
  }

  logPerformance(metric: string, value: number, unit = 'ms'): void {
    this.debug(`Performance: ${metric}`, { value, unit });
  }

  updateConfig(newConfig: Partial<ClientLogConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.setupBatchTimer();
    this.info('Client logger configuration updated', { config: this.config });
  }

  getConfig(): ClientLogConfig {
    return { ...this.config };
  }

  async flush(): Promise<void> {
    await this.flushBuffer();
  }

  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushBuffer(); // Final flush
  }
}

export const clientLogger = new ClientLogger();

if (browser) {
  window.addEventListener('beforeunload', () => {
    clientLogger.destroy();
  });
}
