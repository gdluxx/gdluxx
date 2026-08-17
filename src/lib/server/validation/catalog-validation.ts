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
 * Zod mirror of `src/lib/types/catalog.ts
 *
 * Test/CI use only: validates the generated artifact
 * (`src/lib/assets/gallery-dl-catalog.json`) via `pnpm catalog:verify`.
 * Never import by a route
 */

import { z } from 'zod';

export type CatalogJsonValue =
  | string
  | number
  | boolean
  | null
  | CatalogJsonValue[]
  | { [key: string]: CatalogJsonValue };

export const catalogJsonValueSchema: z.ZodType<CatalogJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(catalogJsonValueSchema),
    z.record(z.string(), catalogJsonValueSchema),
  ]),
);

export const catalogKindSchema = z.enum([
  'boolean',
  'integer',
  'number',
  'string',
  'array',
  'object',
  'any',
  'custom',
]);
export type CatalogKind = z.infer<typeof catalogKindSchema>;

export const catalogTypeRefSchema = z.strictObject({
  k: catalogKindSchema,
  x: z.string(),
});
export type CatalogTypeRef = z.infer<typeof catalogTypeRefSchema>;

export const catalogTermSchema = z.strictObject({
  t: z.string(),
  d: z.string(),
});
export type CatalogTerm = z.infer<typeof catalogTermSchema>;

export const catalogDefaultRowSchema = z.strictObject({
  v: z.string(),
  pv: catalogJsonValueSchema.nullable(),
  sites: z.array(z.string()),
});
export type CatalogDefaultRow = z.infer<typeof catalogDefaultRowSchema>;

export const catalogDefaultParsedSchema = z.strictObject({
  p: z.literal(true),
  v: catalogJsonValueSchema,
});

export const catalogDefaultProseSchema = z.strictObject({
  p: z.literal(false),
  x: z.string(),
  m: z.array(catalogDefaultRowSchema).optional(),
});

export const catalogDefaultSchema = z.discriminatedUnion('p', [
  catalogDefaultParsedSchema,
  catalogDefaultProseSchema,
]);
export type CatalogDefault = z.infer<typeof catalogDefaultSchema>;

export const catalogOptionSchema = z.strictObject({
  n: z.string(),
  s: z.string(),
  ln: z.number().int().positive(),
  d: z.string(),
  dterms: z.array(catalogTermSchema).optional(),
  t: z.array(catalogTypeRefSchema),
  def: catalogDefaultSchema.optional(),
  vals: z.record(z.string(), z.array(catalogTermSchema)).optional(),
  ex: z.array(z.string()).optional(),
  note: z.string().optional(),
  nterms: z.array(catalogTermSchema).optional(),
  names: z.array(z.string()).optional(),
  site: z.string().optional(),
  fam: z.string().optional(),
});
export type CatalogOption = z.infer<typeof catalogOptionSchema>;

export const catalogSectionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
});
export type CatalogSection = z.infer<typeof catalogSectionSchema>;

export const catalogProvenanceSchema = z.strictObject({
  galleryDlVersion: z.string(),
  sourceRef: z.string(),
  sourceUrl: z.string(),
  sourceSha256: z.string(),
  sitesSha256: z.string().nullable(),
  generatedAt: z.string(),
  generatorVersion: z.number().int(),
  optionCount: z.number().int().nonnegative(),
  siteCount: z.number().int().nonnegative(),
});
export type CatalogProvenance = z.infer<typeof catalogProvenanceSchema>;

export const catalogFamilySchema = z.strictObject({
  label: z.string(),
  members: z.array(z.string()),
  optionPrefix: z.string(),
});
export type CatalogFamily = z.infer<typeof catalogFamilySchema>;

export const catalogSiteSchema = z.strictObject({
  k: z.string(),
  name: z.string(),
  url: z.string(),
  caps: z.array(z.string()),
  auth: z.string().nullable(),
  fam: z.string().nullable(),
});
export type CatalogSite = z.infer<typeof catalogSiteSchema>;

export const catalogArtifactSchema = z.strictObject({
  format: z.literal('gdluxx-gallery-dl-catalog'),
  schemaVersion: z.literal(1),
  provenance: catalogProvenanceSchema,
  sections: z.array(catalogSectionSchema),
  options: z.array(catalogOptionSchema),
  customTypes: z.record(z.string(), z.string()),
  families: z.record(z.string(), catalogFamilySchema),
  sites: z.array(catalogSiteSchema),
});
export type CatalogArtifact = z.infer<typeof catalogArtifactSchema>;
