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

const { db } = await vi.hoisted(async () => {
  const { default: Database } = await import('better-sqlite3');
  const database = new Database(':memory:');
  database.exec(`
    CREATE TABLE apiKey (id TEXT PRIMARY KEY);
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

const {
  parseTolerantBundleUpsert,
  extractionProfileSchema,
  MAX_BUNDLE_JSON_BYTES,
  MAX_PROFILES_PER_HOST,
} = await import('$lib/server/validation/extensionProfiles');
const { saveExtractionBackup, getExtractionBackup } =
  await import('$lib/server/extensionExtractionBackupManager');

type Json = Record<string, unknown>;

function toJson(value: unknown): Json {
  return value as unknown as Json;
}

function extractionProfile(id: string, extra: Json = {}, host = 'example.com'): Json {
  return {
    id,
    scope: 'host',
    host,
    extraction: { mode: 'range', startSelector: `#${id}-s`, endSelector: `#${id}-e` },
    rules: [],
    applyToPreview: false,
    autoApply: true,
    createdAt: 1,
    updatedAt: 2,
    ...extra,
  };
}

function upsert(profiles: Json[], bundleExtra: Json = {}) {
  return {
    bundle: {
      version: 1,
      profiles: Object.fromEntries(profiles.map((p) => [p.id as string, p])),
      ...bundleExtra,
    },
    syncedBy: '  tester  ',
  };
}

/** PUT-route equivalent: tolerant validation → persist → fetch back. */
function put(payload: unknown) {
  const parsed = parseTolerantBundleUpsert(payload, extractionProfileSchema);
  if (!parsed.ok) {
    return { ok: false as const, message: parsed.message };
  }
  db.prepare('INSERT OR IGNORE INTO apiKey (id) VALUES (?)').run('key-1');
  const saved = saveExtractionBackup(
    'key-1',
    parsed.value.bundle as never,
    parsed.value.syncedBy ?? null,
  );
  expect(saved).not.toBeNull();
  const fetched = getExtractionBackup('key-1');
  return { ok: true as const, report: parsed.value.report, fetched: fetched! };
}

afterEach(() => {
  db.exec('DELETE FROM extension_extraction_backups; DELETE FROM apiKey;');
});

describe('AC1 unknown fields round-trip', () => {
  test('unknown top-level profile field survives PUT → persist → fetch', () => {
    const res = put(
      upsert([extractionProfile('p1', { futureField: 'x', futureObject: { deep: [1, 2] } })], {
        futureBundleKey: 'keep me',
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const stored = toJson(res.fetched.bundle.profiles.p1);
    expect(stored.futureField).toBe('x');
    expect(stored.futureObject).toEqual({ deep: [1, 2] });
    expect(toJson(res.fetched.bundle).futureBundleKey).toBe('keep me');
    expect(res.fetched.profileCount).toBe(1);
    expect(res.fetched.syncedBy).toBe('tester');
    expect(res.report.skipped.count).toBe(0);
    expect(res.report.tolerated.count).toBe(0);
  });
});

describe('AC2 future shapes are not bundle-fatal', () => {
  test('unknown discriminated-union variant + extra tuple element are stored and reported', () => {
    const futureUnion = extractionProfile('future-mode', {
      extraction: { mode: 'auto', hint: 'magic' },
    });
    const futureTuple = extractionProfile('future-tuple', {
      gallery: { thumbSizes: [1, 2, 3, 4], gap: 1, border: 1, buttonCorner: 'bottom-right' },
    });
    const res = put(upsert([extractionProfile('good'), futureUnion, futureTuple]));
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }

    expect(Object.keys(res.fetched.bundle.profiles).sort()).toEqual([
      'future-mode',
      'future-tuple',
      'good',
    ]);
    expect(res.report.skipped.count).toBe(0);
    expect(res.report.tolerated.count).toBe(2);
    expect(res.report.tolerated.profiles.map((p) => p.id).sort()).toEqual([
      'future-mode',
      'future-tuple',
    ]);
    expect(toJson(res.fetched.bundle.profiles['future-mode']).extraction).toEqual({
      mode: 'auto',
      hint: 'magic',
    });
    expect(toJson(toJson(res.fetched.bundle.profiles['future-tuple']).gallery).thumbSizes).toEqual([
      1, 2, 3, 4,
    ]);
  });

  test('a spine failure skips one profile and reports it; the rest persist', () => {
    const res = put(
      upsert([
        extractionProfile('good'),
        { ...extractionProfile('no-host'), host: '' },
        { ...extractionProfile('bad-scope'), scope: 'path' },
      ]),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(Object.keys(res.fetched.bundle.profiles)).toEqual(['good']);
    expect(res.report.skipped.count).toBe(2);
    expect(res.report.skipped.profiles.map((p) => p.id).sort()).toEqual(['bad-scope', 'no-host']);
    expect(res.report.skipped.profiles[0].reason).toBeTruthy();
    expect(res.fetched.profileCount).toBe(1);
  });

  test('__proto__ keyed profile is skipped', () => {
    const payload = JSON.parse(
      `{"bundle":{"version":1,"profiles":{"__proto__":${JSON.stringify(
        extractionProfile('p'),
      )},"ok":${JSON.stringify(extractionProfile('ok'))}}}}`,
    );
    expect(Object.keys(payload.bundle.profiles)).toEqual(['__proto__', 'ok']);
    const res = put(payload);
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(Object.keys(res.fetched.bundle.profiles)).toEqual(['ok']);
    expect(res.report.skipped.count).toBe(1);
  });
});

describe('AC3 null / false optional fields', () => {
  test('directorySource null, accumulate null and accumulate false round-trip intact', () => {
    const res = put(
      upsert([
        extractionProfile('nulls', { directorySource: null, accumulate: null }),
        extractionProfile('explicit-false', { accumulate: false }),
        extractionProfile('real-dir', {
          directorySource: { via: 'selector', selector: '.dir', attr: 'title' },
          accumulate: true,
        }),
      ]),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.report.tolerated.count).toBe(0);
    expect(res.report.skipped.count).toBe(0);

    const nulls = toJson(res.fetched.bundle.profiles.nulls);
    expect(nulls.directorySource).toBeNull();
    expect(nulls.accumulate).toBeNull();
    expect('directorySource' in nulls).toBe(true);
    expect(toJson(res.fetched.bundle.profiles['explicit-false']).accumulate).toBe(false);
    expect(toJson(res.fetched.bundle.profiles['real-dir']).directorySource).toEqual({
      via: 'selector',
      selector: '.dir',
      attr: 'title',
    });
  });

  test('directorySource: null does not satisfy hasContent on its own', () => {
    const contentFree = extractionProfile('empty', {
      extraction: { mode: 'range', startSelector: '', endSelector: '' },
      directorySource: null,
    });
    expect(extractionProfileSchema.safeParse(contentFree).success).toBe(false);
    const withDir = {
      ...contentFree,
      directorySource: { via: 'selector', selector: '.dir' },
    };
    expect(extractionProfileSchema.safeParse(withDir).success).toBe(true);
  });
});

describe('AC4 caps', () => {
  test('oversized bundle is rejected with a clear message', () => {
    const big = extractionProfile('huge', { blob: 'x'.repeat(MAX_BUNDLE_JSON_BYTES + 10) });
    const res = put(upsert([big]));
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.message).toMatch(/max allowed is \d+ bytes/);
    expect(getExtractionBackup('key-1')).toBeNull();
  });

  test('per-host cap still enforced on the accepted profiles', () => {
    const profiles = Array.from({ length: MAX_PROFILES_PER_HOST + 1 }, (_, i) =>
      extractionProfile(`p${i}`, {}, 'cap.example'),
    );
    const res = put(upsert(profiles));
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.message).toContain('max allowed is 50');
  });

  test('envelope failures are fatal', () => {
    expect(put({ bundle: { version: 1 } }).ok).toBe(false);
    expect(put({ bundle: { version: -1, profiles: {} } }).ok).toBe(false);
    expect(put({ bundle: { version: 1, profiles: [] } }).ok).toBe(false);
    expect(put({ bundle: { version: 1, profiles: {} }, syncedBy: '   ' }).ok).toBe(false);
    expect(put(null).ok).toBe(false);
    expect(put({ bundle: { version: 1, profiles: {} } }).ok).toBe(true);
  });
});

describe('bonus: file-import path (combinedBundleSchema) keeps unknown keys', () => {
  test('looseObject base schemas no longer strip unknown profile keys', async () => {
    const { combinedBundleSchema } = await import('$lib/server/validation/extensionProfiles');
    const parsed = combinedBundleSchema.safeParse({
      kind: 'gdluxx.extension-profiles.bundle',
      version: 1,
      extraction: {
        version: 1,
        profiles: { p1: extractionProfile('p1', { futureField: 'x', accumulate: null }) },
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    const p = toJson(parsed.data.extraction.profiles.p1);
    expect(p.futureField).toBe('x');
    expect(p.accumulate).toBeNull();
  });
});
