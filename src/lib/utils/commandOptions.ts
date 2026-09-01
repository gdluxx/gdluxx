/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import optionsData from '$lib/assets/options.json';
import type { Option, OptionsData } from '$lib/types/options';
import type { Conflict, OptionWithSource, SiteConfigData } from '$lib/types/command-form';
import type { GalleryDlMode } from '$lib/types/gallery-dl-mode';

const typedOptionsData = optionsData as OptionsData;

export const allOptions: Option[] = Object.values(typedOptionsData).flatMap(
  (category) => category.options as Option[],
);

export const optionsById: ReadonlyMap<string, Option> = new Map(
  allOptions.map((option) => [option.id, option]),
);

export const SENSITIVE_MASK = '••••••••';

export interface OptionCapability {
  canAdd: boolean;
  canEdit: boolean;
  canRemove: boolean;
}

export function getOptionCapability(
  mode: GalleryDlMode,
  isProhibited: boolean,
  isSelected: boolean,
): OptionCapability {
  if (mode === 'unrestricted' || !isProhibited) {
    return { canAdd: true, canEdit: true, canRemove: true };
  }

  return {
    canAdd: false,
    canEdit: false,
    canRemove: isSelected,
  };
}

function hasRestrictedProhibitedSelectionFromSource(
  mode: GalleryDlMode,
  prohibitedOptionIds: readonly string[] | ReadonlySet<string>,
  selectedOptions: ReadonlyMap<string, OptionWithSource>,
  source?: OptionWithSource['source'],
): boolean {
  if (mode !== 'restricted') {
    return false;
  }

  const prohibitedIds =
    prohibitedOptionIds instanceof Set ? prohibitedOptionIds : new Set(prohibitedOptionIds);

  for (const [optionId, optionData] of selectedOptions) {
    if (prohibitedIds.has(optionId) && (source === undefined || optionData.source === source)) {
      return true;
    }
  }

  return false;
}

export function hasRestrictedProhibitedSelection(
  mode: GalleryDlMode,
  prohibitedOptionIds: readonly string[] | ReadonlySet<string>,
  selectedOptions: ReadonlyMap<string, OptionWithSource>,
): boolean {
  return hasRestrictedProhibitedSelectionFromSource(mode, prohibitedOptionIds, selectedOptions);
}

export function hasRestrictedProhibitedUserSelection(
  mode: GalleryDlMode,
  prohibitedOptionIds: readonly string[] | ReadonlySet<string>,
  selectedOptions: ReadonlyMap<string, OptionWithSource>,
): boolean {
  return hasRestrictedProhibitedSelectionFromSource(
    mode,
    prohibitedOptionIds,
    selectedOptions,
    'user',
  );
}

export function initialOptionValue(option: Option): string | number | boolean {
  return option.type === 'boolean' ? true : (option.defaultValue ?? '');
}

// Mirrors gallery-dl's predicate_range_parse: comma-separated groups, each an
// optional-part slice (start:stop:step), an optional-part dash range, or a bare
// index. Deliberately permissive; a miss warns in the UI but never blocks,
// since the installed gallery-dl may accept more than the pinned catalog.
const RANGE_GROUP_PATTERNS = [
  /^\s*$/,
  /^\s*\d*\s*:\s*\d*\s*(?::\s*\d*\s*)?$/,
  /^\s*\d*\s*-\s*\d*\s*$/,
  /^\s*\d+\s*$/,
];

export function isValidRangeValue(value: string): boolean {
  const groups = value.split(',');
  return (
    groups.some((group) => group.trim().length > 0) &&
    groups.every((group) => RANGE_GROUP_PATTERNS.some((pattern) => pattern.test(group)))
  );
}

/**
 * True when a selected option's value is not submittable as a CLI argument.
 * Mirrors the server-side validation semantics in
 * `src/lib/server/validation/option-validation.ts`, with one deliberate
 * addition: string/range options are also treated as empty when their value
 * isn't a string at all, which catches a legacy bug where such options were
 * initialized to boolean `true` instead of an empty string.
 */
