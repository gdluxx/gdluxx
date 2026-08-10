/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { z } from 'zod';
import type {
  SavedSelectorProfile,
  SelectorProfileBundle,
} from '$lib/server/extensionProfileBackupManager';
import type {
  SavedSubProfile,
  SavedSubRule,
  SubProfileBundle,
} from '$lib/server/extensionSubBackupManager';

export const MAX_TOTAL_PROFILES = 10_000;
export const MAX_PROFILES_PER_HOST = 50;
export const MAX_RULES_PER_EXTRACTION_PROFILE = 500;
export const MAX_RULES_PER_SUB_PROFILE = 50;
export const SUPPORTED_BUNDLE_VERSION = 1;
export const MAX_BUNDLE_JSON_BYTES = 5 * 1024 * 1024;

const ALLOWED_FLAG_CHARS = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);

const profileScopeSchema = z.enum(['host', 'origin', 'path']);

const syncedBySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(200))
  .optional();

export interface CapViolation {
  message: string;
  path: PropertyKey[];
}

function readProfileHost(profile: unknown): string {
  if (profile !== null && typeof profile === 'object') {
    const host = (profile as { host?: unknown }).host;
    if (typeof host === 'string') {
      return host;
    }
  }
  return '';
}

function bundleSizeViolation(bundle: unknown): CapViolation | null {
  let serializedLength: number;
  try {
    serializedLength = JSON.stringify(bundle)?.length ?? 0;
  } catch {
    return { message: 'Bundle payload could not be serialized.', path: [] };
  }

  if (serializedLength > MAX_BUNDLE_JSON_BYTES) {
    return {
      message: `Bundle payload is ${serializedLength} bytes; max allowed is ${MAX_BUNDLE_JSON_BYTES} bytes.`,
      path: [],
    };
  }
  return null;
}

function profileCountViolations(profiles: Record<string, unknown>): CapViolation[] {
  const violations: CapViolation[] = [];
  const entries = Object.values(profiles);
  if (entries.length > MAX_TOTAL_PROFILES) {
    violations.push({
      message: `Bundle exceeds maximum of ${MAX_TOTAL_PROFILES} profiles (${entries.length}).`,
      path: ['profiles'],
    });
  }

  const perHost = new Map<string, number>();
  for (const profile of entries) {
    const host = readProfileHost(profile);
    perHost.set(host, (perHost.get(host) ?? 0) + 1);
  }
  for (const [host, count] of perHost.entries()) {
    if (count > MAX_PROFILES_PER_HOST) {
      violations.push({
        message: `Host "${host}" has ${count} profiles; max allowed is ${MAX_PROFILES_PER_HOST}.`,
        path: ['profiles'],
      });
    }
  }
  return violations;
}

export function collectBundleCapViolations(bundle: {
  profiles: Record<string, unknown>;
}): CapViolation[] {
  const size = bundleSizeViolation(bundle);
  const counts = profileCountViolations(bundle.profiles);
  return size ? [size, ...counts] : counts;
}

function checkBundleCaps(
  bundle: { profiles: Record<string, unknown> },
  ctx: z.RefinementCtx,
): void {
  for (const violation of collectBundleCapViolations(bundle)) {
    ctx.addIssue({
      code: 'custom',
      message: violation.message,
      path: violation.path,
    });
  }
}

/* ----- Selector profiles ----- */

const selectorProfileBaseSchema = z.looseObject({
  id: z.string().min(1, 'Profile id is required'),
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  path: z.string().optional(),
  origin: z.string().optional(),
  startSelector: z.string(),
  endSelector: z.string(),
  name: z.string().max(200).optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  lastUsed: z.number().int().optional(),
});

