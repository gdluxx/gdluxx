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
 * Plain, client safe type definitions for the generated gallery-dl options catalog
 * `src/lib/assets/gallery-dl-catalog.json`
 */

export type CatalogKind =
  | 'boolean'
  | 'integer'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
  | 'any'
  | 'custom';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonValueObject;

export interface JsonValueObject {
  [key: string]: JsonValue;
}

export interface CatalogTypeRef {
  k: CatalogKind;
  x: string;
}

export interface CatalogTerm {
  t: string;
  d: string;
}

export interface CatalogDefaultRow {
  v: string;
  pv: JsonValue | null;
  sites: string[];
}

export interface CatalogDefaultParsed {
  p: true;
  v: JsonValue;
}

export interface CatalogDefaultProse {
  p: false;
  x: string;
  m?: CatalogDefaultRow[];
}

export type CatalogDefault = CatalogDefaultParsed | CatalogDefaultProse;

export interface CatalogOption {
  n: string;
  s: string;
  ln: number;
  d: string;
  dterms?: CatalogTerm[];
  t: CatalogTypeRef[];
  def?: CatalogDefault;
  vals?: Record<string, CatalogTerm[]>;
  ex?: string[];
  note?: string;
  nterms?: CatalogTerm[];
  names?: string[];
  site?: string;
  fam?: string;
}

export interface CatalogSection {
  id: string;
  label: string;
  count: number;
}

export interface CatalogProvenance {
  galleryDlVersion: string;
  sourceRef: string;
  sourceUrl: string;
  sourceSha256: string;
  sitesSha256: string | null;
  generatedAt: string;
  generatorVersion: number;
  optionCount: number;
  siteCount: number;
}

export interface CatalogFamily {
  label: string;
  members: string[];
  optionPrefix: string;
}

export interface CatalogSite {
  k: string;
  name: string;
  url: string;
  caps: string[];
  auth: string | null;
  fam: string | null;
}

export interface CatalogArtifact {
  format: 'gdluxx-gallery-dl-catalog';
  schemaVersion: 1;
  provenance: CatalogProvenance;
  sections: CatalogSection[];
  options: CatalogOption[];
  customTypes: Record<string, string>;
  families: Record<string, CatalogFamily>;
  sites: CatalogSite[];
}