export function isEmptyOptionValue(option: Option, value: string | number | boolean): boolean {
  if (option.type === 'boolean') {
    return false;
  }

  if (option.type === 'number') {
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    return !Number.isFinite(Number(value));
  }

  // string / range
  return typeof value !== 'string' || value.trim() === '';
}

/**
 * Full Option objects (for message rendering) among all selected entries
 * whose value is empty per `isEmptyOptionValue`.
 */
export function getEmptyValueOptions(selected: Map<string, OptionWithSource>): Option[] {
  const emptyOptions: Option[] = [];

  for (const [optionId, { value }] of selected) {
    const option = optionsById.get(optionId);
    if (!option) {
      continue;
    }

    if (isEmptyOptionValue(option, value)) {
      emptyOptions.push(option);
    }
  }

  return emptyOptions;
}

export interface CommandPreview {
  tokens: string[];
  text: string;
}

/**
 * Builds a client-side preview of the gallery-dl command that will be run,
 * mirroring `validateAndBuildCliArgs` server-side. Only user-sourced
 * selections are included; site-config-sourced selections are applied
 * server-side and omitted here to avoid duplicating them in the preview.
 */
export function buildCommandPreview(
  selected: Map<string, OptionWithSource>,
  urls: string[],
  opts: { maskSensitive?: boolean; maxUrls?: number } = {},
): CommandPreview {
  const { maskSensitive = false, maxUrls = 3 } = opts;
  const tokens: string[] = ['gallery-dl'];

  for (const [optionId, { value, source }] of selected) {
    if (source === 'site-config') {
      continue;
    }

    const option = optionsById.get(optionId);
    if (!option) {
      continue;
    }

    const maskValue = (rawValue: string): string =>
      maskSensitive && option.sensitive ? SENSITIVE_MASK : rawValue;

    if (option.type === 'boolean') {
      if (value === true) {
        tokens.push(option.command);
      }
      continue;
    }

    if (option.type === 'number') {
      if (value === '') {
        continue;
      }
      const num = Number(value);
      if (!Number.isFinite(num)) {
        continue;
      }
      tokens.push(option.command, maskValue(String(num)));
      continue;
    }

    // string / range
    if (typeof value === 'string' && value.trim() !== '') {
      tokens.push(option.command, maskValue(value.trim()));
    }
  }

  tokens.push('--config', '<config.json>');

  const limitedUrls = urls.slice(0, maxUrls);
  tokens.push(...limitedUrls);

  // Quote real command tokens containing whitespace; the `(+N more)`
  // truncation suffix is a display annotation and stays unquoted.
  let text = tokens.map((token) => (/\s/.test(token) ? `"${token}"` : token)).join(' ');

  if (urls.length > maxUrls) {
    const truncationSuffix = `(+${urls.length - maxUrls} more)`;
    tokens.push(truncationSuffix);
    text += ` ${truncationSuffix}`;
  }

  return { tokens, text };
}

/**
 * Pure conflict detection between user-selected option values and
 * site-config values for the same option id.
 */
export function detectConflicts(
  selected: Map<string, OptionWithSource>,
  siteConfigs: SiteConfigData[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const [optionId, optionData] of selected) {
    if (optionData.source !== 'user') {
      continue;
    }

    for (const config of siteConfigs) {
      if (optionId in config.options) {
        const siteRuleValue = config.options[optionId];
        if (optionData.value !== siteRuleValue) {
          conflicts.push({
            optionId,
            userValue: optionData.value,
            siteRuleValue,
            sitePattern: config.matchedPattern ?? '',
            configName: config.configName,
          });
        }
      }
    }
  }

  return conflicts;
}

export const MUTUALLY_EXCLUSIVE_IDS: readonly string[] = ['simulate', 'get-urls', 'resolve-urls'];

/**
 * Returns the matched Option objects when two or more mutually-exclusive
 * options are selected with a truthy boolean value; otherwise an empty array.
 */
export function getActiveMutuallyExclusive(selected: Map<string, OptionWithSource>): Option[] {
  const active: Option[] = [];

  for (const id of MUTUALLY_EXCLUSIVE_IDS) {
    if (selected.get(id)?.value === true) {
      const option = optionsById.get(id);
      if (option) {
        active.push(option);
      }
    }
  }

  return active.length >= 2 ? active : [];
}
