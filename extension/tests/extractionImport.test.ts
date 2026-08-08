/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { resetMockBrowser } from './support/mockBrowser';
import strippedBundleFixture from '../../tests/fixtures/previous-release/extraction-bundle.stripped.json';
import type { ExtractionBundle, ExtractionProfile } from '#src/content/types';

async function loadStore() {
  vi.resetModules();
  return import('#utils/storageExtractionProfiles');
}

beforeEach(async () => {
  await resetMockBrowser();
});

describe('planExtractionImport / applyExtractionImportPlan against the v0.11.0 stripped fixture', () => {
  test('local directorySource and explicit accumulate:false survive a restore where the incoming copy lacks both fields', async () => {
    const store = await loadStore();

    await store.saveExtractionProfile({
      scope: 'host',
      host: 'example.com',
      extraction: { mode: 'range', startSelector: '#gallery-start', endSelector: '#gallery-end' },
      rules: [],
      applyToPreview: false,
      directorySource: { via: 'selector', selector: '.dir' },
      accumulate: false,
    });

    const plan = await store.planExtractionImport(
      strippedBundleFixture as unknown as ExtractionBundle,
    );

    expect(plan.toAdd.map((p) => p.id)).toEqual(['host::foo.example']);
    expect(plan.toOverwrite.map((p) => p.id)).toEqual(['host::example.com']);
    expect(plan.mergedProfiles).toBe(1);
    expect(plan.mergedFields).toBe(2); // directorySource + accumulate

    const applied = await store.applyExtractionImportPlan(plan);
    expect(applied.mergedProfiles).toBe(1);
    expect(applied.mergedFields).toBe(2);

    const profiles = await store.loadExtractionProfiles();
    const merged = profiles.find((p) => p.id === 'host::example.com');
    expect(merged?.directorySource).toEqual({ via: 'selector', selector: '.dir' });
    expect(merged?.accumulate).toBe(false);

    const added = profiles.find((p) => p.id === 'host::foo.example');
    expect(added).toBeDefined();
    expect(added?.extraction.mode).toBe('targeted');
  });

  test('an explicit null in the incoming copy clears the local value instead of being treated as "unknown"', async () => {
    const store = await loadStore();

    await store.saveExtractionProfile({
      scope: 'host',
      host: 'example.com',
      extraction: { mode: 'range', startSelector: '#s', endSelector: '#e' },
      rules: [],
      applyToPreview: false,
      directorySource: { via: 'selector', selector: '.old-dir' },
      accumulate: true,
    });

    const incomingBundle = {
      version: 1,
      profiles: {
        'host::example.com': {
          id: 'host::example.com',
          scope: 'host',
          host: 'example.com',
          extraction: { mode: 'range', startSelector: '#s', endSelector: '#e' },
          rules: [],
          applyToPreview: false,
          autoApply: true,
          directorySource: null,
          accumulate: null,
          createdAt: 1,
          updatedAt: 2,
        },
      },
    } as unknown as ExtractionBundle;

    const plan = await store.planExtractionImport(incomingBundle);
    expect(plan.toOverwrite.map((p) => p.id)).toEqual(['host::example.com']);
    expect(plan.mergedFields).toBe(0);
    expect(plan.mergedProfiles).toBe(0);

    await store.applyExtractionImportPlan(plan);
    const profiles = await store.loadExtractionProfiles();
    const cleared = profiles.find((p) => p.id === 'host::example.com');
    expect(cleared?.directorySource).toBeNull();
    expect(cleared?.accumulate).toBeNull();
  });

  test('an unknown top-level profile key round-trips through import -> export', async () => {
    const store = await loadStore();

    const incomingBundle = {
      version: 1,
      profiles: {
        'host::new-host.example': {
          id: 'host::new-host.example',
          scope: 'host',
          host: 'new-host.example',
          extraction: { mode: 'range', startSelector: '#s', endSelector: '#e' },
          rules: [],
          applyToPreview: false,
          autoApply: true,
          createdAt: 1,
          updatedAt: 2,
          futureField: 'from-a-newer-extension',
        },
      },
    } as unknown as ExtractionBundle;

    await store.importExtractionProfiles(incomingBundle);
    const exported = await store.exportExtractionProfiles();
    const profile = exported.profiles['host::new-host.example'] as ExtractionProfile &
      Record<string, unknown>;
    expect(profile.futureField).toBe('from-a-newer-extension');
  });
});

describe('bundle.version forward-tolerance guard (Phase 3.4)', () => {
  test('a bundle newer than this build understands is rejected with BundleVersionTooNewError', async () => {
    const store = await loadStore();
    const tooNew = { version: 999, profiles: {} } as unknown as ExtractionBundle;

    await expect(store.planExtractionImport(tooNew)).rejects.toBeInstanceOf(
      store.BundleVersionTooNewError,
    );
  });

  test('assertBundleReadable is the same guard, callable directly', async () => {
    const store = await loadStore();
    expect(() => store.assertBundleReadable({ version: 1, profiles: {} })).not.toThrow();
    expect(() => store.assertBundleReadable({ version: 999, profiles: {} })).toThrow(
      store.BundleVersionTooNewError,
    );
  });
});
