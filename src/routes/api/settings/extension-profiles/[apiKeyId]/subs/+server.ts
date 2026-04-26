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
import type { RequestHandler } from './$types';
import { serverLogger as logger } from '$lib/server/logger';
import { createApiError, createApiResponse, handleApiError } from '$lib/server/api-utils';
import {
  getSubBackup,
  saveSubBackup,
  type SavedSubProfile,
  type SavedSubRule,
  type SubProfileBundle,
} from '$lib/server/extensionSubBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import { MAX_RULES_PER_PROFILE, subProfileSchema } from '$lib/server/validation/extensionProfiles';
import {
  buildProfileId,
  normaliseHost,
  normaliseOrigin,
  normalisePath,
} from '$lib/extensionProfiles/profileId';

const profileScopeSchema = z.enum(['host', 'origin', 'path']);

const ruleInputSchema = z.object({
  id: z.string().min(1).optional(),
  pattern: z.string(),
  replacement: z.string(),
  flags: z.string(),
  enabled: z.boolean(),
});

const createSchema = z.object({
  scope: profileScopeSchema,
  host: z.string().min(1, 'Host is required'),
  path: z.string().optional(),
  origin: z.string().optional(),
  applyToPreview: z.boolean().default(false),
  name: z.string().max(200).optional(),
  rules: z.array(ruleInputSchema).max(MAX_RULES_PER_PROFILE),
});

function emptyBundle(): SubProfileBundle {
  return { version: 1, profiles: {} };
}

function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normaliseRules(input: Array<z.infer<typeof ruleInputSchema>>): SavedSubRule[] {
  return input.map((rule, index) => ({
    id: rule.id?.trim() || generateRuleId(),
    pattern: rule.pattern,
    replacement: rule.replacement,
    flags: rule.flags,
    enabled: rule.enabled,
    order: index,
  }));
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
  try {
    const apiKeyId = params.apiKeyId;
    if (!apiKeyId) {
      return createApiError('apiKeyId is required', 400);
    }

    const parseResult = await parseJson(request, createSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const host = normaliseHost(input.host);
    const origin = input.scope === 'host' ? undefined : normaliseOrigin(input.origin);
    const path = input.scope === 'path' ? (normalisePath(input.path) ?? '/') : undefined;
    const id = buildProfileId(input.scope, host, origin, path);

    const existing = getSubBackup(apiKeyId);
    const bundle = existing?.bundle ?? emptyBundle();

    if (bundle.profiles[id]) {
      return createApiError('A profile with this scope/host/path already exists.', 409);
    }

    const now = Date.now();
    const newProfile: SavedSubProfile = {
      id,
      scope: input.scope,
      host,
      origin,
      path,
      rules: normaliseRules(input.rules),
      name: input.name?.trim() || undefined,
      applyToPreview: input.applyToPreview,
      createdAt: now,
      updatedAt: now,
    };

    const validation = subProfileSchema.safeParse(newProfile);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid profile';
      return createApiError(message, 400);
    }

    bundle.profiles[id] = newProfile;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveSubBackup(apiKeyId, bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to save substitution profile', 500);
    }

    logger.info(`Created substitution profile ${id} for API key ${apiKeyId}`);
    return createApiResponse({ profile: newProfile });
  } catch (error) {
    logger.error('Error creating substitution profile:', error);
    return handleApiError(new Error('Failed to create substitution profile'));
  }
};