export const selectorProfileSchema: z.ZodType<SavedSelectorProfile> =
  selectorProfileBaseSchema.superRefine((profile, ctx) => {
    if (!profile.startSelector.trim() && !profile.endSelector.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one of startSelector or endSelector must be non-empty.',
        path: ['startSelector'],
      });
    }
    if (profile.scope === 'path' && !profile.path) {
      ctx.addIssue({
        code: 'custom',
        message: 'Path is required when scope is "path".',
        path: ['path'],
      });
    }
    if (profile.scope === 'origin' && !profile.origin) {
      ctx.addIssue({
        code: 'custom',
        message: 'Origin is required when scope is "origin".',
        path: ['origin'],
      });
    }
  });

export const selectorBundleSchema: z.ZodType<SelectorProfileBundle> = z
  .object({
    version: z.number().int().nonnegative(),
    profiles: z.record(z.string(), selectorProfileSchema),
  })
  .superRefine((bundle, ctx) => {
    checkBundleCaps(bundle, ctx);
  });

/* ----- Substitution profiles ----- */

const subRuleBaseSchema = z.looseObject({
  id: z.string().min(1, 'Rule id is required'),
  pattern: z.string(),
  replacement: z.string(),
  flags: z.string(),
  enabled: z.boolean(),
  order: z.number().int().nonnegative(),
});

export const subRuleInputSchema = z.object({
  id: z.string().min(1).optional(),
  pattern: z.string(),
  replacement: z.string(),
  flags: z.string(),
  enabled: z.boolean(),
});

export type SubRuleInput = z.infer<typeof subRuleInputSchema>;

function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normaliseRuleInputs(input: SubRuleInput[]): SavedSubRule[] {
  return input.map((rule, index) => ({
    id: rule.id?.trim() || generateRuleId(),
    pattern: rule.pattern,
    replacement: rule.replacement,
    flags: rule.flags,
    enabled: rule.enabled,
    order: index,
  }));
}

export const subRuleSchema: z.ZodType<SavedSubRule> = subRuleBaseSchema.superRefine((rule, ctx) => {
  for (const ch of rule.flags) {
    if (!ALLOWED_FLAG_CHARS.has(ch)) {
      ctx.addIssue({
        code: 'custom',
        message: `Flag "${ch}" is not a recognized regex flag.`,
        path: ['flags'],
      });
      return;
    }
  }
  if (new Set(rule.flags).size !== rule.flags.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Regex flags must be unique.',
      path: ['flags'],
    });
    return;
  }
  if (rule.pattern.length === 0) {
    return;
  }
  try {
    new RegExp(rule.pattern, rule.flags);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid regex';
    ctx.addIssue({
      code: 'custom',
      message: `Pattern is not a valid regex: ${message}`,
      path: ['pattern'],
    });
  }
});

// `looseObject` for the same reason as `selectorProfileBaseSchema`
const subProfileBaseSchema = z.looseObject({
  id: z.string().min(1, 'Profile id is required'),
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  path: z.string().optional(),
  origin: z.string().optional(),
  rules: z.array(subRuleSchema).max(MAX_RULES_PER_SUB_PROFILE),
  name: z.string().max(200).optional(),
  applyToPreview: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  lastUsed: z.number().int().optional(),
});

export const subProfileSchema: z.ZodType<SavedSubProfile> = subProfileBaseSchema.superRefine(
  (profile, ctx) => {
    const effective = profile.rules.filter((rule) => rule.pattern.trim().length > 0);
    if (effective.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Profile must contain at least one rule with a non-empty pattern.',
        path: ['rules'],
      });
    }
    if (profile.scope === 'path' && !profile.path) {
      ctx.addIssue({
        code: 'custom',
        message: 'Path is required when scope is "path".',
        path: ['path'],
      });
    }
    if (profile.scope === 'origin' && !profile.origin) {
      ctx.addIssue({
        code: 'custom',
        message: 'Origin is required when scope is "origin".',
        path: ['origin'],
      });
    }
  },
);

