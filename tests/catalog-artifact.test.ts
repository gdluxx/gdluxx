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
import catalogRaw from '$lib/assets/gallery-dl-catalog.json';
import { catalogArtifactSchema } from '$lib/server/validation/catalog-validation';
import type { CatalogArtifact as CatalogArtifactFromSchema } from '$lib/server/validation/catalog-validation';
import type { CatalogArtifact } from '$lib/types/catalog';

const PIPE_ALLOWLIST = new Set([
  'Action',
  'extractor.*.user-agent',
  'extractor.steamgriddb.dimensions',
  'extractor.steamgriddb.file-types',
  'extractor.steamgriddb.styles',
]);

const OPTION_SITE_ALLOWLIST = new Set(['generic', 'lolisafe', 'oauth', 'ytdl']);

const CUSTOM_TYPE_MISS_CEILING = 7;

const parsed = catalogArtifactSchema.parse(catalogRaw);

describe('catalog artifact', () => {
  test('parses under the Zod schema', () => {
    expect(() => catalogArtifactSchema.parse(catalogRaw)).not.toThrow();
  });

  test('optionCount is at least 680 and matches options.length', () => {
    expect(parsed.provenance.optionCount).toBeGreaterThanOrEqual(680);
    expect(parsed.provenance.optionCount).toBe(parsed.options.length);
  });

  test('provenance fields are non-empty', () => {
    const { provenance } = parsed;
    expect(provenance.galleryDlVersion).not.toBe('');
    expect(provenance.sourceRef).not.toBe('');
    expect(provenance.sourceUrl).not.toBe('');
    expect(provenance.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(provenance.generatedAt).not.toBe('');
    expect(provenance.generatorVersion).toBeGreaterThan(0);
  });

  test('every option.fam exists in families', () => {
    const famKeys = new Set(Object.keys(parsed.families));
    for (const option of parsed.options) {
      if (option.fam !== undefined) {
        expect(famKeys.has(option.fam)).toBe(true);
      }
    }
  });

  test('every option.site appears in sites, aside from the pinned allowlist', () => {
    if (parsed.sites.length === 0) {
      expect(parsed.sites).toEqual([]);
      return;
    }
    const siteKeys = new Set(parsed.sites.map((site) => site.k));
    const mismatches = new Set<string>();
    for (const option of parsed.options) {
      if (option.site !== undefined && !siteKeys.has(option.site)) {
        mismatches.add(option.site);
      }
    }
    expect(mismatches).toEqual(OPTION_SITE_ALLOWLIST);
  });

  test('siteCount is at least 380 and matches sites.length', () => {
    expect(parsed.provenance.siteCount).toBeGreaterThanOrEqual(380);
    expect(parsed.provenance.siteCount).toBe(parsed.sites.length);
  });

  test('sitesSha256 is a populated sha256 hex digest', () => {
    expect(parsed.provenance.sitesSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test('families.Danbooru.members contains the four known Danbooru instances', () => {
    const members = parsed.families.Danbooru?.members ?? [];
    for (const site of ['danbooru', 'atfbooru', 'aibooru', 'booruvar']) {
      expect(members).toContain(site);
    }
  });

  test('the two abstract families stay unexpanded', () => {
    expect(parsed.families.booru?.members).toEqual([]);
    expect(parsed.families['manga-extractor']?.members).toEqual([]);
  });

  test('no option.d or dterms[].d contains " | " outside the pinned allowlist', () => {
    const violations = new Set<string>();
    for (const option of parsed.options) {
      if (option.d.includes(' | ')) {
        violations.add(option.n);
      }
      for (const term of option.dterms ?? []) {
        if (term.d.includes(' | ')) {
          violations.add(option.n);
        }
      }
    }
    for (const name of violations) {
      expect(PIPE_ALLOWLIST.has(name)).toBe(true);
    }
  });

  test('custom-kind type refs mostly resolve as customTypes keys (soft ceiling)', () => {
    const misses: string[] = [];
    for (const option of parsed.options) {
      for (const type of option.t) {
        if (type.k === 'custom' && !(type.x in parsed.customTypes)) {
          misses.push(`${option.n}: ${type.x}`);
        }
      }
    }
    expect(misses.length).toBeLessThanOrEqual(CUSTOM_TYPE_MISS_CEILING);
  });

  test('CatalogArtifact and the Zod-inferred type are bidirectionally assignable', () => {
    const asInterface: CatalogArtifact = parsed;
    const asSchemaType: CatalogArtifactFromSchema = asInterface;
    expect(asSchemaType).toBe(parsed);
  });
});
