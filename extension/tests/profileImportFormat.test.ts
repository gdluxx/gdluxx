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
 * Fixtures are shared with the server suite (`tests/fixtures/profile-import/`)
 * so a disagreement shows up as one side failing on a file the other accepts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getMockBrowser, resetMockBrowser } from './support/mockBrowser';
import legacyBareBundle from '../../tests/fixtures/profile-import/legacy-bare-bundle.json';
import serverCombined from '../../tests/fixtures/profile-import/server-combined.json';
import extensionCombined from '../../tests/fixtures/profile-import/extension-combined.json';
import type { ExtractionBundle, ExtractionProfile } from '#src/content/types';

const STORAGE_KEY = 'gdluxx_extraction_profiles';
const VERSION_KEY = 'gdluxx_extraction_profiles_version';

const KIND = 'gdluxx.extension-profiles.bundle';

async function loadStore() {
  vi.resetModules();
  return import('#utils/storageExtractionProfiles');
}

type Store = Awaited<ReturnType<typeof loadStore>>;

beforeEach(async () => {
  await resetMockBrowser();
});

/* helpers */

function seed(items: Record<string, unknown>): Promise<void> {
  return getMockBrowser().storage.local.set(items);
}

function storedBundle(): unknown {
  return getMockBrowser().storage.local.dump()[STORAGE_KEY];
}

function profile(overrides: Partial<ExtractionProfile> & { id: string }): ExtractionProfile {
  return {
    scope: 'host',
    host: 'example.com',
    extraction: { mode: 'range', startSelector: '#start', endSelector: '#end' },
    rules: [],
    applyToPreview: false,
    autoApply: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as ExtractionProfile;
}

function bundleOf(profiles: ExtractionProfile[], version = 1): ExtractionBundle {
  return { version, profiles: Object.fromEntries(profiles.map((p) => [p.id, p])) };
}

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { kind: KIND, version: 1, ...overrides };
}

function rulesOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `rule-${i}`,
    pattern: `thumb-${i}`,
    replacement: 'full',
    flags: 'g',
    enabled: true,
    order: i,
  }));
}

function manyProfiles(count: number, prefix: string): ExtractionProfile[] {
  return Array.from({ length: count }, (_, i) =>
    profile({ id: `host::${prefix}-${i}.example`, host: `${prefix}-${i}.example` }),
  );
}

async function importFile(store: Store, raw: unknown) {
  return store.importExtractionProfiles(store.normaliseImportPayload(raw));
}

describe('both wrapper shapes import (cases 4-6, 13, 24)', () => {
  test('case 4: a legacy bare bundle imports as one profile', async () => {
    const store = await loadStore();
    const result = await importFile(store, legacyBareBundle);
    expect(result.added).toBe(1);
    expect((await store.loadExtractionProfiles()).map((p) => p.id)).toEqual(['host::wallhaven.cc']);
  });

  test('case 5: a server combined export imports, ignoring selectors and subs', async () => {
    const store = await loadStore();
    const result = await importFile(store, serverCombined);
    expect(result.added).toBe(1);

    const stored = await store.exportExtractionProfiles();
    expect(Object.keys(stored.profiles)).toEqual(['host::wallhaven.cc']);
    expect(stored).not.toHaveProperty('selectors');
    expect(stored).not.toHaveProperty('subs');
  });

  test('case 6: an extension combined export imports', async () => {
    const store = await loadStore();
    expect((await importFile(store, extensionCombined)).added).toBe(1);
  });

  test('case 13: a combined envelope with no extraction section is a valid no-op', async () => {
    const store = await loadStore();
    const result = await importFile(store, envelope({ selectors: { version: 1, profiles: {} } }));
    expect(result).toMatchObject({ added: 0, overwritten: 0 });
    expect(await store.loadExtractionProfiles()).toEqual([]);
  });

  test('case 24: an unknown additive top-level field is accepted and ignored', async () => {
    const store = await loadStore();
    const result = await importFile(
      store,
      envelope({
        somethingFromANewerBuild: { nested: true },
        extraction: bundleOf([profile({ id: 'host::example.com' })]),
      }),
    );
    expect(result.added).toBe(1);
  });

  test('the round trip: what the extension exports, the extension re-imports', async () => {
    const store = await loadStore();
    await importFile(store, serverCombined);

    const exported = {
      kind: KIND,
      version: 1,
      exportedAt: Date.now(),
      extraction: await store.exportExtractionProfiles(),
    };

    const fresh = await loadStore();
    await getMockBrowser().storage.local.clear();
    expect((await importFile(fresh, exported)).added).toBe(1);
  });
});

