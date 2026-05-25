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
export const MAX_RULES_PER_PROFILE = 20;

const ALLOWED_FLAG_CHARS = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);

const profileScopeSchema = z.enum(['host', 'origin', 'path']);

const syncedBySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(200))
  .optional();

function checkBundleCaps<T extends { host: string }>(
  profiles: Record<string, T>,
  ctx: z.RefinementCtx,
): void {
  const entries = Object.values(profiles);
  if (entries.length > MAX_TOTAL_PROFILES) {
    ctx.addIssue({
      code: 'custom',
      message: `Bundle exceeds maximum of ${MAX_TOTAL_PROFILES} profiles (${entries.length}).`,
      path: ['profiles'],
    });
  }

  const perHost = new Map<string, number>();
  for (const profile of entries) {
    const next = (perHost.get(profile.host) ?? 0) + 1;
    perHost.set(profile.host, next);
  }
  for (const [host, count] of perHost.entries()) {
    if (count > MAX_PROFILES_PER_HOST) {
      ctx.addIssue({
        code: 'custom',
        message: `Host "${host}" has ${count} profiles; max allowed is ${MAX_PROFILES_PER_HOST}.`,
        path: ['profiles'],
      });
    }
  }
}

/* ----- Selector profiles ----- */

const selectorProfileBaseSchema = z.object({
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
    checkBundleCaps(bundle.profiles, ctx);
  });

export const selectorBundleUpsertSchema = z.object({
  bundle: selectorBundleSchema,
  syncedBy: syncedBySchema,
});

export type SelectorBundleUpsertPayload = z.infer<typeof selectorBundleUpsertSchema>;

/* ----- Substitution profiles ----- */

const subRuleBaseSchema = z.object({
  id: z.string().min(1, 'Rule id is required'),
  pattern: z.string(),
  replacement: z.string(),
  flags: z.string(),
  enabled: z.boolean(),
  order: z.number().int().nonnegative(),
});

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

const subProfileBaseSchema = z.object({
  id: z.string().min(1, 'Profile id is required'),
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  path: z.string().optional(),
  origin: z.string().optional(),
  rules: z.array(subRuleSchema).max(MAX_RULES_PER_PROFILE),
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
    checkBundleCaps(bundle.profiles, ctx);
  });

export const subBundleUpsertSchema = z.object({
  bundle: subBundleSchema,
  syncedBy: syncedBySchema,
});

export type SubBundleUpsertPayload = z.infer<typeof subBundleUpsertSchema>;

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

const extractionProfileBaseSchema = z.object({
  id: z.string().min(1, 'Profile id is required'),
  name: z.string().max(200).optional(),
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  origin: z.string().optional(),
  path: z.string().optional(),
  extraction: extractionConfigSchema,
  rules: z.array(subRuleSchema).max(MAX_RULES_PER_PROFILE),
  applyToPreview: z.boolean(),
  autoApply: z.boolean(),
  gallery: galleryDisplayConfigSchema.optional(),
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
    profile.gallery !== undefined;

  if (!hasContent) {
    ctx.addIssue({
      code: 'custom',
      message:
        'Profile must have at least one of: non-empty range selector, targeted config, a rule with non-empty pattern, or a gallery override.',
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

export const extractionBundleSchema = z
  .object({
    version: z.number().int().nonnegative(),
    profiles: z.record(z.string(), extractionProfileSchema),
  })
  .superRefine((bundle, ctx) => {
    checkBundleCaps(bundle.profiles, ctx);
  });

export const extractionBundleUpsertSchema = z.object({
  bundle: extractionBundleSchema,
  syncedBy: syncedBySchema,
});

export type ExtractionBundleUpsertPayload = z.infer<typeof extractionBundleUpsertSchema>;

export const COMBINED_BUNDLE_KIND = 'gdluxx.extension-profiles.bundle';
export const COMBINED_BUNDLE_VERSION = 1;

export const combinedBundleSchema = z
  .object({
    kind: z.string(),
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
  });

export type CombinedBundle = z.infer<typeof combinedBundleSchema>;
