/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SERVER_LOGGING_UI_CONFIG,
  LOG_FORMATS,
  LOG_LEVELS,
  LOG_VALIDATION,
  serverLoggingConfigSchema,
  validateLogDirectory,
  validateLogMaxFiles,
  validateLogMaxSize,
  validateServerLoggingConfig,
  validateSlowQueryThreshold,
  type ServerLoggingConfig,
} from '../src/lib/logging';

function configWith(overrides: Partial<ServerLoggingConfig> = {}): ServerLoggingConfig {
  return { ...DEFAULT_SERVER_LOGGING_UI_CONFIG, ...overrides };
}

describe('log level and format enums', () => {
  test.each(LOG_LEVELS)('accepts level "%s"', (level) => {
    const result = serverLoggingConfigSchema.safeParse(configWith({ level }));
    expect(result.success).toBe(true);
  });

  test.each(LOG_FORMATS)('accepts format "%s"', (format) => {
    const result = serverLoggingConfigSchema.safeParse(configWith({ format }));
    expect(result.success).toBe(true);
  });

  test.each(['DEBUG', 'trace', 'verbose', 'fatal', ''])('rejects level "%s"', (level) => {
    const result = validateServerLoggingConfig(configWith({ level } as never));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.level).toBeDefined();
    }
  });

  test.each(['JSON', 'pretty', 'text', ''])('rejects format "%s"', (format) => {
    const result = validateServerLoggingConfig(configWith({ format } as never));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.format).toBeDefined();
    }
  });
});

describe('validateLogDirectory', () => {
  const accepted = [
    './logs',
    'logs',
    '/app/data/gdluxx_logs',
    '/var/log/gdluxx',
    '/srv/gdluxx logs',
    'a'.repeat(LOG_VALIDATION.DIRECTORY.MAX_LENGTH),
  ];

  test.each(accepted)('accepts %s', (directory) => {
    expect(validateLogDirectory(directory, true)).toBeNull();
  });

  test('requires a directory only when file output is enabled', () => {
    expect(validateLogDirectory('', true)).toBe(LOG_VALIDATION.DIRECTORY.REQUIRED_MESSAGE);
    expect(validateLogDirectory('   ', true)).toBe(LOG_VALIDATION.DIRECTORY.REQUIRED_MESSAGE);
    expect(validateLogDirectory('', false)).toBeNull();
    expect(validateLogDirectory('   ', false)).toBeNull();
  });

  test.each([
    ['../logs', LOG_VALIDATION.DIRECTORY.TRAVERSAL_MESSAGE],
    ['/app/../etc', LOG_VALIDATION.DIRECTORY.TRAVERSAL_MESSAGE],
    ['a'.repeat(256), LOG_VALIDATION.DIRECTORY.LENGTH_MESSAGE],
    ['/logs<1>', LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE],
    ['C:/logs', LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE],
    ['/logs|pipe', LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE],
    ['/logs?q', LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE],
    ['/logs*', LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE],
    ['/logs"quoted"', LOG_VALIDATION.DIRECTORY.CHARSET_MESSAGE],
  ])('rejects %s', (directory, message) => {
    expect(validateLogDirectory(directory, true)).toBe(message);
  });

  test('rejects a bad directory even when file output is disabled', () => {
    // Only emptiness is conditional so a traversal attempt is always wrong
    expect(validateLogDirectory('../logs', false)).toBe(LOG_VALIDATION.DIRECTORY.TRAVERSAL_MESSAGE);
  });

  test('the conditional requirement runs through the schema too', () => {
    const disabled = validateServerLoggingConfig(
      configWith({ fileEnabled: false, fileDirectory: '' }),
    );
    expect(disabled.valid).toBe(true);

    const enabled = validateServerLoggingConfig(
      configWith({ fileEnabled: true, fileDirectory: '' }),
    );
    expect(enabled.valid).toBe(false);
    if (!enabled.valid) {
      expect(enabled.fieldErrors.fileDirectory).toBe(LOG_VALIDATION.DIRECTORY.REQUIRED_MESSAGE);
    }
  });
});

