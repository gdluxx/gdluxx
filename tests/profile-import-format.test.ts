/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Cross-format contract: the server must accept both the canonical combined
 * envelope and a legacy bare extension bundle, and must agree with the
 * extension on every acceptance rule that is not the wrapper.
 *
 * These exercise the *import schema* rather than `importExtensionProfileBundles`
 * alone. legacy normalization happens in the schema's preprocess step, so a
 * test that skips it cannot see it
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import type * as CoordinatorModuleShape from '../src/lib/server/extensionProfileImport';
import {
  COMBINED_BUNDLE_KIND,
  COMBINED_BUNDLE_VERSION,
  importableCombinedBundleSchema,
  MAX_RULES_PER_EXTRACTION_PROFILE,
  MAX_RULES_PER_SUB_PROFILE,
  type CombinedBundle,
} from '../src/lib/server/validation/extensionProfiles';
import {
  describeImportFailure,
  REQUEST_TOO_LARGE_MESSAGE,
} from '../src/lib/components/settings/extension-profiles-import';
import legacyBareBundle from './fixtures/profile-import/legacy-bare-bundle.json';
import serverCombined from './fixtures/profile-import/server-combined.json';
import extensionCombined from './fixtures/profile-import/extension-combined.json';

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const database = new Database(':memory:');

  database.exec(`
    CREATE TABLE apiKey (
      id TEXT PRIMARY KEY
    );

    CREATE TABLE extension_profile_backups (
      api_key_id TEXT PRIMARY KEY,
      bundle_json TEXT NOT NULL,
      profile_count INTEGER NOT NULL DEFAULT 0,
      synced_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE extension_sub_backups (
      api_key_id TEXT PRIMARY KEY,
      bundle_json TEXT NOT NULL,
      profile_count INTEGER NOT NULL DEFAULT 0,
      synced_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE extension_extraction_backups (
      api_key_id TEXT PRIMARY KEY REFERENCES apiKey(id) ON DELETE CASCADE,
      bundle_json TEXT NOT NULL,
      profile_count INTEGER NOT NULL DEFAULT 0,
      synced_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return { db: database };
});

vi.mock('$lib/server/database', () => ({
  DATABASE_PATH: ':memory:',
  openDatabase: () => db,
  getSharedDatabase: () => db,
}));

type CoordinatorModule = typeof CoordinatorModuleShape;

async function loadCoordinator(): Promise<CoordinatorModule> {
  vi.resetModules();
  return import('$lib/server/extensionProfileImport');
}

/* helpers */

const KEY = 'key-1';

function createKey(): void {
  db.prepare('INSERT INTO apiKey (id) VALUES (?)').run(KEY);
}

type BackupTable =
  | 'extension_profile_backups'
  | 'extension_sub_backups'
  | 'extension_extraction_backups';

function seedBundle(table: BackupTable, bundle: unknown, profileCount: number): void {
  db.prepare(
    `INSERT INTO ${table} (api_key_id, bundle_json, profile_count, synced_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(KEY, JSON.stringify(bundle), profileCount, 'seed', 1000, 1000);
}

function readBundle(table: BackupTable): { version: number; profiles: Record<string, unknown> } {
  const row = db.prepare(`SELECT bundle_json FROM ${table} WHERE api_key_id = ?`).get(KEY) as
    | { bundle_json: string }
    | undefined;
  expect(row).toBeDefined();
  return JSON.parse(row!.bundle_json);
}

function extractionProfile(id: string, host = 'example.com', rules: unknown[] = []) {
  return {
    id,
    scope: 'host' as const,
    host,
    extraction: { mode: 'range' as const, startSelector: `#${id}`, endSelector: '#end' },
    rules,
    applyToPreview: false,
    autoApply: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

function rule(index: number) {
  return {
    id: `rule-${index}`,
    pattern: `thumb-${index}`,
    replacement: 'full',
    flags: 'g',
    enabled: true,
    order: index,
  };
}

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { kind: COMBINED_BUNDLE_KIND, version: COMBINED_BUNDLE_VERSION, ...overrides };
}

function bundleOf(profiles: Array<{ id: string }>, version = 1) {
  return { version, profiles: Object.fromEntries(profiles.map((p) => [p.id, p])) };
}

/** Parse through the import schema exactly as the route does */
function parseImportable(raw: unknown) {
  return importableCombinedBundleSchema.safeParse(raw);
}

function parseOrThrow(raw: unknown): CombinedBundle {
  const result = parseImportable(raw);
  if (!result.success) {
    throw new Error(`expected the payload to parse: ${JSON.stringify(result.error.issues)}`);
  }
  return result.data;
}

/** The whole route path: schema first, then the transactional merge. */
async function importFile(raw: unknown) {
  const parsed = parseOrThrow(raw);
  const { importExtensionProfileBundles } = await loadCoordinator();
  return importExtensionProfileBundles(KEY, parsed, 'tester@example.test');
}

afterEach(() => {
  expect(db.inTransaction).toBe(false);
  vi.resetModules();
  db.exec(`
    DELETE FROM extension_extraction_backups;
    DELETE FROM extension_sub_backups;
    DELETE FROM extension_profile_backups;
    DELETE FROM apiKey;
  `);
});

describe('both wrapper shapes import (cases 1-3)', () => {
  test('case 1: a legacy bare extension bundle imports as one extraction profile', async () => {
    createKey();
    const outcome = await importFile(legacyBareBundle);
    expect(outcome).toMatchObject({ ok: true, extraction: { added: 1, updated: 0, total: 1 } });
  });

  test('case 2: a server combined export imports all three kinds', async () => {
    createKey();
    const outcome = await importFile(serverCombined);
    expect(outcome).toMatchObject({
      ok: true,
      selectors: { added: 1, updated: 0, total: 1 },
      subs: { added: 1, updated: 0, total: 1 },
      extraction: { added: 1, updated: 0, total: 1 },
    });
  });

  test('case 3: an extension combined export imports its extraction section', async () => {
    createKey();
    const outcome = await importFile(extensionCombined);
    expect(outcome).toMatchObject({ ok: true, extraction: { added: 1, updated: 0, total: 1 } });
  });

  test('case 22: importing the same file twice updates rather than duplicates', async () => {
    createKey();
    await importFile(serverCombined);
    const second = await importFile(serverCombined);
    expect(second).toMatchObject({
      ok: true,
      extraction: { added: 0, updated: 1, total: 1 },
    });
  });

  test('case 23: importing an extension-only envelope leaves stored selectors in place', async () => {
    createKey();
    await importFile(serverCombined);
    const outcome = await importFile(extensionCombined);
    expect(outcome.ok).toBe(true);
    expect(Object.keys(readBundle('extension_profile_backups').profiles)).toEqual([
      'host::example.com',
    ]);
    expect(Object.keys(readBundle('extension_sub_backups').profiles)).toEqual([
      'host::example.com',
    ]);
  });
});

describe('envelope version semantics (case 8, C3)', () => {
  const extraction = bundleOf([extractionProfile('ext-1')]);

  test.each([
    ['missing', undefined],
    ['a string', '1'],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
  ])('case 8: envelope version %s is malformed, not silently accepted', (_label, version) => {
    const payload: Record<string, unknown> = { kind: COMBINED_BUNDLE_KIND, extraction };
    if (version !== undefined) {
      payload.version = version;
    }
    expect(parseImportable(payload).success).toBe(false);
  });

  test('case 7 (server side): a future envelope version is rejected', () => {
    const result = parseImportable(envelope({ version: 2, extraction }));
    expect(result.success).toBe(false);
  });
});

describe('legacy bare-bundle version clamping (cases 8b, 8c, C3)', () => {
  test.each([
    ['missing', undefined],
    ['a string', '1'],
    ['negative', -1],
    ['fractional', 1.5],
  ])('case 8b: a legacy version that is %s clamps to extraction.version 1', (_label, version) => {
    const payload: Record<string, unknown> = {
      profiles: { 'ext-1': extractionProfile('ext-1') },
    };
    if (version !== undefined) {
      payload.version = version;
    }

    const parsed = parseOrThrow(payload);
    expect(parsed.version).toBe(COMBINED_BUNDLE_VERSION);
    expect(parsed.extraction.version).toBe(1);
  });

  test('case 8c: a legacy version of 0 survives normalization but stores as 1', async () => {
    createKey();
    const payload = { version: 0, profiles: { 'ext-1': extractionProfile('ext-1') } };

    const parsed = parseOrThrow(payload);
    expect(parsed.extraction.version).toBe(0);

    const { importExtensionProfileBundles } = await loadCoordinator();
    const outcome = importExtensionProfileBundles(KEY, parsed, null);
    expect(outcome.ok).toBe(true);
    expect(readBundle('extension_extraction_backups').version).toBe(1);
  });

  test('the version trap: envelope and sub-bundle versions come from separate sources', () => {
    // Both are 1 today. Asserting them independently means the day either
    // constant moves, this fails instead of silently passing
    const parsed = parseOrThrow({ version: 1, profiles: {} });
    expect(parsed.version).toBe(COMBINED_BUNDLE_VERSION);
    expect(parsed.extraction.version).toBe(1);
  });
});

describe('required sections and the landmine shape (cases 9-13, C4)', () => {
  test('case 9: {kind, version} alone is a valid no-op', async () => {
    createKey();
    const outcome = await importFile(envelope());
    expect(outcome).toMatchObject({
      ok: true,
      selectors: { added: 0, updated: 0, total: 0 },
      subs: { added: 0, updated: 0, total: 0 },
      extraction: { added: 0, updated: 0, total: 0 },
    });
  });

  test('case 10: a top-level `profiles` alongside `kind` is malformed, not a silent no-op', () => {
    const result = parseImportable(envelope({ profiles: { 'ext-1': extractionProfile('ext-1') } }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('partially converted'))).toBe(true);
  });

  test('case 11: an explicitly empty extraction section is a valid no-op', async () => {
    createKey();
    const outcome = await importFile(envelope({ extraction: { version: 1, profiles: {} } }));
    expect(outcome).toMatchObject({ ok: true, extraction: { added: 0, updated: 0, total: 0 } });
  });

  test('case 12: an array `profiles` is malformed', () => {
    expect(parseImportable({ version: 1, profiles: [] }).success).toBe(false);
    expect(parseImportable(envelope({ extraction: { version: 1, profiles: [] } })).success).toBe(
      false,
    );
  });

  test('a wrong `kind` is reported in words, not as a type error', () => {
    const result = parseImportable({ kind: 'something.else', version: 1 });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.message.includes('not a gdluxx extension profile bundle')),
    ).toBe(true);
  });
});