export const subBundleSchema: z.ZodType<SubProfileBundle> = z
  .object({
    version: z.number().int().nonnegative(),
    profiles: z.record(z.string(), subProfileSchema),
  })
  .superRefine((bundle, ctx) => {
    checkBundleCaps(bundle, ctx);
  });

/* ----- Extraction profiles ----- */

const galleryDisplayConfigSchema = z.object({
  thumbSizes: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
  gap: z.number().int().nonnegative(),
  border: z.number().int().nonnegative(),
  buttonCorner: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
});

const containerSourceSchema = z.discriminatedUnion('via', [
  z.object({ via: z.literal('body') }),
  z.object({
    via: z.literal('selector'),
    selector: z.string().refine((s) => s.trim().length > 0, 'Container selector must be non-empty'),
  }),
  z.object({
    via: z.literal('string'),
    begin: z.string().min(1, 'Container begin marker must be non-empty'),
    end: z.string().min(1, 'Container end marker must be non-empty'),
  }),
]);

const imageSourceSchema = z.discriminatedUnion('via', [
  z.object({
    via: z.literal('selector'),
    selector: z.string().refine((s) => s.trim().length > 0, 'Image selector must be non-empty'),
    attr: z.string().default('src'),
  }),
  z.object({
    via: z.literal('string'),
    begin: z.string().min(1, 'Image begin marker must be non-empty'),
    end: z.string().min(1, 'Image end marker must be non-empty'),
  }),
]);

const directorySourceSchema = z.discriminatedUnion('via', [
  z.object({
    via: z.literal('selector'),
    selector: z.string().refine((s) => s.trim().length > 0, 'Directory selector must be non-empty'),
    attr: z.string().optional(),
    transform: z
      .object({
        pattern: z.string().min(1, 'Transform pattern must be non-empty'),
        replacement: z.string(),
        flags: z.string().max(10).optional(),
      })
      .optional(),
  }),
]);

export const extractionConfigSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('range'),
    startSelector: z.string(),
    endSelector: z.string(),
  }),
  z.object({
    mode: z.literal('targeted'),
    container: containerSourceSchema,
    images: imageSourceSchema,
  }),
]);

const extractionProfileBaseSchema = z.looseObject({
  id: z.string().min(1, 'Profile id is required'),
  name: z.string().max(200).optional(),
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  origin: z.string().optional(),
  path: z.string().optional(),
  extraction: extractionConfigSchema,
  rules: z.array(subRuleSchema).max(MAX_RULES_PER_EXTRACTION_PROFILE),
  applyToPreview: z.boolean(),
  autoApply: z.boolean(),
  gallery: galleryDisplayConfigSchema.optional(),
  directorySource: directorySourceSchema.optional().nullable(),
  accumulate: z.boolean().optional().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  lastUsed: z.number().int().optional(),
});

export const extractionProfileSchema = extractionProfileBaseSchema.superRefine((profile, ctx) => {
  const hasContent =
    (profile.extraction.mode === 'range' &&
      (profile.extraction.startSelector.trim().length > 0 ||
        profile.extraction.endSelector.trim().length > 0)) ||
    profile.extraction.mode === 'targeted' ||
    profile.rules.some((r) => r.pattern.trim().length > 0) ||
    profile.gallery !== undefined ||
    profile.directorySource != null;

  if (!hasContent) {
    ctx.addIssue({
      code: 'custom',
      message:
        'Profile must have at least one of: non-empty range selector, targeted config, a rule with non-empty pattern, a gallery override, or a directory source.',
      path: ['extraction'],
    });
  }
  if (profile.scope === 'path' && !profile.path) {
    ctx.addIssue({
      code: 'custom',
      message: 'Path is required when scope is "path".',
      path: ['path'],
    });
  }
  if (profile.scope === 'origin' && !profile.origin) {
    ctx.addIssue({
      code: 'custom',
      message: 'Origin is required when scope is "origin".',
      path: ['origin'],
    });
  }
});

