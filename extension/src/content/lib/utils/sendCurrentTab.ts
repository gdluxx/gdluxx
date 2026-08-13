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
  loadCustomDirectory,
  loadSiteDirectory,
  readIgnoredExtractionProfileIds,
} from '#utils/persistence';
import { getProfileForUrl } from '#utils/storageExtractionProfiles';
import { readDirAutoFillOptOuts, resolveDirectoryFromSource } from '#utils/directorySource';
import { isValidDirectoryName, isValidSiteDirectory } from '#utils/validation';
import { collectFallbackUrls } from './fallbackExtraction';

export interface CurrentTabSendPayload {
  fallbackUrls: string[];
  customDirectory?: string;
  siteDirectory?: string;
}

const MAX_CUSTOM_DIRECTORY_LENGTH = 255;

// Exported for tests.
export function pickCustomDirectory(
  manual: { enabled: boolean; value: string },
  resolved: string | null,
  optedOut: boolean,
): string | undefined {
  const manualTrimmed = manual.value.trim();
  if (
    manual.enabled &&
    manualTrimmed &&
    manualTrimmed.length <= MAX_CUSTOM_DIRECTORY_LENGTH &&
    isValidDirectoryName(manualTrimmed)
  ) {
    return manualTrimmed;
  }

  if (optedOut) return undefined;

  const resolvedTrimmed = resolved?.trim();
  if (
    resolvedTrimmed &&
    resolvedTrimmed.length <= MAX_CUSTOM_DIRECTORY_LENGTH &&
    isValidDirectoryName(resolvedTrimmed)
  ) {
    return resolvedTrimmed;
  }

  return undefined;
}

export async function buildCurrentTabSendPayload(
  pageUrl: string,
  fallbackLimit: number,
): Promise<CurrentTabSendPayload> {
  try {
    const manual = await loadCustomDirectory();
    const siteDirToggle = await loadSiteDirectory();

    const siteDirectory =
      siteDirToggle.enabled &&
      typeof window !== 'undefined' &&
      isValidSiteDirectory(window.location.hostname)
        ? window.location.hostname
        : undefined;

    const match = await getProfileForUrl(pageUrl);
    const ignoredIds = readIgnoredExtractionProfileIds();
    const activeMatch = match && !ignoredIds.has(match.id) ? match : null;

    let resolved: string | null = null;
    let fallbackUrls: string[] = [];

    if (activeMatch) {
      const source = activeMatch.profile.directorySource;

      if (source && source.selector.trim()) {
        resolved = resolveDirectoryFromSource(source).value;
      }
      fallbackUrls = await collectFallbackUrls(activeMatch.profile, fallbackLimit);
    }

    const optedOut =
      typeof window !== 'undefined' && readDirAutoFillOptOuts().has(window.location.href);

    return {
      fallbackUrls,
      customDirectory: pickCustomDirectory(manual, resolved, optedOut),
      siteDirectory,
    };
  } catch {
    return { fallbackUrls: [] };
  }
}
