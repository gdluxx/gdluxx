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
} from '$lib/server/extensionSubBackupManager';
import { parseJson } from '$lib/server/validation/zod';
import { MAX_RULES_PER_PROFILE, subProfileSchema } from '$lib/server/validation/extensionProfiles';

const ruleInputSchema = z.object({
  id: z.string().min(1).optional(),
  pattern: z.string(),
  replacement: z.string(),
  flags: z.string(),
  enabled: z.boolean(),
});

const updateSchema = z.object({
  applyToPreview: z.boolean(),
  name: z.string().max(200).optional(),
  rules: z.array(ruleInputSchema).max(MAX_RULES_PER_PROFILE),
});

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

export const PUT: RequestHandler = async ({ request, params, locals }) => {
  try {
    const { apiKeyId, profileId } = params;
    if (!apiKeyId || !profileId) {
      return createApiError('apiKeyId and profileId are required', 400);
    }

    const parseResult = await parseJson(request, updateSchema);
    if ('errorResponse' in parseResult) {
      return parseResult.errorResponse;
    }
    const input = parseResult.data;

    const existing = getSubBackup(apiKeyId);
    if (!existing?.bundle.profiles[profileId]) {
      return createApiError('Substitution profile not found', 404);
    }

    const current = existing.bundle.profiles[profileId];
    const updated: SavedSubProfile = {
      ...current,
      rules: normaliseRules(input.rules),
      applyToPreview: input.applyToPreview,
      name: input.name?.trim() || undefined,
      updatedAt: Date.now(),
    };

    const validation = subProfileSchema.safeParse(updated);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid profile';
      return createApiError(message, 400);
    }

    existing.bundle.profiles[profileId] = updated;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveSubBackup(apiKeyId, existing.bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to save substitution profile', 500);
    }

    logger.info(`Updated substitution profile ${profileId} for API key ${apiKeyId}`);
    return createApiResponse({ profile: updated });
  } catch (error) {
    logger.error('Error updating substitution profile:', error);
    return handleApiError(new Error('Failed to update substitution profile'));
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const { apiKeyId, profileId } = params;
    if (!apiKeyId || !profileId) {
      return createApiError('apiKeyId and profileId are required', 400);
    }

    const existing = getSubBackup(apiKeyId);
    if (!existing?.bundle.profiles[profileId]) {
      return createApiResponse({ deleted: false });
    }

    const nextProfiles = { ...existing.bundle.profiles };
    Reflect.deleteProperty(nextProfiles, profileId);
    existing.bundle.profiles = nextProfiles;

    const syncedBy = locals.user?.email ?? locals.user?.name ?? null;
    const saved = saveSubBackup(apiKeyId, existing.bundle, syncedBy);
    if (!saved) {
      return createApiError('Failed to delete substitution profile', 500);
    }

    logger.info(`Deleted substitution profile ${profileId} for API key ${apiKeyId}`);
    return createApiResponse({ deleted: true });
  } catch (error) {
    logger.error('Error deleting substitution profile:', error);
    return handleApiError(new Error('Failed to delete substitution profile'));
  }
};
