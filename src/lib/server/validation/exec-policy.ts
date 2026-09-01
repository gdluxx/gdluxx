/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Importing config-utils would create a cycle; importing the server logger
// would pull in the database-backed logging manager. Callers log instead.
import path from 'node:path';
import { PATHS } from '$lib/server/constants';
import { GALLERY_DL_MODE } from '$lib/server/galleryDlMode';

export type PolicyRule =
  | 'command-bearing-key'
  | 'prohibited-postprocessor'
  | 'unconfined-path'
  | 'malformed-config'
  | 'max-depth-exceeded';

export interface PolicyViolation {
  rule: PolicyRule;
  /** Dotted key path; array elements as `[n]`. `''` is the document root. Never a value. */
  pointer: string;
  /** Only set for `unconfined-path`: the resolved filesystem path. Never any other value. */
  detail?: string;
}

// Every throw site sets `message === clientMessage`: ConfigExecutionBlockedError
// and ProhibitedConfigError land in schedule_runs.error and operator-facing
// surfaces, so no violation pointer/path is ever embedded in `.message`
// (use `.violations` for that).
export class ExecPolicyError extends Error {
  readonly violations: readonly PolicyViolation[];
  readonly clientMessage: string;

  constructor(message: string, clientMessage: string, violations: readonly PolicyViolation[]) {
    super(message);
    this.clientMessage = clientMessage;
    this.violations = violations;
  }
}

export class ProhibitedConfigError extends ExecPolicyError {
  constructor(message: string, clientMessage: string, violations: readonly PolicyViolation[]) {
    super(message, clientMessage, violations);
    this.name = 'ProhibitedConfigError';
  }
}

export class ConfigExecutionBlockedError extends ExecPolicyError {
  constructor(message: string, clientMessage: string, violations: readonly PolicyViolation[]) {
    super(message, clientMessage, violations);
    this.name = 'ConfigExecutionBlockedError';
  }
}

export class ProhibitedOptionError extends Error {
  readonly optionIds: readonly string[];
  readonly clientMessage: string;

  // Option ids are not secrets (unlike a resolved config path), so unlike
  // ExecPolicyError this embeds them directly in `.message`.
  constructor(optionIds: readonly string[]) {
    super(`Options not permitted: ${optionIds.join(', ')}`);
    this.name = 'ProhibitedOptionError';
    this.optionIds = optionIds;
    this.clientMessage = 'One or more requested options are not permitted.';
  }
}

export const PROHIBITED_OPTION_IDS: ReadonlySet<string> = new Set([
  'option',
  'postprocessor',
  'postprocessor-option',
  'exec',
  'exec-after',
]);

export const COMMAND_BEARING_KEYS: ReadonlySet<string> = new Set(['command', 'commands']);

// 'python' imports and calls a module in-process, providing the same arbitrary
// code-execution capability as 'exec'.
export const PROHIBITED_POSTPROCESSOR_NAMES: ReadonlySet<string> = new Set(['exec', 'python']);

export const POSTPROCESSOR_CONTAINER_KEYS: ReadonlySet<string> = new Set([
  'postprocessor',
  'postprocessors',
]);

export const PATH_CONFINED_LEAF_KEYS: ReadonlySet<string> = new Set([
  'base-directory',
  'part-directory',
  'archive',
  'path',
  'cookies',
]);

export const PATH_CONFINED_FULL_PATHS: ReadonlySet<string> = new Set(['cache.file']);

const MAX_DEPTH = 64;

const UNRESTRICTED_IGNORED_RULES: ReadonlySet<PolicyRule> = new Set([
  'command-bearing-key',
  'prohibited-postprocessor',
  'unconfined-path',
]);

const CLIENT_MESSAGE_PROHIBITED_SETTING =
  'This configuration contains a setting that is not permitted and was not saved.';
const CLIENT_MESSAGE_MALFORMED = 'The configuration is not valid JSON and was not saved.';
const CLIENT_MESSAGE_PATH_ESCAPE =
  'A path in this configuration points outside the allowed data directories and was not saved.';
export const CLIENT_MESSAGE_EXECUTION_BLOCKED =
  'The saved gallery-dl configuration contains a setting that is not permitted, so the job was not started. Edit the configuration and try again.';