export const extractionProfileCreateSchema = z.object({
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  origin: z.string().optional(),
  path: z.string().optional(),
  name: z.string().max(200).optional(),
  extraction: extractionConfigSchema,
  rules: z.array(subRuleInputSchema).max(MAX_RULES_PER_EXTRACTION_PROFILE),
  applyToPreview: z.boolean().default(false),
  autoApply: z.boolean().default(true),
  gallery: galleryDisplayConfigSchema.optional(),
  directorySource: directorySourceSchema.optional(),
  accumulate: z.boolean().optional(),
});

export type ExtractionProfileCreateInput = z.infer<typeof extractionProfileCreateSchema>;

export const extractionProfileUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  extraction: extractionConfigSchema,
  rules: z.array(subRuleInputSchema).max(MAX_RULES_PER_EXTRACTION_PROFILE),
  applyToPreview: z.boolean(),
  autoApply: z.boolean(),
  gallery: galleryDisplayConfigSchema.optional(),
  directorySource: directorySourceSchema.optional(),
  accumulate: z.boolean().optional(),
});

export type ExtractionProfileUpdateInput = z.infer<typeof extractionProfileUpdateSchema>;

export const extractionBundleSchema = z
  .object({
    version: z.number().int().nonnegative(),
    profiles: z.record(z.string(), extractionProfileSchema),
  })
  .superRefine((bundle, ctx) => {
    checkBundleCaps(bundle, ctx);
  });

export const COMBINED_BUNDLE_KIND = 'gdluxx.extension-profiles.bundle';
export const COMBINED_BUNDLE_VERSION = 1;

export const PARTIAL_CONVERSION_MESSAGE =
  'This file looks like a partially converted extension export. Profiles must be nested under "extraction".';

export const combinedBundleSchema = z
  .looseObject({
    kind: z.string({ error: 'File is not a gdluxx extension profile bundle.' }),
    version: z.number(),
    exportedAt: z.number().int().optional(),
    apiKeyName: z.string().max(200).optional(),
    selectors: selectorBundleSchema.optional().default({ version: 1, profiles: {} }),
    subs: subBundleSchema.optional().default({ version: 1, profiles: {} }),
    extraction: extractionBundleSchema.optional().default({ version: 1, profiles: {} }),
  })
  .superRefine((val, ctx) => {
    if (val.kind !== COMBINED_BUNDLE_KIND) {
      ctx.addIssue({
        code: 'custom',
        message: 'File is not a gdluxx extension profile bundle.',
        path: ['kind'],
      });
    }
    if (val.version !== COMBINED_BUNDLE_VERSION) {
      ctx.addIssue({
        code: 'custom',
        message: `Unsupported bundle version. Expected ${COMBINED_BUNDLE_VERSION}.`,
        path: ['version'],
      });
    }

    if ('profiles' in val) {
      ctx.addIssue({
        code: 'custom',
        message: PARTIAL_CONVERSION_MESSAGE,
        path: ['profiles'],
      });
    }
  });

export type CombinedBundle = z.infer<typeof combinedBundleSchema>;

export function normaliseCombinedBundle(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const obj = raw as Record<string, unknown>;
  if ('kind' in obj) {
    return obj;
  }

  if (obj.profiles && typeof obj.profiles === 'object' && !Array.isArray(obj.profiles)) {
    const { profiles, version, ...rest } = obj;
    const subVersion =
      typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : 1;
    return {
      ...rest,
      kind: COMBINED_BUNDLE_KIND,
      version: COMBINED_BUNDLE_VERSION,
      extraction: { version: subVersion, profiles },
    };
  }

  return raw;
}

export const importableCombinedBundleSchema: z.ZodType<CombinedBundle> = z.preprocess(
  normaliseCombinedBundle,
  combinedBundleSchema,
);

/* Tolerant backup validation, extension sync PUTs */