describe('envelope version semantics (cases 7, 8, C3)', () => {
  test('case 7: a future envelope version raises BundleVersionTooNewError', async () => {
    const store = await loadStore();
    expect(() =>
      store.normaliseImportPayload(envelope({ version: 2, extraction: bundleOf([]) })),
    ).toThrow(store.BundleVersionTooNewError);
  });

  test.each([
    ['missing', undefined],
    ['a string', '1'],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
  ])('case 8: envelope version %s is malformed, not silently accepted', async (_l, version) => {
    const store = await loadStore();
    const payload: Record<string, unknown> = { kind: KIND, extraction: bundleOf([]) };
    if (version !== undefined) payload.version = version;

    expect(() => store.normaliseImportPayload(payload)).toThrow(store.INVALID_IMPORT_MESSAGE);
  });
});

describe('legacy bare-bundle version clamping (cases 8b, 8c, C3)', () => {
  test.each([
    ['missing', undefined],
    ['a string', '1'],
    ['negative', -1],
    ['fractional', 1.5],
  ])('case 8b: a legacy version that is %s clamps to 1', async (_l, version) => {
    const store = await loadStore();
    const payload: Record<string, unknown> = { profiles: {} };
    if (version !== undefined) payload.version = version;

    expect(store.normaliseImportPayload(payload).version).toBe(1);
  });

  test('case 8c: a legacy version of 0 survives normalization but stores as 1', async () => {
    const store = await loadStore();
    const normalised = store.normaliseImportPayload({
      version: 0,
      profiles: { 'host::example.com': profile({ id: 'host::example.com' }) },
    });
    expect(normalised.version).toBe(0);

    await store.importExtractionProfiles(normalised);
    expect((await store.exportExtractionProfiles()).version).toBe(1);
  });

  test('the version trap: a bare bundle carries a sub-bundle version, not an envelope one', async () => {
    const store = await loadStore();

    expect(store.COMBINED_ENVELOPE_VERSION).toBe(1);
    expect(store.normaliseImportPayload({ version: 1, profiles: {} }).version).toBe(1);
  });
});

describe('required sections and the landmine shape (cases 9-12, C4)', () => {
  test('case 9: {kind, version} alone is a valid no-op', async () => {
    const store = await loadStore();
    expect(store.normaliseImportPayload(envelope())).toEqual({ version: 1, profiles: {} });
    expect(await importFile(store, envelope())).toMatchObject({ added: 0, overwritten: 0 });
  });

  test('case 10: a top-level `profiles` alongside `kind` is malformed, not a silent no-op', async () => {
    const store = await loadStore();
    expect(() =>
      store.normaliseImportPayload(
        envelope({ profiles: { 'host::example.com': profile({ id: 'host::example.com' }) } }),
      ),
    ).toThrow(store.PARTIAL_CONVERSION_MESSAGE);
  });

  test('case 11: an explicitly empty extraction section is a valid no-op', async () => {
    const store = await loadStore();
    const result = await importFile(store, envelope({ extraction: { version: 1, profiles: {} } }));
    expect(result).toMatchObject({ added: 0, overwritten: 0 });
  });

  test('case 12: an array `profiles` is malformed in either position', async () => {
    const store = await loadStore();
    expect(() => store.normaliseImportPayload({ version: 1, profiles: [] })).toThrow(
      store.INVALID_IMPORT_MESSAGE,
    );
    await expect(
      importFile(store, envelope({ extraction: { version: 1, profiles: [] } })),
    ).rejects.toThrow(store.INVALID_IMPORT_MESSAGE);
  });

  test('a wrong `kind` is reported as a wrong file, not a parse failure', async () => {
    const store = await loadStore();
    expect(() => store.normaliseImportPayload({ kind: 'something.else', version: 1 })).toThrow(
      'not a gdluxx extension profile bundle',
    );
  });
});