function normalizeRoot(candidate: string): string {
  const resolved = path.resolve(candidate);
  if (resolved !== path.sep && resolved.endsWith(path.sep)) {
    return resolved.slice(0, -path.sep.length);
  }
  return resolved;
}

export function getAllowedPathRoots(): string[] {
  const roots = new Set<string>();

  // Root 1: mirrors config-utils.DATA_PATH. Duplicated rather than imported
  // to avoid the config-utils <-> exec-policy cycle (see file-top comment).
  const dataPathRaw = process.env.FILE_STORAGE_PATH?.trim() || './data';
  roots.add(normalizeRoot(dataPathRaw));

  // Root 2: <cwd>/data, the dir --config is actually read from.
  roots.add(normalizeRoot(PATHS.DATA_DIR));

  // Root 3: the container data mount.
  roots.add(normalizeRoot('/app/data'));

  // Root 4: replicates only the pure part of config-utils.getDownloadRoot()
  // (no warn-log, no cache) for the same cycle-avoidance reason as root 1.
  // Unset/relative DOWNLOAD_PATH falls back to /app/data/*, already root 3.
  const downloadPathRaw = process.env.DOWNLOAD_PATH?.trim();
  if (downloadPathRaw?.startsWith('/')) {
    const trimmedRoot = downloadPathRaw.replace(/\/+$/, '');
    roots.add(normalizeRoot(trimmedRoot));
    roots.add(normalizeRoot(`${trimmedRoot}/temp`));
  }

  // Root 5: bare-metal escape hatch, process-environment only.
  const extraRootsRaw = process.env.GDLUXX_CONFIG_PATH_ROOTS;
  if (extraRootsRaw) {
    for (const entry of extraRootsRaw.split(':')) {
      const trimmed = entry.trim();
      if (trimmed.startsWith('/')) {
        roots.add(normalizeRoot(trimmed));
      }
    }
  }

  return Array.from(roots);
}

export function parseConfigText(text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProhibitedConfigError(CLIENT_MESSAGE_MALFORMED, CLIENT_MESSAGE_MALFORMED, [
      { rule: 'malformed-config', pointer: '' },
    ]);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProhibitedConfigError(CLIENT_MESSAGE_MALFORMED, CLIENT_MESSAGE_MALFORMED, [
      { rule: 'malformed-config', pointer: '' },
    ]);
  }
  return parsed;
}

function normalizeName(value: string): string {
  return String(value).trim().toLowerCase();
}

function stripArrayIndices(pointer: string): string {
  return pointer.replace(/\[\d+\]/g, '');
}

function joinPointer(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function checkPathValue(rawValue: string, pointer: string): PolicyViolation | null {
  const resolved = path.resolve(process.cwd(), rawValue);

  if (rawValue.includes('\u0000')) {
    return { rule: 'unconfined-path', pointer, detail: resolved };
  }
  // gallery-dl runs expanduser/expandvars AFTER this check, so the real
  // target depends on the runtime user/environment and cannot be confined
  // here — reject the escape-capable syntax outright.
  if (rawValue.startsWith('~')) {
    return { rule: 'unconfined-path', pointer, detail: resolved };
  }
  if (rawValue.includes('$') || rawValue.includes('%')) {
    return { rule: 'unconfined-path', pointer, detail: resolved };
  }

  const roots = getAllowedPathRoots();
  const allowed = roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!allowed) {
    return { rule: 'unconfined-path', pointer, detail: resolved };
  }
  return null;
}

interface WalkOptions {
  checkExec: boolean;
  checkPath: boolean;
}

