/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import {
  getProfileBackup,
  saveProfileBackup,
  type SelectorProfileBundle,
} from '$lib/server/extensionProfileBackupManager';
import {
  getSubBackup,
  saveSubBackup,
  type SubProfileBundle,
} from '$lib/server/extensionSubBackupManager';
import {
  getExtractionBackup,
  saveExtractionBackup,
  type ExtractionBundle,
} from '$lib/server/extensionExtractionBackupManager';
import { withTransaction } from '$lib/server/dbTransaction';
import {
  collectBundleCapViolations,
  extractionBundleSchema,
  selectorBundleSchema,
  subBundleSchema,
  SUPPORTED_BUNDLE_VERSION,
  type CombinedBundle,
} from '$lib/server/validation/extensionProfiles';

export type ImportStage = 'selectors' | 'subs' | 'extraction';

export interface ImportCounts {
  added: number;
  updated: number;
  total: number;
}

export type ImportOutcome =
  | { ok: true; selectors: ImportCounts; subs: ImportCounts; extraction: ImportCounts }
  | { ok: false; reason: 'validation'; message: string }
  | { ok: false; reason: 'save'; stage: ImportStage };

class ImportSaveError extends Error {
  constructor(readonly stage: ImportStage) {
    super(`Failed to save ${stage} backup`);
    this.name = 'ImportSaveError';
  }
}

function futureVersionViolation(source: string, bundle: { version?: unknown }): string | null {
  const version = bundle.version;
  if (typeof version === 'number' && version > SUPPORTED_BUNDLE_VERSION) {
    return `${source} bundle is version ${version}; this server supports up to version ${SUPPORTED_BUNDLE_VERSION}.`;
  }
  return null;
}

/**
 * NOTE: cookie backups are intentionally not part of this bundle. If they are
 * ever added, `cookieBackupManager.ts` must be switched to `getSharedDatabase()`
 * as well, or its write will sit outside this transaction and not roll back.
 */
export function importExtensionProfileBundles(
  apiKeyId: string,
  imported: CombinedBundle,
  syncedBy: string | null,
): ImportOutcome {
  const existingSelectors = getProfileBackup(apiKeyId);
  const existingSubs = getSubBackup(apiKeyId);
  const existingExtraction = getExtractionBackup(apiKeyId);

  const existingSelectorBundle: SelectorProfileBundle = existingSelectors?.bundle ?? {
    version: 1,
    profiles: {},
  };
  const existingSubBundle: SubProfileBundle = existingSubs?.bundle ?? {
    version: 1,
    profiles: {},
  };
  const existingExtractionBundle: ExtractionBundle = (existingExtraction?.bundle as
    | ExtractionBundle
    | undefined) ?? {
    version: 1,
    profiles: {},
  };

  const versionViolations = [
    futureVersionViolation('Imported selector', imported.selectors),
    futureVersionViolation('Imported substitution', imported.subs),
    futureVersionViolation('Imported extraction', imported.extraction),
    futureVersionViolation('Stored selector', existingSelectorBundle),
    futureVersionViolation('Stored substitution', existingSubBundle),
    futureVersionViolation('Stored extraction', existingExtractionBundle),
  ].filter((message): message is string => message !== null);
  if (versionViolations.length > 0) {
    return { ok: false, reason: 'validation', message: versionViolations.join('\n') };
  }

  const selValidation = selectorBundleSchema.safeParse(imported.selectors);
  const subValidation = subBundleSchema.safeParse(imported.subs);
  const extValidation = extractionBundleSchema.safeParse(imported.extraction);
  if (!selValidation.success || !subValidation.success || !extValidation.success) {
    const issues = [
      ...(selValidation.success ? [] : selValidation.error.issues),
      ...(subValidation.success ? [] : subValidation.error.issues),
      ...(extValidation.success ? [] : extValidation.error.issues),
    ];
    const message = issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`).join('\n');
    return { ok: false, reason: 'validation', message };
  }

  const mergedSelectors: SelectorProfileBundle = {
    version: SUPPORTED_BUNDLE_VERSION,
    profiles: { ...existingSelectorBundle.profiles, ...selValidation.data.profiles },
  };
  const mergedSubs: SubProfileBundle = {
    version: SUPPORTED_BUNDLE_VERSION,
    profiles: { ...existingSubBundle.profiles, ...subValidation.data.profiles },
  };
  const mergedExtraction: ExtractionBundle = {
    version: SUPPORTED_BUNDLE_VERSION,
    profiles: { ...existingExtractionBundle.profiles, ...extValidation.data.profiles },
  };

  const capViolations = [
    ...collectBundleCapViolations(mergedSelectors),
    ...collectBundleCapViolations(mergedSubs),
    ...collectBundleCapViolations(mergedExtraction),
  ];
  if (capViolations.length > 0) {
    const message = capViolations.map((v) => v.message).join('\n');
    return { ok: false, reason: 'validation', message };
  }

  const existingSelIds = new Set(Object.keys(existingSelectorBundle.profiles));
  const existingSubIds = new Set(Object.keys(existingSubBundle.profiles));
  const existingExtIds = new Set(Object.keys(existingExtractionBundle.profiles));

  const selAdded = Object.keys(imported.selectors.profiles).filter(
    (id) => !existingSelIds.has(id),
  ).length;
  const selUpdated = Object.keys(imported.selectors.profiles).filter((id) =>
    existingSelIds.has(id),
  ).length;
  const subAdded = Object.keys(imported.subs.profiles).filter(
    (id) => !existingSubIds.has(id),
  ).length;
  const subUpdated = Object.keys(imported.subs.profiles).filter((id) =>
    existingSubIds.has(id),
  ).length;
  const extAdded = Object.keys(imported.extraction.profiles).filter(
    (id) => !existingExtIds.has(id),
  ).length;
  const extUpdated = Object.keys(imported.extraction.profiles).filter((id) =>
    existingExtIds.has(id),
  ).length;

  try {
    withTransaction(() => {
      if (!saveProfileBackup(apiKeyId, mergedSelectors, syncedBy)) {
        throw new ImportSaveError('selectors');
      }
      if (!saveSubBackup(apiKeyId, mergedSubs, syncedBy)) {
        throw new ImportSaveError('subs');
      }
      if (!saveExtractionBackup(apiKeyId, mergedExtraction, syncedBy)) {
        throw new ImportSaveError('extraction');
      }
    });
  } catch (error) {
    if (error instanceof ImportSaveError) {
      return { ok: false, reason: 'save', stage: error.stage };
    }
    throw error;
  }

  return {
    ok: true,
    selectors: {
      added: selAdded,
      updated: selUpdated,
      total: Object.keys(mergedSelectors.profiles).length,
    },
    subs: {
      added: subAdded,
      updated: subUpdated,
      total: Object.keys(mergedSubs.profiles).length,
    },
    extraction: {
      added: extAdded,
      updated: extUpdated,
      total: Object.keys(mergedExtraction.profiles).length,
    },
  };
}
