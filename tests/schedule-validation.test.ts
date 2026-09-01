/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

// schedules-validation.ts imports option-validation.ts, which imports the
// real serverLogger; that module's chain (loggingManager -> settingsManager
// -> database) reaches $app/environment, unavailable outside SvelteKit.
vi.mock('$lib/server/logger', () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  MAX_SCHEDULE_URLS,
  MAX_SCHEDULE_NAME_LENGTH,
  MAX_SCHEDULES_PER_USER,
  MIN_INTERVAL_MINUTES,
  recurrenceSchema,
  scheduleCreateSchema,
  scheduleUpdateSchema,
  schedulePreviewSchema,
  scheduleStatusSchema,
  scheduleRunRequestSchema,
  scheduleNotificationsDeleteSchema,
} from '../src/lib/server/validation/schedules-validation';
import { PROHIBITED_OPTION_IDS } from '../src/lib/server/validation/exec-policy';

const ORIGINAL_GALLERY_DL_MODE = process.env.GDLUXX_GDL_POLICY;

afterEach(() => {
  if (ORIGINAL_GALLERY_DL_MODE === undefined) {
    delete process.env.GDLUXX_GDL_POLICY;
  } else {
    process.env.GDLUXX_GDL_POLICY = ORIGINAL_GALLERY_DL_MODE;
  }
  vi.resetModules();
});

async function loadScheduleValidation(mode: 'restricted' | 'unrestricted') {
  process.env.GDLUXX_GDL_POLICY = mode;
  vi.resetModules();
  return import('../src/lib/server/validation/schedules-validation');
}

function baseCommandSource(urlCount = 1) {
  return {
    urls: Array.from({ length: urlCount }, (_, i) => `https://example.test/${i}`),
    userOptions: [] as Array<[string, string | number | boolean]>,
    excludedOptions: [] as string[],
  };
}

function baseCreatePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My schedule',
    timezone: 'UTC',
    recurrence: { kind: 'daily', time: '09:00' },
    startDate: '2026-01-01',
    misfirePolicy: 'skip',
    commandSource: baseCommandSource(),
    ...overrides,
  };
}

function commandSourceWithOption(optionId: string, optionValue: unknown = 'value') {
  return {
    urls: ['https://example.test/a'],
    userOptions: [[optionId, optionValue]],
    excludedOptions: [],
  };
}