function walkConfig(root: unknown, options: WalkOptions): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  let aborted = false;

  function visit(node: unknown, pointer: string, depth: number): void {
    if (aborted) {
      return;
    }
    if (depth > MAX_DEPTH) {
      violations.push({ rule: 'max-depth-exceeded', pointer });
      aborted = true;
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        visit(node[i], `${pointer}[${i}]`, depth + 1);
        if (aborted) {
          return;
        }
      }
      return;
    }

    if (node === null || typeof node !== 'object') {
      return;
    }

    const obj = node as Record<string, unknown>;

    if (options.checkExec) {
      for (const key of COMMAND_BEARING_KEYS) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          violations.push({ rule: 'command-bearing-key', pointer: joinPointer(pointer, key) });
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(obj, 'name') &&
        typeof obj.name === 'string' &&
        PROHIBITED_POSTPROCESSOR_NAMES.has(normalizeName(obj.name))
      ) {
        violations.push({ rule: 'prohibited-postprocessor', pointer });
      }

      for (const key of POSTPROCESSOR_CONTAINER_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
          continue;
        }
        const value = obj[key];
        const keyPointer = joinPointer(pointer, key);
        if (typeof value === 'string') {
          if (PROHIBITED_POSTPROCESSOR_NAMES.has(normalizeName(value))) {
            violations.push({ rule: 'prohibited-postprocessor', pointer: keyPointer });
          }
        } else if (Array.isArray(value)) {
          value.forEach((element, index) => {
            if (
              typeof element === 'string' &&
              PROHIBITED_POSTPROCESSOR_NAMES.has(normalizeName(element))
            ) {
              violations.push({
                rule: 'prohibited-postprocessor',
                pointer: `${keyPointer}[${index}]`,
              });
            }
          });
        }
      }
    }

    if (options.checkPath) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value !== 'string') {
          continue;
        }
        const keyPointer = joinPointer(pointer, key);
        const isConfined =
          PATH_CONFINED_LEAF_KEYS.has(key) ||
          PATH_CONFINED_FULL_PATHS.has(stripArrayIndices(keyPointer));
        if (!isConfined) {
          continue;
        }
        const violation = checkPathValue(value, keyPointer);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      visit(value, joinPointer(pointer, key), depth + 1);
      if (aborted) {
        return;
      }
    }
  }

  visit(root, '', 0);
  return violations;
}

export function findCommandExecutionViolations(config: unknown): PolicyViolation[] {
  return walkConfig(config, { checkExec: true, checkPath: false });
}

export function findPathViolations(config: unknown): PolicyViolation[] {
  return walkConfig(config, { checkExec: false, checkPath: true });
}

export function findConfigViolations(config: unknown): PolicyViolation[] {
  return walkConfig(config, { checkExec: true, checkPath: true });
}

function filterEnforcedViolations(violations: PolicyViolation[]): PolicyViolation[] {
  if (GALLERY_DL_MODE === 'restricted') {
    return violations;
  }
  return violations.filter((violation) => !UNRESTRICTED_IGNORED_RULES.has(violation.rule));
}

export function assertCommandExecutionAbsent(config: unknown): void {
  const violations = filterEnforcedViolations(findCommandExecutionViolations(config));
  if (violations.length > 0) {
    throw new ProhibitedConfigError(
      CLIENT_MESSAGE_PROHIBITED_SETTING,
      CLIENT_MESSAGE_PROHIBITED_SETTING,
      violations,
    );
  }
}

export function assertPathsConfined(config: unknown): void {
  const violations = filterEnforcedViolations(findPathViolations(config));
  if (violations.length > 0) {
    throw new ProhibitedConfigError(
      CLIENT_MESSAGE_PATH_ESCAPE,
      CLIENT_MESSAGE_PATH_ESCAPE,
      violations,
    );
  }
}

export function assertConfigObjectAllowed(config: unknown): void {
  const violations = filterEnforcedViolations(findConfigViolations(config));
  if (violations.length > 0) {
    throw new ProhibitedConfigError(
      CLIENT_MESSAGE_PROHIBITED_SETTING,
      CLIENT_MESSAGE_PROHIBITED_SETTING,
      violations,
    );
  }
}

export function isProhibitedOptionId(optionId: string): boolean {
  return PROHIBITED_OPTION_IDS.has(optionId);
}

export function assertOptionIdsAllowed(optionIds: Iterable<string>): void {
  if (GALLERY_DL_MODE === 'unrestricted') {
    return;
  }
  const prohibited = Array.from(new Set(Array.from(optionIds).filter(isProhibitedOptionId)));
  if (prohibited.length > 0) {
    throw new ProhibitedOptionError(prohibited);
  }
}
