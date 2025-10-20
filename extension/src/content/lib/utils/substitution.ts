/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface SubRule {
  id: string;
  pattern: string;
  replacement: string;
  flags: string;
  enabled: boolean;
  order: number;
}

export interface SubResult {
  initialUrl: string;
  originalUrl: string;
  modifiedUrl: string;
  modified: boolean;
  rulesApplied: string[];
}

export interface SubPreviewItem {
  original: string;
  modified: string;
  changed: boolean;
  rulesApplied: string[];
}

const DEFAULT_FLAGS = 'g';

function normaliseFlags(flags: string): string {
  if (!flags) return DEFAULT_FLAGS;
  const unique = new Set(flags.split('').filter(Boolean));
  if (!unique.has('g')) {
    unique.add('g');
  }
  return Array.from(unique).join('');
}

export function createSubRule(
  pattern = '',
  replacement = '',
  flags = DEFAULT_FLAGS,
  order = 0,
): SubRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    pattern: pattern.trim(),
    replacement,
    flags: normaliseFlags(flags),
    enabled: true,
    order,
  };
}

export function validateRegexPattern(
  pattern: string,
  flags: string,
): { valid: boolean; error?: string } {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  try {
    new RegExp(trimmed, normaliseFlags(flags));
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid regex pattern',
    };
  }
}

export function applySubRules(url: string, rules: SubRule[]): SubResult {
  const sorted = [...rules]
    .filter((rule) => rule.enabled && rule.pattern.trim())
    .sort((a, b) => a.order - b.order);

  let current = url;
  const rulesApplied: string[] = [];

  for (const rule of sorted) {
    try {
      const regex = new RegExp(rule.pattern, normaliseFlags(rule.flags));
      const next = current.replace(regex, rule.replacement);
      if (next !== current) {
        rulesApplied.push(rule.id);
        current = next;
      }
    } catch (error) {
      console.error(`Substitution rule ${rule.id} failed:`, error);
    }
  }

  return {
    initialUrl: url,
    originalUrl: url,
    modifiedUrl: current,
    modified: current !== url,
    rulesApplied,
  };
}

export function previewSubs(urls: string[], rules: SubRule[], limit = 5): SubPreviewItem[] {
  if (!rules.length || !urls.length) {
    return [];
  }

  const results: SubPreviewItem[] = [];

  for (const url of urls) {
    const result = applySubRules(url, rules);
    if (!result.modified) continue;
    results.push({
      original: url,
      modified: result.modifiedUrl,
      changed: result.modified,
      rulesApplied: result.rulesApplied,
    });
    if (results.length >= limit) break;
  }

  return results;
}
