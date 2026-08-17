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
import type { CatalogArtifact, CatalogOption } from '$lib/types/catalog';
import { buildSnippet } from '$lib/utils/catalogSnippet';

const miniCatalog = miniCatalogRaw as unknown as CatalogArtifact;

function findOption(name: string): CatalogOption {
  const option = miniCatalog.options.find((o) => o.n === name);
  if (!option) {
    throw new Error(`fixture is missing option "${name}"`);
  }
  return option;
}

describe('buildSnippet', () => {
  test('extractor.*.x collapses to extractor.x with the global note', () => {
    const snippet = buildSnippet(findOption('extractor.*.path-extended'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { 'path-extended': true } });
    expect(snippet.note).toBe(
      'Set under extractor to apply globally, or under extractor.<site> to override per site.',
    );
  });

  test('fam options keep the bracketed segment and get a family note', () => {
    const snippet = buildSnippet(findOption('extractor.[Danbooru].external'));
    expect(JSON.parse(snippet.json)).toEqual({
      extractor: { '[Danbooru]': { external: false } },
    });
    expect(snippet.note).toBe('Applies to the whole [Danbooru] family of extractors.');
  });

  test('a site option with a parsed default is used verbatim, no note', () => {
    const snippet = buildSnippet(findOption('extractor.ao3.formats'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { ao3: { formats: 'pdf' } } });
    expect(snippet.note).toBe('');
  });

  test('parsed default of "auto" is used verbatim', () => {
    const snippet = buildSnippet(findOption('extractor.*.path-restrict'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { 'path-restrict': 'auto' } });
  });

  test('kind fallback: boolean with no parsed default -> true', () => {
    const snippet = buildSnippet(findOption('extractor.*.parent'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { parent: true } });
  });

  test('kind fallback: integer/number with no default -> 0', () => {
    const snippet = buildSnippet(findOption('extractor.fanbox.fee-min'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { fanbox: { 'fee-min': 0 } } });
  });

  test('kind fallback: array with no default -> []', () => {
    const snippet = buildSnippet(findOption('extractor.*.directory'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { directory: [] } });
  });

  test('kind fallback: object with a prose-only default -> {}', () => {
    const snippet = buildSnippet(findOption('extractor.*.extension-map'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { 'extension-map': {} } });
  });

  test('kind fallback: custom kind with no default -> "…"', () => {
    const snippet = buildSnippet(findOption('extractor.*.filename'));
    expect(JSON.parse(snippet.json)).toEqual({ extractor: { filename: '…' } });
  });

  test('output is always valid, parseable JSON', () => {
    for (const option of miniCatalog.options) {
      const snippet = buildSnippet(option);
      expect(() => JSON.parse(snippet.json)).not.toThrow();
    }
  });
});
