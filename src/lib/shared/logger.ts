/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface LoggingConfig {
  enabled: boolean;
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

const DEFAULT_CONFIG: LoggingConfig = {
  enabled:
    typeof window !== 'undefined' ? import.meta.env.DEV : process.env.NODE_ENV === 'development',
  level: 'INFO',
};

const isServer: boolean = typeof window === 'undefined';

let currentConfig: LoggingConfig = { ...DEFAULT_CONFIG };

async function loadServerConfig(): Promise<void> {
  if (!isServer) {
    return;
  }

  try {
    // Load config from database via API call during initialization
    // Use defaults until user visits /settings/debug and let the API handle database sync
    currentConfig = { ...DEFAULT_CONFIG };

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(
        '[Logger Init] Using default config, will sync with database via API:',
        currentConfig
      );
    }
  } catch (error) {
    if (DEFAULT_CONFIG.enabled) {
      // eslint-disable-next-line no-console
      console.error('[Logger Init] Failed to initialize config, using defaults:', error);
    }
    currentConfig = { ...DEFAULT_CONFIG };
  }
}

function loadClientConfig(): void {
  if (isServer || typeof window === 'undefined') {
    return;
  }

  try {
    const stored = localStorage.getItem('logging-config');
    if (stored) {
      const parsedConfig = JSON.parse(stored) as LoggingConfig;
      currentConfig = { ...DEFAULT_CONFIG, ...parsedConfig };
    }
  } catch (error) {
    if (logger?.warn) {
      logger.warn('Failed to load client config from localStorage, using defaults:', error);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        '[Logger Init] Failed to load client config from localStorage, using defaults:',
        error
      );
    }
    currentConfig = { ...DEFAULT_CONFIG };
  }
}

if (isServer) {
  (async () => {
    await loadServerConfig();
  })();
} else {
  loadClientConfig();
}

function formatMessage(level: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const messageParts = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}${arg.stack ? `\nStack: ${arg.stack}` : ''}`;
    }
    if (typeof arg === 'object' || Array.isArray(arg)) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  });
  return `${timestamp} [${level.toUpperCase()}] ${messageParts.join(' ')}`;
}

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function shouldLog(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): boolean {
  if (!currentConfig.enabled) {
    return false;
  }

  const configuredLevelName: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' =
    currentConfig.level && currentConfig.level in LOG_LEVELS ? currentConfig.level : 'INFO';
  const configuredLevel = LOG_LEVELS[configuredLevelName];
  const messageLevel = LOG_LEVELS[level];
  return messageLevel >= configuredLevel;
}

const loggerAPI = {
  debug: (...args: unknown[]): void => {
    if (shouldLog('DEBUG')) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage('DEBUG', ...args));
    }
  },
  info: (...args: unknown[]): void => {
    if (shouldLog('INFO')) {
      // eslint-disable-next-line no-console
      console.log(formatMessage('INFO', ...args));
    }
  },
  warn: (...args: unknown[]): void => {
    if (shouldLog('WARN')) {
      // eslint-disable-next-line no-console
      console.warn(formatMessage('WARN', ...args));
    }
  },
  error: (...args: unknown[]): void => {
    if (shouldLog('ERROR')) {
      // eslint-disable-next-line no-console
      console.error(formatMessage('ERROR', ...args));
    }
  },
  getConfig: (): LoggingConfig => {
    if (process.env.NODE_ENV === 'development' && isServer) {
      loggerAPI.debug(`getConfig() called. Returning:`, currentConfig);
    }
    return { ...currentConfig };
  },
  setConfig: async (newConfig: Partial<LoggingConfig>): Promise<void> => {
    const oldConfig = { ...currentConfig };

    currentConfig = {
      enabled: newConfig.enabled !== undefined ? newConfig.enabled : oldConfig.enabled,
      level: newConfig.level !== undefined ? newConfig.level : oldConfig.level,
    };

    if (process.env.NODE_ENV === 'development') {
      loggerAPI.debug(
        `setConfig() called. Old config:`,
        oldConfig,
        `New effective config:`,
        currentConfig
      );
    }

    if (isServer) {
      // Update the in-memory config
      loggerAPI.info('Logger configuration updated in memory.', currentConfig);
    } else if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('logging-config', JSON.stringify(currentConfig));
        loggerAPI.info('Logger configuration updated and saved to localStorage.', currentConfig);
      } catch (error) {
        loggerAPI.warn('Failed to save client logging config to localStorage:', error);
      }
    }
  },

  reloadConfig: async (): Promise<void> => {
    loggerAPI.info('Reloading logger configuration...');
    if (isServer) {
      await loadServerConfig();
    } else {
      loadClientConfig();
    }
    loggerAPI.info('Logger configuration reloaded.', currentConfig);
  },

  willLog: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): boolean => {
    return shouldLog(level);
  },

  forceEnable: (level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): void => {
    currentConfig = { ...currentConfig, enabled: true };
    if (level) {
      currentConfig.level = level;
    }
    loggerAPI.info(`Logging force enabled. Level: ${currentConfig.level}`);
  },
  forceDisable: (): void => {
    currentConfig = { ...currentConfig, enabled: false };
    loggerAPI.info('Logging force disabled.');
  },
};

export const logger = loggerAPI;