describe('sub-bundle version gating (cases 14, 14b, 14c, C7)', () => {
  test('case 14: a future incoming extraction sub-bundle is rejected without changes', async () => {
    createKey();
    seedBundle('extension_extraction_backups', bundleOf([extractionProfile('stored-1')]), 1);
    const before = readBundle('extension_extraction_backups');

    const outcome = await importFile(
      envelope({ extraction: bundleOf([extractionProfile('ext-1')], 2) }),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'validation' });
    expect(readBundle('extension_extraction_backups')).toEqual(before);
  });

  test('case 14b: a future *stored* bundle blocks the merge and is not relabeled', async () => {
    createKey();
    seedBundle(
      'extension_extraction_backups',
      { version: 2, profiles: { 'future-1': extractionProfile('future-1') } },
      1,
    );
    const before = readBundle('extension_extraction_backups');

    const outcome = await importFile(
      envelope({ extraction: bundleOf([extractionProfile('ext-1')], 1) }),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'validation' });
    const after = readBundle('extension_extraction_backups');
    expect(after).toEqual(before);
    expect(after.version).toBe(2);
  });

  test('case 14c: the gate covers selectors and subs too, not just extraction', async () => {
    createKey();
    const selectorPayload = envelope({
      selectors: { version: 2, profiles: {} },
    });
    const subPayload = envelope({ subs: { version: 2, profiles: {} } });

    await expect(importFile(selectorPayload)).resolves.toMatchObject({
      ok: false,
      reason: 'validation',
    });
    await expect(importFile(subPayload)).resolves.toMatchObject({
      ok: false,
      reason: 'validation',
    });
  });
});