describe('incoming sub-bundle version (case 14, C7)', () => {
  test('a future extraction sub-bundle is rejected without changing anything', async () => {
    const store = await loadStore();
    await store.saveExtractionProfile({
      scope: 'host',
      host: 'kept.example',
      extraction: { mode: 'range', startSelector: '#a', endSelector: '#b' },
      rules: [],
      applyToPreview: false,
    });

    await expect(
      importFile(store, envelope({ extraction: bundleOf([profile({ id: 'x' })], 2) })),
    ).rejects.toBeInstanceOf(store.BundleVersionTooNewError);

    expect((await store.loadExtractionProfiles()).map((p) => p.id)).toEqual(['host::kept.example']);
  });
});

describe('stored-bundle version and unreadable storage (cases 14d-14g, C8)', () => {
  test('case 14d: a locally stored future bundle is refused, storage untouched', async () => {
    const future = { version: 2, profiles: { 'host::example.com': { somethingNew: true } } };
    await seed({ [STORAGE_KEY]: future });

    const store = await loadStore();
    await expect(store.loadExtractionProfiles()).rejects.toBeInstanceOf(
      store.BundleVersionTooNewError,
    );
    expect(storedBundle()).toEqual(future);
  });

  test('case 14e: an unrecognized stored shape is reported, never overwritten', async () => {
    const unrecognized = { version: 1, entries: [{ id: 'restructured-by-a-newer-build' }] };
    await seed({ [STORAGE_KEY]: unrecognized });

    const store = await loadStore();
    const status = await store.getExtractionStorageStatus();

    expect(status.degraded).toBe(true);
    expect(status.error).toBe(store.UNREADABLE_BUNDLE_MESSAGE);

    expect(storedBundle()).toEqual(unrecognized);
  });

  test('case 14f: a future VERSION_KEY marks a downgrade even when the bundle reads fine', async () => {
    const readable = { version: 1, profiles: {} };
    await seed({ [STORAGE_KEY]: readable, [VERSION_KEY]: 2 });

    const store = await loadStore();
    await expect(store.loadExtractionProfiles()).rejects.toBeInstanceOf(
      store.BundleVersionTooNewError,
    );
    expect(storedBundle()).toEqual(readable);
  });

  test('case 14g: an absent bundle is the one case that may write on load', async () => {
    const store = await loadStore();
    expect(await store.loadExtractionProfiles()).toEqual([]);

    const dump = getMockBrowser().storage.local.dump();
    expect(dump[STORAGE_KEY]).toEqual({ version: 1, profiles: {} });
    expect(dump[VERSION_KEY]).toBe(1);
  });

  test('a read failure degrades without writing', async () => {
    const local = getMockBrowser().storage.local;
    const realGet = local.get;
    local.get = vi.fn().mockRejectedValue(new Error('storage unavailable'));

    try {
      const store = await loadStore();
      const status = await store.getExtractionStorageStatus();
      expect(status.degraded).toBe(true);
      expect(getMockBrowser().storage.local.dump()).toEqual({});
    } finally {
      local.get = realGet;
    }
  });
});