describe('recurrenceSchema', () => {
  test('accepts every discriminated member', () => {
    expect(recurrenceSchema.safeParse({ kind: 'once', time: '09:00' }).success).toBe(true);
    expect(
      recurrenceSchema.safeParse({ kind: 'interval', time: '09:00', unit: 'minutes', every: 30 })
        .success,
    ).toBe(true);
    expect(recurrenceSchema.safeParse({ kind: 'daily', time: '09:00' }).success).toBe(true);
    expect(
      recurrenceSchema.safeParse({ kind: 'weekly', time: '09:00', weekdays: [1, 3, 5] }).success,
    ).toBe(true);
    expect(
      recurrenceSchema.safeParse({ kind: 'monthly', time: '09:00', dayOfMonth: 31 }).success,
    ).toBe(true);
  });

  test('rejects a malformed time', () => {
    expect(recurrenceSchema.safeParse({ kind: 'daily', time: '9:00' }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ kind: 'daily', time: '24:00' }).success).toBe(false);
  });

  test('rejects an unknown kind', () => {
    expect(recurrenceSchema.safeParse({ kind: 'yearly', time: '09:00' }).success).toBe(false);
  });

  test('dedupes weekly weekdays via transform', () => {
    const result = recurrenceSchema.safeParse({
      kind: 'weekly',
      time: '09:00',
      weekdays: [1, 1, 3, 3, 5],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === 'weekly') {
      expect(result.data.weekdays).toEqual([1, 3, 5]);
    }
  });

  test('rejects an empty weekdays array', () => {
    expect(
      recurrenceSchema.safeParse({ kind: 'weekly', time: '09:00', weekdays: [] }).success,
    ).toBe(false);
  });

  test('rejects a weekday out of ISO 1-7 range', () => {
    expect(
      recurrenceSchema.safeParse({ kind: 'weekly', time: '09:00', weekdays: [0] }).success,
    ).toBe(false);
    expect(
      recurrenceSchema.safeParse({ kind: 'weekly', time: '09:00', weekdays: [8] }).success,
    ).toBe(false);
  });

  test('rejects dayOfMonth out of 1-31 range', () => {
    expect(
      recurrenceSchema.safeParse({ kind: 'monthly', time: '09:00', dayOfMonth: 0 }).success,
    ).toBe(false);
    expect(
      recurrenceSchema.safeParse({ kind: 'monthly', time: '09:00', dayOfMonth: 32 }).success,
    ).toBe(false);
  });

  test(`rejects a sub-${MIN_INTERVAL_MINUTES}-minute interval`, () => {
    const result = recurrenceSchema.safeParse({
      kind: 'interval',
      time: '09:00',
      unit: 'minutes',
      every: MIN_INTERVAL_MINUTES - 1,
    });
    expect(result.success).toBe(false);
  });

  test(`accepts an interval totaling exactly ${MIN_INTERVAL_MINUTES} minutes`, () => {
    const result = recurrenceSchema.safeParse({
      kind: 'interval',
      time: '09:00',
      unit: 'minutes',
      every: MIN_INTERVAL_MINUTES,
    });
    expect(result.success).toBe(true);
  });

  test('an hours-unit interval always clears the minute floor', () => {
    const result = recurrenceSchema.safeParse({
      kind: 'interval',
      time: '09:00',
      unit: 'hours',
      every: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe('scheduleCreateSchema', () => {
  test('accepts a minimal valid payload', () => {
    const result = scheduleCreateSchema.safeParse(baseCreatePayload());
    expect(result.success).toBe(true);
  });

  test('rejects an invalid IANA timezone', () => {
    const result = scheduleCreateSchema.safeParse(baseCreatePayload({ timezone: 'Not/A_Zone' }));
    expect(result.success).toBe(false);
  });

  test('rejects a malformed recurrence', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ recurrence: { kind: 'daily' } }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects an overlong name', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ name: 'x'.repeat(MAX_SCHEDULE_NAME_LENGTH + 1) }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects an empty URL list', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ commandSource: baseCommandSource(0) }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects a URL list over MAX_SCHEDULE_URLS', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ commandSource: baseCommandSource(MAX_SCHEDULE_URLS + 1) }),
    );
    expect(result.success).toBe(false);
  });

  test('accepts a URL list at exactly MAX_SCHEDULE_URLS', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ commandSource: baseCommandSource(MAX_SCHEDULE_URLS) }),
    );
    expect(result.success).toBe(true);
  });

  test('rejects a non-http(s) URL', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['ftp://example.test/a'],
          userOptions: [],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects endDate for kind "once"', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        recurrence: { kind: 'once', time: '09:00' },
        endDate: '2026-02-01',
      }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects endDate before startDate', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ startDate: '2026-02-01', endDate: '2026-01-01' }),
    );
    expect(result.success).toBe(false);
  });

  test('accepts endDate equal to startDate', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({ startDate: '2026-02-01', endDate: '2026-02-01' }),
    );
    expect(result.success).toBe(true);
  });

  test('rejects a {keep:true} sensitive sentinel on create', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['password', { keep: true }]],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects a boolean-typed option ("no-skip") given a value of false', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['no-skip', false]],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  test('rejects a boolean-typed option ("no-skip") given a non-boolean value', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['no-skip', 'yes']],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  test('accepts a boolean-typed option ("no-skip") given a value of true', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['no-skip', true]],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  test('rejects a known string-typed option ("filename") given a number value', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['filename', 123]],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  test('accepts a known string-typed option ("filename") given a valid string value', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['filename', '%Y-%m-%d']],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  test('accepts an unknown option id regardless of value (catalog forward/backward compatibility)', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['definitely-not-real', 'x']],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  test('rejects a range-typed option ("range") given a numeric value', () => {
    const result = scheduleCreateSchema.safeParse(
      baseCreatePayload({
        commandSource: {
          urls: ['https://example.test/a'],
          userOptions: [['range', 5]],
          excludedOptions: [],
        },
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe('scheduleUpdateSchema', () => {
  test('accepts an empty object (no-op update)', () => {
    expect(scheduleUpdateSchema.safeParse({}).success).toBe(true);
  });

  test('endDate: null clears it', () => {
    const result = scheduleUpdateSchema.safeParse({ endDate: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endDate).toBeNull();
    }
  });

  test('endDate: a valid date string still parses', () => {
    const result = scheduleUpdateSchema.safeParse({ endDate: '2026-03-01' });
    expect(result.success).toBe(true);
  });

  test('accepts a {keep:true} sentinel for a sensitive option id (password)', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['password', { keep: true }]],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('accepts a {keep:true} sentinel for the other sensitive option id (cookies)', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['cookies', { keep: true }]],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('rejects a {keep:true} sentinel for a non-sensitive option id', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['filename', { keep: true }]],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(false);
  });

  test('replace and remove pass through normally alongside a valid keep sentinel', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [
          ['password', { keep: true }],
          ['filename', 'new-value'],
        ],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('rejects a URL list over MAX_SCHEDULE_URLS on the update commandSource', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: baseCommandSource(MAX_SCHEDULE_URLS + 1),
    });
    expect(result.success).toBe(false);
  });

  test('accepts a partial update touching only the name', () => {
    const result = scheduleUpdateSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });

  test('rejects a boolean-typed option ("no-skip") given a value of false', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['no-skip', false]],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(false);
  });

  test('rejects a boolean-typed option ("no-skip") given a non-boolean value', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['no-skip', 'yes']],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(false);
  });

  test('accepts a boolean-typed option ("no-skip") given a value of true', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['no-skip', true]],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('rejects a known string-typed option ("filename") given a number value', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['filename', 123]],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(false);
  });

  test('accepts a known string-typed option ("filename") given a valid string value', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['filename', '%Y-%m-%d']],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('accepts an unknown option id regardless of value (catalog forward/backward compatibility)', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [['definitely-not-real', 'x']],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('a {keep:true} sentinel remains valid alongside a userOptions entry that satisfies the new value check', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [
          ['password', { keep: true }],
          ['no-skip', true],
        ],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test('a {keep:true} sentinel does not exempt a sibling userOptions entry from the new value check', () => {
    const result = scheduleUpdateSchema.safeParse({
      commandSource: {
        urls: ['https://example.test/a'],
        userOptions: [
          ['password', { keep: true }],
          ['no-skip', false],
        ],
        excludedOptions: [],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('schedulePreviewSchema', () => {
  test('accepts its minimal shape', () => {
    const result = schedulePreviewSchema.safeParse({
      recurrence: { kind: 'daily', time: '09:00' },
      timezone: 'UTC',
      startDate: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  test('accepts an optional endDate', () => {
    const result = schedulePreviewSchema.safeParse({
      recurrence: { kind: 'daily', time: '09:00' },
      timezone: 'UTC',
      startDate: '2026-01-01',
      endDate: '2026-02-01',
    });
    expect(result.success).toBe(true);
  });

  test('rejects a missing timezone', () => {
    const result = schedulePreviewSchema.safeParse({
      recurrence: { kind: 'daily', time: '09:00' },
      startDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('scheduleStatusSchema', () => {
  test('accepts active and paused', () => {
    expect(scheduleStatusSchema.safeParse({ status: 'active' }).success).toBe(true);
    expect(scheduleStatusSchema.safeParse({ status: 'paused' }).success).toBe(true);
  });

  test('rejects "completed" (not a settable status)', () => {
    expect(scheduleStatusSchema.safeParse({ status: 'completed' }).success).toBe(false);
  });
});

describe('scheduleRunRequestSchema', () => {
  test('accepts an empty body', () => {
    expect(scheduleRunRequestSchema.safeParse({}).success).toBe(true);
  });

  test('accepts a notificationId', () => {
    expect(scheduleRunRequestSchema.safeParse({ notificationId: 'notif-1' }).success).toBe(true);
  });
});

describe('scheduleNotificationsDeleteSchema (exactly-one-of, mirrors jobsDeleteSchema)', () => {
  test('accepts { ids }', () => {
    expect(scheduleNotificationsDeleteSchema.safeParse({ ids: ['a'] }).success).toBe(true);
  });

  test('accepts { acknowledged: true }', () => {
    expect(scheduleNotificationsDeleteSchema.safeParse({ acknowledged: true }).success).toBe(true);
  });

  test('rejects both provided at once', () => {
    expect(
      scheduleNotificationsDeleteSchema.safeParse({ ids: ['a'], acknowledged: true }).success,
    ).toBe(false);
  });

  test('rejects neither provided', () => {
    expect(scheduleNotificationsDeleteSchema.safeParse({}).success).toBe(false);
  });
});

describe('per-user schedule cap constant is exported for the route to enforce', () => {
  test('MAX_SCHEDULES_PER_USER is a positive integer', () => {
    expect(Number.isInteger(MAX_SCHEDULES_PER_USER)).toBe(true);
    expect(MAX_SCHEDULES_PER_USER).toBeGreaterThan(0);
  });
});

describe('schedule prohibited-option deployment mode', () => {
  test.each([
    ['restricted', false],
    ['unrestricted', true],
  ] as const)('%s mode applies prohibited ids to create and update', async (mode, accepted) => {
    const schemas = await loadScheduleValidation(mode);

    for (const optionId of PROHIBITED_OPTION_IDS) {
      const commandSource = commandSourceWithOption(optionId);
      const createResult = schemas.scheduleCreateSchema.safeParse(
        baseCreatePayload({ commandSource }),
      );
      const updateResult = schemas.scheduleUpdateSchema.safeParse({ commandSource });

      expect(createResult.success).toBe(accepted);
      expect(updateResult.success).toBe(accepted);
    }
  });

  test.each(['restricted', 'unrestricted'] as const)(
    '%s preserves unrelated create and update validation',
    async (mode) => {
      const schemas = await loadScheduleValidation(mode);

      expect(
        schemas.scheduleCreateSchema.safeParse(
          baseCreatePayload({
            recurrence: { kind: 'daily' },
            commandSource: commandSourceWithOption('no-skip', false),
          }),
        ).success,
      ).toBe(false);
      expect(
        schemas.scheduleCreateSchema.safeParse(
          baseCreatePayload({
            commandSource: {
              urls: ['ftp://example.test/a'],
              userOptions: [['password', { keep: true }]],
              excludedOptions: [],
            },
          }),
        ).success,
      ).toBe(false);
      expect(
        schemas.scheduleUpdateSchema.safeParse({
          commandSource: commandSourceWithOption('filename', { keep: true }),
        }).success,
      ).toBe(false);
    },
  );
});
