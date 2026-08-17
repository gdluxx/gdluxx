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
import miniCatalogRaw from './fixtures/catalog/mini-catalog.json';
import catalogRaw from '$lib/assets/gallery-dl-catalog.json';
import type { CatalogArtifact, CatalogKind, CatalogOption, CatalogSite } from '$lib/types/catalog';
import {
  bucketKind,
  buildSiteChoices,
  filterSiteChoices,
  matchesFilters,
  sitesForOption,
  type BucketedKind,
  type CatalogFilterState,
} from '$lib/utils/catalogFilter';

const miniCatalog = miniCatalogRaw as unknown as CatalogArtifact;
const catalog = catalogRaw as unknown as CatalogArtifact;

function baseState(overrides: Partial<CatalogFilterState> = {}): CatalogFilterState {
  return {
    q: '',
    section: '',
    site: '',
    kinds: new Set<BucketedKind>(),
    families: miniCatalog.families,
    ...overrides,
  };
}

function namesOf(state: CatalogFilterState): string[] {
  return miniCatalog.options.filter((o) => matchesFilters(o, state)).map((o) => o.n);
}

describe('bucketKind', () => {
  test('integer buckets to number', () => {
    expect(bucketKind('integer')).toBe('number');
  });

  test('number buckets to number', () => {
    expect(bucketKind('number')).toBe('number');
  });

  test('any buckets to custom', () => {
    expect(bucketKind('any')).toBe('custom');
  });

  test('unrecognized kinds bucket to custom', () => {
    expect(bucketKind('totally-unknown' as CatalogKind)).toBe('custom');
  });

  test('the five remaining kinds pass through unchanged', () => {
    expect(bucketKind('boolean')).toBe('boolean');
    expect(bucketKind('string')).toBe('string');
    expect(bucketKind('array')).toBe('array');
    expect(bucketKind('object')).toBe('object');
    expect(bucketKind('custom')).toBe('custom');
  });
});

describe('sitesForOption', () => {
  test('a site option resolves to just that site', () => {
    const option = miniCatalog.options.find((o) => o.n === 'extractor.ao3.formats')!;
    expect(sitesForOption(option, miniCatalog.families)).toEqual(['ao3']);
  });

  test('a fam option resolves to its family members', () => {
    const option = miniCatalog.options.find((o) => o.n === 'extractor.[Danbooru].external')!;
    expect(sitesForOption(option, miniCatalog.families)).toEqual([
      'danbooru',
      'atfbooru',
      'aibooru',
      'booruvar',
    ]);
  });

  test('an option with neither site nor fam resolves to no sites', () => {
    const option = miniCatalog.options.find((o) => o.n === 'extractor.*.path-extended')!;
    expect(sitesForOption(option, miniCatalog.families)).toEqual([]);
  });
});

describe('matchesFilters', () => {
  test('site "*" matches only extractor.*. options', () => {
    const names = namesOf(baseState({ site: '*' }));
    expect(names.every((n) => n.startsWith('extractor.*.'))).toBe(true);
    expect(names.sort()).toEqual(
      miniCatalog.options
        .map((o) => o.n)
        .filter((n) => n.startsWith('extractor.*.'))
        .sort(),
    );
  });

  test("selecting a family member site also returns the family's [Family] options", () => {
    const names = namesOf(baseState({ site: 'atfbooru' }));
    expect(names).toContain('extractor.[Danbooru].external');
  });

  test("selecting a plain site matches only that site's options", () => {
    const names = namesOf(baseState({ site: 'ao3' }));
    expect(names).toEqual(['extractor.ao3.formats']);
  });

  test('section filter narrows to that section only', () => {
    const names = namesOf(baseState({ section: 'Extractor-specific Options' }));
    expect(names.sort()).toEqual(
      ['extractor.ao3.formats', 'extractor.[Danbooru].external', 'extractor.fanbox.fee-min'].sort(),
    );
  });

  test('kind filter narrows to matching first-type-ref buckets', () => {
    const names = namesOf(baseState({ kinds: new Set<BucketedKind>(['boolean']) }));
    expect(names.sort()).toEqual(
      [
        'extractor.*.path-extended',
        'extractor.[Danbooru].external',
        'extractor.*.parent-metadata',
        'extractor.*.parent',
      ].sort(),
    );
  });

  test('section + kind + site compose (AND, not OR)', () => {
    const state = baseState({
      section: 'Extractor-specific Options',
      site: 'atfbooru',
      kinds: new Set<BucketedKind>(['boolean']),
    });
    expect(namesOf(state)).toEqual(['extractor.[Danbooru].external']);

    const noMatch = baseState({
      section: 'Extractor-specific Options',
      site: 'atfbooru',
      kinds: new Set<BucketedKind>(['string']),
    });
    expect(namesOf(noMatch)).toEqual([]);
  });

  test('query filter matches against the search index (name, description, terms)', () => {
    const names = namesOf(baseState({ q: 'ASCII digits' }));
    expect(names).toEqual(['extractor.*.path-restrict']);
  });
});

