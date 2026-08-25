import Database from 'better-sqlite3';
import { afterEach, describe, expect, test } from 'vitest';
import { normalizeBooleanOptionValues } from '../src/lib/server/optionValueMigration';
import { SENSITIVE_MASK } from '$lib/utils/commandOptions';

let db: Database.Database | null = null;

function openTestDatabase(): Database.Database {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    INSERT INTO user (id, email, createdAt, updatedAt)
    VALUES ('user-1', 'admin@example.test', 1000, 1000);

    CREATE TABLE site_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_pattern TEXT NOT NULL,
      display_name TEXT NOT NULL,
      cli_options TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(site_pattern)
    );

    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
      timezone TEXT NOT NULL,
      recurrence TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      misfirePolicy TEXT NOT NULL CHECK (misfirePolicy IN ('skip', 'catch_up')),
      commandSource TEXT NOT NULL,
      siteOptionsSnapshot TEXT NOT NULL,
      nextOccurrenceAt INTEGER,
      lastOccurrenceAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      CHECK (status = 'active' OR nextOccurrenceAt IS NULL)
    );
  `);
  return db;
}

const DIRTY_CLI_OPTIONS = JSON.stringify([
  ['no-skip', false],
  ['verbose', true],
  ['username', 'someuser'],
  ['not-in-catalog', false],
]);

// Non-canonical spacing: JSON.stringify would never emit this, so byte
// equality after migration proves the row wasn't blindly re-serialized.
const CLEAN_CLI_OPTIONS =
  '[\n  ["no-skip", true],\n  ["verbose", true],\n  ["username", "someuser"]\n]';

function seedSiteConfigs(database: Database.Database): void {
  database
    .prepare(
      `INSERT INTO site_configs
        (id, site_pattern, display_name, cli_options, is_default, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(1, 'dirty.example.com', 'Dirty Site', DIRTY_CLI_OPTIONS, 0, 1, 1000, 1000);

  database
    .prepare(
      `INSERT INTO site_configs
        (id, site_pattern, display_name, cli_options, is_default, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(2, 'clean.example.com', 'Clean Site', CLEAN_CLI_OPTIONS, 0, 1, 1000, 1000);
}

const DIRTY_COMMAND_SOURCE = JSON.stringify({
  urls: ['https://dirty.example.com/a'],
  userOptions: [
    ['no-skip', false],
    ['verbose', true],
  ],
  excludedOptions: [],
});

const DIRTY_SITE_OPTIONS_SNAPSHOT = JSON.stringify({
  'https://dirty.example.com/a': [
    ['no-skip', false],
    ['username', 'someuser'],
  ],
});

function seedSchedule(database: Database.Database): void {
  database
    .prepare(
      `INSERT INTO schedules
        (id, userId, name, status, timezone, recurrence, startDate, endDate, misfirePolicy,
         commandSource, siteOptionsSnapshot, nextOccurrenceAt, lastOccurrenceAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      'schedule-1',
      'user-1',
      'Test Schedule',
      'paused',
      'UTC',
      JSON.stringify({ kind: 'once', time: '00:00' }),
      '2026-01-01',
      null,
      'skip',
      DIRTY_COMMAND_SOURCE,
      DIRTY_SITE_OPTIONS_SNAPSHOT,
      null,
      null,
      1000,
      1000,
    );
}

afterEach(() => {
  db?.close();
  db = null;
});

describe('boolean option value migration', () => {
  test('flips stored false to true for boolean options in site_configs', () => {
    const database = openTestDatabase();
    seedSiteConfigs(database);
    seedSchedule(database);

    normalizeBooleanOptionValues(database);

    const dirtyRow = database
      .prepare('SELECT cli_options FROM site_configs WHERE id = ?')
      .get(1) as { cli_options: string };
    const tuples = JSON.parse(dirtyRow.cli_options) as Array<[string, unknown]>;

    expect(tuples).toEqual([
      ['no-skip', true],
      ['verbose', true],
      ['username', 'someuser'],
      ['not-in-catalog', false],
    ]);
  });

  test('leaves a fully-clean site_configs row byte-identical', () => {
    const database = openTestDatabase();
    seedSiteConfigs(database);
    seedSchedule(database);

    normalizeBooleanOptionValues(database);

    const cleanRow = database
      .prepare('SELECT cli_options FROM site_configs WHERE id = ?')
      .get(2) as { cli_options: string };

    expect(cleanRow.cli_options).toBe(CLEAN_CLI_OPTIONS);
  });

  test('flips boolean false tuples in schedules.commandSource.userOptions', () => {
    const database = openTestDatabase();
    seedSiteConfigs(database);
    seedSchedule(database);

    normalizeBooleanOptionValues(database);

    const row = database
      .prepare('SELECT commandSource FROM schedules WHERE id = ?')
      .get('schedule-1') as { commandSource: string };
    const commandSource = JSON.parse(row.commandSource) as {
      userOptions: Array<[string, unknown]>;
    };

    expect(commandSource.userOptions).toEqual([
      ['no-skip', true],
      ['verbose', true],
    ]);
  });

  test('flips boolean false tuples in schedules.siteOptionsSnapshot', () => {
    const database = openTestDatabase();
    seedSiteConfigs(database);
    seedSchedule(database);

    normalizeBooleanOptionValues(database);

    const row = database
      .prepare('SELECT siteOptionsSnapshot FROM schedules WHERE id = ?')
      .get('schedule-1') as { siteOptionsSnapshot: string };
    const snapshot = JSON.parse(row.siteOptionsSnapshot) as Record<
      string,
      Array<[string, unknown]>
    >;

    expect(snapshot['https://dirty.example.com/a']).toEqual([
      ['no-skip', true],
      ['username', 'someuser'],
    ]);
  });

  test('is idempotent: a second run is a no-op', () => {
    const database = openTestDatabase();
    seedSiteConfigs(database);
    seedSchedule(database);

    normalizeBooleanOptionValues(database);

    function snapshotState(): {
      dirty: string;
      clean: string;
      schedule: unknown;
    } {
      return {
        dirty: (
          database.prepare('SELECT cli_options FROM site_configs WHERE id = ?').get(1) as {
            cli_options: string;
          }
        ).cli_options,
        clean: (
          database.prepare('SELECT cli_options FROM site_configs WHERE id = ?').get(2) as {
            cli_options: string;
          }
        ).cli_options,
        schedule: database
          .prepare('SELECT commandSource, siteOptionsSnapshot FROM schedules WHERE id = ?')
          .get('schedule-1'),
      };
    }

    const afterFirst = snapshotState();
    // Pins that the clean row was skipped, not re-serialized, on the first run.
    expect(afterFirst.clean).toBe(CLEAN_CLI_OPTIONS);

    normalizeBooleanOptionValues(database);

    const afterSecond = snapshotState();

    expect(afterSecond.dirty).toBe(afterFirst.dirty);
    expect(afterSecond.clean).toBe(CLEAN_CLI_OPTIONS);
    expect(afterSecond.schedule).toEqual(afterFirst.schedule);
  });

  test('skips malformed rows without throwing, and still normalizes the rest', () => {
    const database = openTestDatabase();

    const MALFORMED_CLI_OPTIONS = '';
    const MALFORMED_COMMAND_SOURCE = JSON.stringify({
      urls: ['https://malformed.example.com/a'],
      excludedOptions: [],
      // userOptions intentionally omitted
    });
    const VALID_COMMAND_SOURCE_FOR_SNAPSHOT_ROW = JSON.stringify({
      urls: ['https://malformed.example.com/b'],
      userOptions: [],
      excludedOptions: [],
    });
    const MALFORMED_SITE_OPTIONS_SNAPSHOT = JSON.stringify({ 'https://a.test': null });
    const VALID_SITE_OPTIONS_SNAPSHOT_FOR_COMMAND_SOURCE_ROW = '{}';

    database
      .prepare(
        `INSERT INTO site_configs
          (id, site_pattern, display_name, cli_options, is_default, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, 'dirty.example.com', 'Dirty Site', DIRTY_CLI_OPTIONS, 0, 1, 1000, 1000);
    database
      .prepare(
        `INSERT INTO site_configs
          (id, site_pattern, display_name, cli_options, is_default, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(2, 'malformed.example.com', 'Malformed Site', MALFORMED_CLI_OPTIONS, 0, 1, 1000, 1000);

    const insertSchedule = database.prepare(
      `INSERT INTO schedules
        (id, userId, name, status, timezone, recurrence, startDate, endDate, misfirePolicy,
         commandSource, siteOptionsSnapshot, nextOccurrenceAt, lastOccurrenceAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertSchedule.run(
      'schedule-normal',
      'user-1',
      'Normal Schedule',
      'paused',
      'UTC',
      JSON.stringify({ kind: 'once', time: '00:00' }),
      '2026-01-01',
      null,
      'skip',
      DIRTY_COMMAND_SOURCE,
      DIRTY_SITE_OPTIONS_SNAPSHOT,
      null,
      null,
      1000,
      1000,
    );
    insertSchedule.run(
      'schedule-malformed-command-source',
      'user-1',
      'Malformed CommandSource Schedule',
      'paused',
      'UTC',
      JSON.stringify({ kind: 'once', time: '00:00' }),
      '2026-01-01',
      null,
      'skip',
      MALFORMED_COMMAND_SOURCE,
      VALID_SITE_OPTIONS_SNAPSHOT_FOR_COMMAND_SOURCE_ROW,
      null,
      null,
      1000,
      1000,
    );
    insertSchedule.run(
      'schedule-malformed-snapshot',
      'user-1',
      'Malformed Snapshot Schedule',
      'paused',
      'UTC',
      JSON.stringify({ kind: 'once', time: '00:00' }),
      '2026-01-01',
      null,
      'skip',
      VALID_COMMAND_SOURCE_FOR_SNAPSHOT_ROW,
      MALFORMED_SITE_OPTIONS_SNAPSHOT,
      null,
      null,
      1000,
      1000,
    );

    expect(() => normalizeBooleanOptionValues(database)).not.toThrow();

    const malformedSiteConfigRow = database
      .prepare('SELECT cli_options FROM site_configs WHERE id = ?')
      .get(2) as { cli_options: string };
    expect(malformedSiteConfigRow.cli_options).toBe(MALFORMED_CLI_OPTIONS);

    const malformedCommandSourceRow = database
      .prepare('SELECT commandSource, siteOptionsSnapshot FROM schedules WHERE id = ?')
      .get('schedule-malformed-command-source') as {
      commandSource: string;
      siteOptionsSnapshot: string;
    };
    expect(malformedCommandSourceRow.commandSource).toBe(MALFORMED_COMMAND_SOURCE);
    expect(malformedCommandSourceRow.siteOptionsSnapshot).toBe(
      VALID_SITE_OPTIONS_SNAPSHOT_FOR_COMMAND_SOURCE_ROW,
    );

    const malformedSnapshotRow = database
      .prepare('SELECT commandSource, siteOptionsSnapshot FROM schedules WHERE id = ?')
      .get('schedule-malformed-snapshot') as {
      commandSource: string;
      siteOptionsSnapshot: string;
    };
    expect(malformedSnapshotRow.commandSource).toBe(VALID_COMMAND_SOURCE_FOR_SNAPSHOT_ROW);
    expect(malformedSnapshotRow.siteOptionsSnapshot).toBe(MALFORMED_SITE_OPTIONS_SNAPSHOT);

    const dirtySiteConfigRow = database
      .prepare('SELECT cli_options FROM site_configs WHERE id = ?')
      .get(1) as { cli_options: string };
    expect(JSON.parse(dirtySiteConfigRow.cli_options)).toEqual([
      ['no-skip', true],
      ['verbose', true],
      ['username', 'someuser'],
      ['not-in-catalog', false],
    ]);

    const normalScheduleRow = database
      .prepare('SELECT commandSource FROM schedules WHERE id = ?')
      .get('schedule-normal') as { commandSource: string };
    const normalCommandSource = JSON.parse(normalScheduleRow.commandSource) as {
      userOptions: Array<[string, unknown]>;
    };
    expect(normalCommandSource.userOptions).toEqual([
      ['no-skip', true],
      ['verbose', true],
    ]);
  });

  test('does not throw and leaves siteOptionsSnapshot untouched for {} and a url mapped to []', () => {
    const database = openTestDatabase();

    const EMPTY_OBJECT_SNAPSHOT = '{}';
    const EMPTY_ARRAY_VALUE_SNAPSHOT = JSON.stringify({ 'https://b.test': [] });
    const NEUTRAL_COMMAND_SOURCE = JSON.stringify({
      urls: ['https://b.test/a'],
      userOptions: [],
      excludedOptions: [],
    });

    const insertSchedule = database.prepare(
      `INSERT INTO schedules
        (id, userId, name, status, timezone, recurrence, startDate, endDate, misfirePolicy,
         commandSource, siteOptionsSnapshot, nextOccurrenceAt, lastOccurrenceAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertSchedule.run(
      'schedule-empty-object',
      'user-1',
      'Empty Object Snapshot Schedule',
      'paused',
      'UTC',
      JSON.stringify({ kind: 'once', time: '00:00' }),
      '2026-01-01',
      null,
      'skip',
      NEUTRAL_COMMAND_SOURCE,
      EMPTY_OBJECT_SNAPSHOT,
      null,
      null,
      1000,
      1000,
    );
    insertSchedule.run(
      'schedule-empty-array-value',
      'user-1',
      'Empty Array Value Snapshot Schedule',
      'paused',
      'UTC',
      JSON.stringify({ kind: 'once', time: '00:00' }),
      '2026-01-01',
      null,
      'skip',
      NEUTRAL_COMMAND_SOURCE,
      EMPTY_ARRAY_VALUE_SNAPSHOT,
      null,
      null,
      1000,
      1000,
    );

    expect(() => normalizeBooleanOptionValues(database)).not.toThrow();

    const emptyObjectRow = database
      .prepare('SELECT siteOptionsSnapshot FROM schedules WHERE id = ?')
      .get('schedule-empty-object') as { siteOptionsSnapshot: string };
    expect(emptyObjectRow.siteOptionsSnapshot).toBe(EMPTY_OBJECT_SNAPSHOT);

    const emptyArrayValueRow = database
      .prepare('SELECT siteOptionsSnapshot FROM schedules WHERE id = ?')
      .get('schedule-empty-array-value') as { siteOptionsSnapshot: string };
    expect(emptyArrayValueRow.siteOptionsSnapshot).toBe(EMPTY_ARRAY_VALUE_SNAPSHOT);
  });

  test('flips a boolean-false tuple while a keep sentinel and a masked value survive alongside it', () => {
    const database = openTestDatabase();

    const commandSourceWithSentinelAndMask = JSON.stringify({
      urls: ['https://sentinel.example.com/a'],
      userOptions: [
        ['password', { keep: true }],
        ['cookies', SENSITIVE_MASK],
        ['no-skip', false],
      ],
      excludedOptions: [],
    });

    database
      .prepare(
        `INSERT INTO schedules
          (id, userId, name, status, timezone, recurrence, startDate, endDate, misfirePolicy,
           commandSource, siteOptionsSnapshot, nextOccurrenceAt, lastOccurrenceAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'schedule-sentinel',
        'user-1',
        'Sentinel Schedule',
        'paused',
        'UTC',
        JSON.stringify({ kind: 'once', time: '00:00' }),
        '2026-01-01',
        null,
        'skip',
        commandSourceWithSentinelAndMask,
        '{}',
        null,
        null,
        1000,
        1000,
      );

    normalizeBooleanOptionValues(database);

    const row = database
      .prepare('SELECT commandSource FROM schedules WHERE id = ?')
      .get('schedule-sentinel') as { commandSource: string };
    const commandSource = JSON.parse(row.commandSource) as {
      userOptions: Array<[string, unknown]>;
    };

    expect(commandSource.userOptions).toEqual([
      ['password', { keep: true }],
      ['cookies', SENSITIVE_MASK],
      ['no-skip', true],
    ]);
  });
});