describe('rule caps (cases 15-18, C1)', () => {
  const rulesOf = (count: number) => Array.from({ length: count }, (_, i) => rule(i));

  test('case 15: a 21-rule extraction profile is accepted', () => {
    const payload = envelope({
      extraction: bundleOf([extractionProfile('ext-1', 'example.com', rulesOf(21))]),
    });
    expect(parseImportable(payload).success).toBe(true);
  });

  test(`case 16: a ${MAX_RULES_PER_EXTRACTION_PROFILE}-rule extraction profile is accepted`, () => {
    const payload = envelope({
      extraction: bundleOf([
        extractionProfile('ext-1', 'example.com', rulesOf(MAX_RULES_PER_EXTRACTION_PROFILE)),
      ]),
    });
    expect(parseImportable(payload).success).toBe(true);
  });

  test(`case 17: a ${MAX_RULES_PER_EXTRACTION_PROFILE + 1}-rule extraction profile is rejected`, () => {
    const payload = envelope({
      extraction: bundleOf([
        extractionProfile('ext-1', 'example.com', rulesOf(MAX_RULES_PER_EXTRACTION_PROFILE + 1)),
      ]),
    });
    expect(parseImportable(payload).success).toBe(false);
  });

  test(`case 18: substitution profiles stay capped at ${MAX_RULES_PER_SUB_PROFILE}`, () => {
    const subProfile = {
      id: 'sub-1',
      scope: 'host' as const,
      host: 'example.com',
      rules: rulesOf(MAX_RULES_PER_SUB_PROFILE + 1),
      applyToPreview: false,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(parseImportable(envelope({ subs: bundleOf([subProfile]) })).success).toBe(false);

    const atCap = { ...subProfile, rules: rulesOf(MAX_RULES_PER_SUB_PROFILE) };
    expect(parseImportable(envelope({ subs: bundleOf([atCap]) })).success).toBe(true);
  });
});

describe('targeted-config validity stays strict on import (cases 19, 19b, C5)', () => {
  function targeted(container: unknown, images: unknown) {
    return {
      ...extractionProfile('ext-1'),
      extraction: { mode: 'targeted', container, images },
    };
  }

  const goodImages = { via: 'selector', selector: 'img', attr: 'src' };

  test('case 19: a blank container selector is rejected', () => {
    const payload = envelope({
      extraction: bundleOf([targeted({ via: 'selector', selector: '' }, goodImages)]),
    });
    expect(parseImportable(payload).success).toBe(false);
  });

  test('case 19b: a string container missing `end` is rejected', () => {
    const payload = envelope({
      extraction: bundleOf([targeted({ via: 'string', begin: '<div>' }, goodImages)]),
    });
    expect(parseImportable(payload).success).toBe(false);
  });

  test('a blank image selector is rejected too', () => {
    const payload = envelope({
      extraction: bundleOf([targeted({ via: 'body' }, { via: 'selector', selector: '  ' })]),
    });
    expect(parseImportable(payload).success).toBe(false);
  });
});

describe('capacity is a rejection, never a deletion (cases 20b, 21, C6)', () => {
  test('case 20b: crossing the 10,000 total cap rejects atomically', async () => {
    createKey();
    const stored = Object.fromEntries(
      Array.from({ length: 10_000 }, (_, i) => {
        const id = `stored-${i}`;
        return [id, extractionProfile(id, `host-${i % 400}.example`)];
      }),
    );
    seedBundle('extension_extraction_backups', { version: 1, profiles: stored }, 10_000);
    const before = readBundle('extension_extraction_backups');

    const outcome = await importFile(
      envelope({ extraction: bundleOf([extractionProfile('overflow', 'new.example')]) }),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'validation' });
    expect(Object.keys(readBundle('extension_extraction_backups').profiles)).toHaveLength(10_000);
    expect(readBundle('extension_extraction_backups')).toEqual(before);
  });

  test('case 21: crossing the 50-per-host cap rejects atomically', async () => {
    createKey();
    const stored = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`stored-${i}`, extractionProfile(`stored-${i}`)]),
    );
    seedBundle('extension_extraction_backups', { version: 1, profiles: stored }, 40);
    const before = readBundle('extension_extraction_backups');

    const outcome = await importFile(
      envelope({
        extraction: bundleOf(
          Array.from({ length: 15 }, (_, i) => extractionProfile(`incoming-${i}`)),
        ),
      }),
    );

    expect(outcome).toMatchObject({ ok: false, reason: 'validation' });
    expect(readBundle('extension_extraction_backups')).toEqual(before);
  });
});

