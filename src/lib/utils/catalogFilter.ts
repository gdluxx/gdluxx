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
 * Filtering/search helpers for the gallery-dl options catalog
 * `src/routes/config/catalog`
 */

import type { CatalogFamily, CatalogKind, CatalogOption, CatalogSite } from '$lib/types/catalog';

export type BucketedKind = 'boolean' | 'string' | 'number' | 'array' | 'object' | 'custom';

export const KIND_ORDER: readonly BucketedKind[] = [
  'boolean',
  'string',
  'number',
  'array',
  'object',
  'custom',
];

export const KIND_LABELS: Record<BucketedKind, string> = {
  boolean: 'boolean',
  string: 'string',
  number: 'number',
  array: 'list',
  object: 'object',
  custom: 'custom',
};

export function bucketKind(kind: CatalogKind): BucketedKind {
  switch (kind) {
    case 'integer':
    case 'number':
      return 'number';
    case 'any':
      return 'custom';
    case 'boolean':
    case 'string':
    case 'array':
    case 'object':
    case 'custom':
      return kind;
    default:
      return 'custom';
  }
}

export function optionKind(option: CatalogOption): BucketedKind {
  return option.t.length > 0 ? bucketKind(option.t[0].k) : 'custom';
}

export function kindSwatchClasses(kind: BucketedKind): string {
  switch (kind) {
    case 'boolean':
      return 'bg-info';
    case 'string':
      return 'bg-success';
    case 'number':
      return 'bg-primary';
    case 'array':
      return 'bg-warning';
    case 'object':
      return 'bg-error';
    case 'custom':
      return 'bg-muted-foreground';
  }
}

export function kindBadgeClasses(kind: BucketedKind): string {
  switch (kind) {
    case 'boolean':
      return 'bg-info/15 text-info';
    case 'string':
      return 'bg-success/15 text-success';
    case 'number':
      return 'bg-primary/15 text-primary';
    case 'array':
      return 'bg-warning/15 text-warning';
    case 'object':
      return 'border border-error/60 text-error';
    case 'custom':
      return 'border border-strong text-muted-foreground';
  }
}

export function buildSearchIndex(option: CatalogOption): string {
  const parts: string[] = [option.n];

  if (option.names) {
    parts.push(...option.names);
  }

  parts.push(option.d);

  if (option.dterms) {
    for (const term of option.dterms) {
      parts.push(term.t, term.d);
    }
  }

  if (option.vals) {
    for (const terms of Object.values(option.vals)) {
      for (const term of terms) {
        parts.push(term.t, term.d);
      }
    }
  }

  return parts.join(' ').toLowerCase();
}

export function sitesForOption(
  option: CatalogOption,
  families: Record<string, CatalogFamily>,
): string[] {
  if (option.site) {
    return [option.site];
  }
  if (option.fam) {
    return families[option.fam]?.members ?? [];
  }
  return [];
}

export interface CatalogFilterState {
  q: string;
  section: string;
  site: string;
  kinds: ReadonlySet<BucketedKind>;
  families: Record<string, CatalogFamily>;
}

export function matchesFilters(option: CatalogOption, state: CatalogFilterState): boolean {
  if (state.section && option.s !== state.section) {
    return false;
  }

  if (state.site === '*') {
    if (!option.n.startsWith('extractor.*.')) {
      return false;
    }
  } else if (state.site) {
    if (!sitesForOption(option, state.families).includes(state.site)) {
      return false;
    }
  }

  if (state.kinds.size > 0 && !state.kinds.has(optionKind(option))) {
    return false;
  }

  const q = state.q.trim().toLowerCase();
  if (q && !buildSearchIndex(option).includes(q)) {
    return false;
  }

  return true;
}

export interface SiteChoice {
  value: string;
  name: string;
  key?: string;
}

function compareSiteNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'accent', ignorePunctuation: true });
}

export function buildSiteChoices(sites: CatalogSite[], options: CatalogOption[]): SiteChoice[] {
  const staticChoices: SiteChoice[] = [
    { value: '', name: 'All sites' },
    { value: '*', name: 'Global (extractor.*)' },
  ];

  if (sites.length > 0) {
    const siteEntries = sites
      .map((site) => ({
        value: site.k,
        name: site.name || site.k,
        key: site.name ? site.k : undefined,
      }))
      .sort((a, b) => compareSiteNames(a.name, b.name));
    return [...staticChoices, ...siteEntries];
  }

  const uniqueSites: string[] = [];
  for (const option of options) {
    if (option.site && !uniqueSites.includes(option.site)) {
      uniqueSites.push(option.site);
    }
  }
  const siteEntries = uniqueSites.sort(compareSiteNames).map((k) => ({ value: k, name: k }));
  return [...staticChoices, ...siteEntries];
}

export function filterSiteChoices(choices: SiteChoice[], query: string): SiteChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return choices;
  }
  return choices.filter(
    (choice) =>
      choice.name.toLowerCase().includes(q) || (choice.key?.toLowerCase().includes(q) ?? false),
  );
}
