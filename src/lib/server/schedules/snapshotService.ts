/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { siteConfigManager } from '$lib/server/siteConfigManager';
import { validOptions } from '$lib/server/validation/option-validation';

export type OptionPair = [string, string | number | boolean];

export interface MaskedOptionValue {
  sensitive: true;
  hasValue: true;
}

export interface KeepSentinel {
  keep: true;
}

export type StoredOptionPair = [string, string | number | boolean | MaskedOptionValue];
export type IncomingOptionPair = [string, string | number | boolean | KeepSentinel];

function isKeepSentinel(value: unknown): value is KeepSentinel {
  return typeof value === 'object' && value !== null && (value as KeepSentinel).keep === true;
}

export async function buildSiteOptionsSnapshot(
  urls: string[],
): Promise<Record<string, OptionPair[]>> {
  const snapshot: Record<string, OptionPair[]> = {};
  for (const url of urls) {
    snapshot[url] = await siteConfigManager.getCliOptionsForUrl(url);
  }
  return snapshot;
}

export function maskSensitiveOptionPairs(pairs: OptionPair[]): StoredOptionPair[] {
  return pairs.map(([id, value]): StoredOptionPair => {
    const option = validOptions.get(id);
    if (option?.sensitive) {
      return [id, { sensitive: true, hasValue: true }];
    }
    return [id, value];
  });
}

/**
 * `{keep:true}` retains the stored value; a plain value replaces it; a pair
 * simply absent from `incomingPairs` is removed — there is no explicit
 * "delete" sentinel because omission already means that.
 */
export function mergeSensitiveOnUpdate(
  storedPairs: OptionPair[],
  incomingPairs: IncomingOptionPair[],
): OptionPair[] {
  const stored = new Map(storedPairs);
  const merged: OptionPair[] = [];
  for (const [id, value] of incomingPairs) {
    if (isKeepSentinel(value)) {
      const storedValue = stored.get(id);
      if (storedValue !== undefined) {
        merged.push([id, storedValue]);
      }
      continue;
    }
    merged.push([id, value]);
  }
  return merged;
}