const profileSpineSchema = z
  .looseObject({
    id: z.string().min(1, 'Profile id is required'),
    scope: profileScopeSchema,
    host: z.string().min(1, 'Host is required'),
    path: z.string().optional(),
    origin: z.string().optional(),
  })
  .superRefine((profile, ctx) => {
    if (profile.scope === 'path' && !profile.path) {
      ctx.addIssue({
        code: 'custom',
        message: 'Path is required when scope is "path".',
        path: ['path'],
      });
    }
    if (profile.scope === 'origin' && !profile.origin) {
      ctx.addIssue({
        code: 'custom',
        message: 'Origin is required when scope is "origin".',
        path: ['origin'],
      });
    }
  });

const bundleUpsertEnvelopeSchema = z.looseObject({
  bundle: z.looseObject({
    version: z.number().int().nonnegative(),
    profiles: z.record(z.string(), z.unknown()),
  }),
  syncedBy: syncedBySchema,
});

/** Cap on how many per profile notes are echoed back, always exact counts */
const MAX_REPORTED_PROFILES = 20;

export interface ProfileValidationNote {
  id: string;
  reason: string;
}

export interface BundleToleranceReport {
  skipped: { count: number; profiles: ProfileValidationNote[] };
  tolerated: { count: number; profiles: ProfileValidationNote[] };
}

export interface TolerantBundleUpsert {
  bundle: Record<string, unknown> & { version: number; profiles: Record<string, unknown> };
  syncedBy: string | null;
  report: BundleToleranceReport;
}

export type TolerantBundleUpsertResult =
  | { ok: true; value: TolerantBundleUpsert }
  | { ok: false; message: string };

function describeIssues(error: z.ZodError, limit: number): string {
  const shown = error.issues
    .slice(0, limit)
    .map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`);
  const remaining = error.issues.length - shown.length;
  return remaining > 0 ? `${shown.join('; ')} (+${remaining} more)` : shown.join('; ');
}

export function parseTolerantBundleUpsert(
  payload: unknown,
  fullProfileSchema: z.ZodType,
): TolerantBundleUpsertResult {
  const envelope = bundleUpsertEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    return { ok: false, message: describeIssues(envelope.error, 5) };
  }

  const rawBundle = (payload as { bundle: Record<string, unknown> }).bundle;
  const rawProfiles = rawBundle.profiles as Record<string, unknown>;

  const sizeViolation = bundleSizeViolation(rawBundle);
  if (sizeViolation) {
    return { ok: false, message: sizeViolation.message };
  }

  const profiles: Record<string, unknown> = {};
  const report: BundleToleranceReport = {
    skipped: { count: 0, profiles: [] },
    tolerated: { count: 0, profiles: [] },
  };

  const note = (
    bucket: { count: number; profiles: ProfileValidationNote[] },
    id: string,
    reason: string,
  ) => {
    bucket.count += 1;
    if (bucket.profiles.length < MAX_REPORTED_PROFILES) {
      bucket.profiles.push({ id, reason });
    }
  };

  for (const [key, value] of Object.entries(rawProfiles)) {
    if (key === '__proto__') {
      note(report.skipped, key, 'Unsupported profile key.');
      continue;
    }

    const spine = profileSpineSchema.safeParse(value);
    if (!spine.success) {
      note(report.skipped, key, describeIssues(spine.error, 3));
      continue;
    }

    const full = fullProfileSchema.safeParse(value);
    if (!full.success) {
      note(report.tolerated, key, describeIssues(full.error, 3));
    }

    profiles[key] = value;
  }

  const countViolations = profileCountViolations(profiles);
  if (countViolations.length > 0) {
    return { ok: false, message: countViolations.map((v) => v.message).join('\n') };
  }

  return {
    ok: true,
    value: {
      bundle: { ...rawBundle, version: envelope.data.bundle.version, profiles },
      syncedBy: envelope.data.syncedBy ?? null,
      report,
    },
  };
}