describe('rule caps are enforced, never truncated (cases 15-17, C1)', () => {
  const scopeInput = {
    scope: 'host' as const,
    host: 'example.com',
    extraction: { mode: 'range' as const, startSelector: '#a', endSelector: '#b' },
    applyToPreview: false,
  };

  test.each([21, 500])('cases 15/16: a %d-rule profile saves and imports', async (count) => {
    const store = await loadStore();
    const saved = await store.saveExtractionProfile({ ...scopeInput, rules: rulesOf(count) });
    expect(saved.profile.rules).toHaveLength(count);

    const result = await importFile(
      store,
      envelope({
        extraction: bundleOf([
          profile({ id: 'host::other.example', host: 'other.example', rules: rulesOf(count) }),
        ]),
      }),
    );
    expect(result.added).toBe(1);
    const imported = (await store.loadExtractionProfiles()).find(
      (p) => p.id === 'host::other.example',
    );
    expect(imported?.rules).toHaveLength(count);
  });

  test('case 17: a 501-rule profile is rejected on save, not quietly shortened', async () => {
    const store = await loadStore();
    await expect(
      store.saveExtractionProfile({ ...scopeInput, rules: rulesOf(501) }),
    ).rejects.toBeInstanceOf(store.ProfileRuleLimitError);
    expect(await store.loadExtractionProfiles()).toEqual([]);
  });

  test('case 17: a 501-rule profile is skipped on import, not quietly shortened', async () => {
    const store = await loadStore();
    const result = await importFile(
      store,
      envelope({
        extraction: bundleOf([profile({ id: 'host::example.com', rules: rulesOf(501) })]),
      }),
    );

    expect(result).toMatchObject({ added: 0, overwritten: 0, skippedInvalid: 1 });
    expect(await store.loadExtractionProfiles()).toEqual([]);
  });
});

describe('targeted-config representation (cases 19-19e, C5)', () => {
  const goodImages = { via: 'selector' as const, selector: 'img', attr: 'src' };
  const goodContainer = { via: 'body' as const };

  function targetedProfile(container: unknown, images: unknown): ExtractionProfile {
    return profile({
      id: 'host::example.com',
      extraction: { mode: 'targeted', container, images },
    } as Partial<ExtractionProfile> & { id: string });
  }

  test('case 19: a raw file with a blank container selector is rejected, not repaired', async () => {
    const store = await loadStore();
    const result = await importFile(
      store,
      envelope({
        extraction: bundleOf([targetedProfile({ via: 'selector', selector: '' }, goodImages)]),
      }),
    );
    expect(result).toMatchObject({ added: 0, skippedInvalid: 1 });
  });

  test('case 19b: a string container missing `end` is rejected on import too', async () => {
    const store = await loadStore();
    const result = await importFile(
      store,
      envelope({
        extraction: bundleOf([targetedProfile({ via: 'string', begin: '<div>' }, goodImages)]),
      }),
    );
    expect(result).toMatchObject({ added: 0, skippedInvalid: 1 });
  });

  test('case 19c: saving with a blank container selector persists `via: body`', async () => {
    const store = await loadStore();
    const { profile: saved } = await store.saveExtractionProfile({
      scope: 'host',
      host: 'example.com',
      extraction: {
        mode: 'targeted',
        container: { via: 'selector', selector: '   ' },
        images: goodImages,
      },
      rules: [],
      applyToPreview: false,
    });

    expect(saved.extraction).toEqual({
      mode: 'targeted',
      container: { via: 'body' },
      images: goodImages,
    });
    expect(store.isTargetedConfigValid(saved.extraction as never)).toBe(true);
  });

  test('case 19d: saving with a half-filled string image source persists the img/src default', async () => {
    const store = await loadStore();
    const { profile: saved } = await store.saveExtractionProfile({
      scope: 'host',
      host: 'example.com',
      extraction: {
        mode: 'targeted',
        container: goodContainer,
        images: { via: 'string', begin: '<img src="' } as never,
      },
      rules: [],
      applyToPreview: false,
    });

    expect(saved.extraction).toEqual({
      mode: 'targeted',
      container: goodContainer,
      images: store.DEFAULT_IMAGE_SOURCE,
    });
  });

  test('case 19e: an already-stored invalid profile is repaired on load without bumping updatedAt', async () => {
    await seed({
      [STORAGE_KEY]: {
        version: 1,
        profiles: {
          'host::example.com': {
            ...profile({ id: 'host::example.com', updatedAt: 12_345 }),
            extraction: {
              mode: 'targeted',
              container: { via: 'selector', selector: '' },
              images: { via: 'string', begin: 'x' },
            },
          },
        },
      },
    });

    const store = await loadStore();
    const [repaired] = await store.loadExtractionProfiles();

    expect(repaired.extraction).toEqual({
      mode: 'targeted',
      container: { via: 'body' },
      images: store.DEFAULT_IMAGE_SOURCE,
    });
    // Repair is not a user edit; bumping updatedAt would let it win the
    // newerWins comparison against an identical remote copy
    expect(repaired.updatedAt).toBe(12_345);

    const persisted = storedBundle() as ExtractionBundle;
    expect(persisted.profiles['host::example.com'].extraction).toEqual(repaired.extraction);
  });

  test('a valid stored bundle is not rewritten on load', async () => {
    const clean = {
      version: 1,
      profiles: { 'host::example.com': profile({ id: 'host::example.com' }) },
    };
    await seed({ [STORAGE_KEY]: clean });

    const local = getMockBrowser().storage.local;
    const realSet = local.set;
    const spy = vi.fn(realSet);
    local.set = spy as typeof local.set;

    try {
      const store = await loadStore();
      await store.loadExtractionProfiles();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      local.set = realSet;
    }
  });
});