describe('atfbooru -> [Danbooru] resolution against the real artifact', () => {
  test('families.Danbooru.members includes atfbooru', () => {
    expect(catalog.families.Danbooru?.members).toContain('atfbooru');
  });

  test('selecting atfbooru surfaces the [Danbooru] family options', () => {
    const state: CatalogFilterState = {
      q: '',
      section: '',
      site: 'atfbooru',
      kinds: new Set<BucketedKind>(),
      families: catalog.families,
    };
    const matches = catalog.options.filter((o) => matchesFilters(o, state));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((o) => o.fam === 'Danbooru')).toBe(true);
    expect(matches.map((o) => o.n)).toContain('extractor.[Danbooru].external');
  });
});

function site(k: string, name: string): CatalogSite {
  return { k, name, url: '', caps: [], auth: null, fam: null };
}

function option(n: string, opts: Partial<CatalogOption> = {}): CatalogOption {
  return { n, s: '', ln: 0, d: '', t: [], ...opts };
}

describe('buildSiteChoices', () => {
  test('leads with "All sites" and "Global (extractor.*)"', () => {
    const choices = buildSiteChoices([], []);
    expect(choices[0]).toEqual({ value: '', name: 'All sites' });
    expect(choices[1]).toEqual({ value: '*', name: 'Global (extractor.*)' });
  });

  test('sites are sorted by display name, with the key de-emphasized', () => {
    const choices = buildSiteChoices(
      [site('pix', 'Pixiv'), site('ao3', 'Archive of Our Own'), site('dan', 'Danbooru')],
      [],
    );
    expect(choices.slice(2)).toEqual([
      { value: 'ao3', name: 'Archive of Our Own', key: 'ao3' },
      { value: 'dan', name: 'Danbooru', key: 'dan' },
      { value: 'pix', name: 'Pixiv', key: 'pix' },
    ]);
  });

  test('the sort is case-insensitive', () => {
    const choices = buildSiteChoices(
      [site('z', 'zebra'), site('a', 'Apple'), site('m', 'mango')],
      [],
    );
    expect(choices.slice(2).map((c) => c.value)).toEqual(['a', 'm', 'z']);
  });

  test('leading punctuation in a display name is ignored for sorting', () => {
    const choices = buildSiteChoices(
      [
        site('pixiv', '[pixiv]'),
        site('vidyart2', '/v/idyart2'),
        site('2ch', '2ch'),
        site('35photo', '35PHOTO'),
      ],
      [],
    );
    expect(choices.slice(2).map((c) => c.value)).toEqual(['2ch', '35photo', 'pixiv', 'vidyart2']);
  });

  test('a site with no name falls back to its key, with no de-emphasized key shown', () => {
    const choices = buildSiteChoices([site('bareky', '')], []);
    expect(choices.slice(2)).toEqual([{ value: 'bareky', name: 'bareky' }]);
  });

  test('falls back to bare option-derived keys when `sites` is empty', () => {
    const choices = buildSiteChoices(
      [],
      [
        option('extractor.pixiv.formats', { site: 'pixiv' }),
        option('extractor.pixiv.tags', { site: 'pixiv' }),
        option('extractor.ao3.formats', { site: 'ao3' }),
        option('extractor.*.path', {}),
      ],
    );
    expect(choices.slice(2)).toEqual([
      { value: 'ao3', name: 'ao3' },
      { value: 'pixiv', name: 'pixiv' },
    ]);
  });
});

describe('filterSiteChoices', () => {
  const choices = buildSiteChoices([site('pixiv', 'Pixiv'), site('ao3', 'Archive of Our Own')], []);

  test('an empty/whitespace query returns the list unchanged', () => {
    expect(filterSiteChoices(choices, '')).toEqual(choices);
    expect(filterSiteChoices(choices, '   ')).toEqual(choices);
  });

  test('matches by name, case-insensitively', () => {
    const result = filterSiteChoices(choices, 'PIX');
    expect(result.map((c) => c.value)).toEqual(['pixiv']);
  });

  test('matches by key, case-insensitively', () => {
    const result = filterSiteChoices(choices, 'AO3');
    expect(result.map((c) => c.value)).toEqual(['ao3']);
  });

  test('the static entries match on their own label text', () => {
    const result = filterSiteChoices(choices, 'global');
    expect(result.map((c) => c.value)).toEqual(['*']);
  });

  test('no match yields an empty array', () => {
    expect(filterSiteChoices(choices, 'nonexistent-site')).toEqual([]);
  });
});