describe('validateLogMaxSize', () => {
  test.each(['10m', '1g', '500k', '0.5m', '20K', '100M', '1G'])('accepts "%s"', (value) => {
    expect(validateLogMaxSize(value)).toBeNull();
  });

  test('accepts a blank value as "no size limit"', () => {
    expect(validateLogMaxSize('')).toBeNull();
    expect(validateLogMaxSize('   ')).toBeNull();
  });

  test.each(['10', '10mb', 'm10', '10 m', '10t', '.5m', 'ten m'])('rejects "%s"', (value) => {
    expect(validateLogMaxSize(value)).toBe(LOG_VALIDATION.MAX_SIZE.MESSAGE);
  });

  test('surrounding whitespace is tolerated and stripped', () => {
    expect(validateLogMaxSize('  10m  ')).toBeNull();

    const result = serverLoggingConfigSchema.safeParse(
      configWith({ fileMaxSize: ' 10m ', fileMaxFiles: ' 7d ', fileDirectory: ' ./logs ' }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileMaxSize).toBe('10m');
      expect(result.data.fileMaxFiles).toBe('7d');
      expect(result.data.fileDirectory).toBe('./logs');
    }
  });
});

describe('validateLogMaxFiles', () => {
  test.each(['7d', '14', '1', '30d', '0', '0d', '365d'])('accepts "%s"', (value) => {
    expect(validateLogMaxFiles(value)).toBeNull();
  });

  test('accepts a blank value as "keep every file"', () => {
    expect(validateLogMaxFiles('')).toBeNull();
    expect(validateLogMaxFiles('   ')).toBeNull();
  });

  test.each(['d7', 'seven', '7 days', '7days', '7D', '-7', '7.5', 'd'])('rejects "%s"', (value) => {
    expect(validateLogMaxFiles(value)).toBe(LOG_VALIDATION.MAX_FILES.MESSAGE);
  });
});

describe('validateSlowQueryThreshold', () => {
  test.each([0, 1, 1000, 600_000])('accepts %i', (value) => {
    expect(validateSlowQueryThreshold(value)).toBeNull();
  });

  test.each([-1, -1000, 600_001, 1_000_000])('rejects %i', (value) => {
    expect(validateSlowQueryThreshold(value)).toBe(
      LOG_VALIDATION.SLOW_QUERY_THRESHOLD.RANGE_MESSAGE,
    );
  });

  test('rejects non-integers', () => {
    expect(validateSlowQueryThreshold(1.5)).toBe(
      LOG_VALIDATION.SLOW_QUERY_THRESHOLD.INTEGER_MESSAGE,
    );
    expect(validateSlowQueryThreshold(Number.NaN)).toBe(
      LOG_VALIDATION.SLOW_QUERY_THRESHOLD.RANGE_MESSAGE,
    );
  });
});

describe('serverLoggingConfigSchema', () => {
  test('the UI defaults round-trip unchanged', () => {
    const result = serverLoggingConfigSchema.safeParse(DEFAULT_SERVER_LOGGING_UI_CONFIG);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(DEFAULT_SERVER_LOGGING_UI_CONFIG);
    }
  });

  test('rejects unknown keys', () => {
    const result = serverLoggingConfigSchema.safeParse({
      ...DEFAULT_SERVER_LOGGING_UI_CONFIG,
      rogueKey: 'value',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });

  test('rejects missing keys', () => {
    const partial: Record<string, unknown> = { ...DEFAULT_SERVER_LOGGING_UI_CONFIG };
    delete partial.slowQueryThreshold;
    const result = validateServerLoggingConfig(partial);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.slowQueryThreshold).toBeDefined();
    }
  });

  test.each([
    ['enabled', 'yes'],
    ['consoleEnabled', 1],
    ['fileEnabled', 'true'],
    ['fileDirectory', 42],
    ['fileMaxSize', 10],
    ['slowQueryThreshold', '1000'],
  ])('rejects a wrongly typed %s', (field, value) => {
    const result = validateServerLoggingConfig({
      ...DEFAULT_SERVER_LOGGING_UI_CONFIG,
      [field]: value,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors[field as keyof ServerLoggingConfig]).toBeDefined();
    }
  });

  test('an undefined slowQueryThreshold reports the friendly range message', () => {
    const result = validateServerLoggingConfig(
      configWith({ slowQueryThreshold: undefined as unknown as number }),
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.slowQueryThreshold).toBe(
        LOG_VALIDATION.SLOW_QUERY_THRESHOLD.RANGE_MESSAGE,
      );
    }
  });

  test('reports every offending field at once', () => {
    const result = validateServerLoggingConfig(
      configWith({
        fileEnabled: true,
        fileDirectory: '../escape',
        fileMaxSize: '10',
        fileMaxFiles: 'd7',
        slowQueryThreshold: -5,
      }),
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual([
        'fileDirectory',
        'fileMaxFiles',
        'fileMaxSize',
        'slowQueryThreshold',
      ]);
    }
  });

  test('non-object payloads do not throw', () => {
    for (const payload of [null, undefined, 'config', 42, []]) {
      expect(validateServerLoggingConfig(payload).valid).toBe(false);
    }
  });
});