describe('capacity is a rejection, never a deletion (cases 20, 20c, 21, C6)', () => {
  test('case 20: a merge crossing the 1,000 total cap rejects and deletes nothing', async () => {
    const stored = manyProfiles(1000, 'stored');
    await seed({ [STORAGE_KEY]: bundleOf(stored) });

    const store = await loadStore();
    await expect(
      importFile(
        store,
        envelope({
          extraction: bundleOf([profile({ id: 'host::new.example', host: 'new.example' })]),
        }),
      ),
    ).rejects.toBeInstanceOf(store.ProfileCapacityError);

    expect(await store.loadExtractionProfiles()).toHaveLength(1000);
  });

  test('case 20c: an oversized server export reads as a capacity limit, not a format error', async () => {
    const store = await loadStore();

    let thrown: unknown;
    try {
      await importFile(store, envelope({ extraction: bundleOf(manyProfiles(1001, 'incoming')) }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(store.ProfileCapacityError);
    expect((thrown as Error).message).toContain('at most 1000');
    expect(await store.loadExtractionProfiles()).toEqual([]);
  });

  test('case 21: a merge crossing the 50-per-host cap rejects and deletes nothing', async () => {
    const stored = Array.from({ length: 40 }, (_, i) =>
      profile({ id: `path::example.com::/p${i}`, scope: 'path', path: `/p${i}` }),
    );
    await seed({ [STORAGE_KEY]: bundleOf(stored) });

    const store = await loadStore();
    const incoming = Array.from({ length: 15 }, (_, i) =>
      profile({ id: `path::example.com::/n${i}`, scope: 'path', path: `/n${i}` }),
    );

    await expect(
      importFile(store, envelope({ extraction: bundleOf(incoming) })),
    ).rejects.toBeInstanceOf(store.ProfileCapacityError);

    expect(await store.loadExtractionProfiles()).toHaveLength(40);
  });
});

describe('an import is not applied until storage accepts it (case 26, R1-C)', () => {
  test('a failed write leaves the old cache active and reports no success', async () => {
    const store = await loadStore();
    await store.saveExtractionProfile({
      scope: 'host',
      host: 'kept.example',
      extraction: { mode: 'range', startSelector: '#a', endSelector: '#b' },
      rules: [],
      applyToPreview: false,
    });

    const local = getMockBrowser().storage.local;
    const realSet = local.set;
    local.set = vi.fn().mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));

    try {
      await expect(
        importFile(
          store,
          envelope({
            extraction: bundleOf([profile({ id: 'host::new.example', host: 'new.example' })]),
          }),
        ),
      ).rejects.toThrow('QUOTA_BYTES');

      expect((await store.loadExtractionProfiles()).map((p) => p.id)).toEqual([
        'host::kept.example',
      ]);
      expect((await store.getExtractionStorageStatus()).degraded).toBe(true);
    } finally {
      local.set = realSet;
    }
  });
});