describe('unknown additive fields (case 24, §3)', () => {
  test('an unknown top-level field is accepted and ignored, not rejected', async () => {
    createKey();
    const outcome = await importFile(
      envelope({
        somethingFromANewerBuild: { nested: true },
        extraction: bundleOf([extractionProfile('ext-1')]),
      }),
    );
    expect(outcome).toMatchObject({ ok: true, extraction: { added: 1, updated: 0, total: 1 } });
  });

  test('unknown fields on a legacy bare bundle ride along through normalization', () => {
    const parsed = parseOrThrow({
      version: 1,
      profiles: {},
      somethingFromANewerBuild: 'kept during parse, never read downstream',
    });
    expect((parsed as Record<string, unknown>).somethingFromANewerBuild).toBe(
      'kept during parse, never read downstream',
    );
  });
});

describe('request-size failures are legible (case 25, C1)', () => {
  test('the import modal maps an adapter-level 413 to an explicit message', () => {
    // adapter-node rejects before the route runs, so there is no API envelope
    expect(describeImportFailure(413, null)).toBe(REQUEST_TOO_LARGE_MESSAGE);
  });

  test('other failures still surface the API envelope, then a status fallback', () => {
    expect(describeImportFailure(400, { error: 'kind: bad file' })).toBe('kind: bad file');
    expect(describeImportFailure(500, null)).toBe('Server error: 500');
  });
});
