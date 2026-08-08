/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { EXTENSION_CAPABILITIES } from '../src/lib/server/extension/capabilities';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const EXTENSION_API_DIR = path.join(projectRoot, 'src', 'routes', 'api', 'extension');
const HOOKS_PATH = path.join(projectRoot, 'src', 'hooks.server.ts');
const EXTENSION_SRC_DIR = path.join(projectRoot, 'extension', 'src');
const FIXTURES_CONFIG_PATH = path.join(projectRoot, 'tests', 'fixtures', 'config.json');

function listExtensionRouteNames(): string[] {
  return readdirSync(EXTENSION_API_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(EXTENSION_API_DIR, name, '+server.ts')))
    .sort();
}

function readExtensionApiRoutesFromHooks(): string[] {
  const source = readFileSync(HOOKS_PATH, 'utf8');
  const match = source.match(/const\s+extensionApiRoutes\s*=\s*\[([\s\S]*?)]\s*;/);
  if (!match) {
    throw new Error('Could not find `extensionApiRoutes` array literal in src/hooks.server.ts');
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function collectFiles(dir: string, exts: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function isReferencedUnderExtensionSrc(flag: string): boolean {
  return collectFiles(EXTENSION_SRC_DIR, ['.ts', '.svelte']).some((file) =>
    readFileSync(file, 'utf8').includes(flag),
  );
}

interface FixtureMeta {
  tag: string;
  baselineRoutes: string[];
}

function readConfiguredTag(): string {
  const config = JSON.parse(readFileSync(FIXTURES_CONFIG_PATH, 'utf8')) as {
    PREVIOUS_RELEASE_TAG: string;
  };
  return config.PREVIOUS_RELEASE_TAG;
}

function readFixtureMeta(): FixtureMeta {
  const metaPath = path.join(projectRoot, 'tests', 'fixtures', 'previous-release', 'meta.json');
  return JSON.parse(readFileSync(metaPath, 'utf8')) as FixtureMeta;
}

function capabilityPrefixFor(routeName: string): string {
  return `${routeName}.`;
}

describe('extension route <-> capability wiring (filesystem-derived tripwire)', () => {
  const routeNames = listExtensionRouteNames();
  const hooksRoutes = readExtensionApiRoutesFromHooks();
  const meta = readFixtureMeta();
  const configuredTag = readConfiguredTag();

  test('at least one extension route exists on disk (sanity check for the enumeration itself)', () => {
    expect(routeNames.length).toBeGreaterThan(0);
  });

  test('every route directory on disk has an exact-match entry in extensionApiRoutes', () => {
    for (const name of routeNames) {
      expect(hooksRoutes).toContain(`/api/extension/${name}`);
    }
  });

  test('extensionApiRoutes has no entries for routes that do not exist on disk', () => {
    const onDisk = new Set(routeNames.map((name) => `/api/extension/${name}`));
    for (const route of hooksRoutes) {
      expect(onDisk.has(route)).toBe(true);
    }
  });

  test('fixture provenance tag matches the configured N-1 (tests/fixtures/config.json)', () => {
    expect(meta.tag).toBeTruthy();
    expect(meta.tag).toBe(configuredTag);
    expect(Array.isArray(meta.baselineRoutes)).toBe(true);
    expect(meta.baselineRoutes.length).toBeGreaterThan(0);
  });

  test('every route beyond the fixture baseline has a corresponding capability entry', () => {
    const baseline = new Set(meta.baselineRoutes);
    const newRoutes = routeNames.filter((name) => !baseline.has(name));

    expect(newRoutes.length).toBeGreaterThan(0);

    for (const routeName of newRoutes) {
      const prefix = capabilityPrefixFor(routeName);
      const matching = EXTENSION_CAPABILITIES.filter((flag) => flag.startsWith(prefix));
      expect(
        matching.length,
        `route "${routeName}" (added after ${meta.tag}) has no EXTENSION_CAPABILITIES entry ` +
          `starting with "${prefix}"`,
      ).toBeGreaterThan(0);
    }
  });

  test('every capability flag is referenced somewhere under extension/src', () => {
    for (const flag of EXTENSION_CAPABILITIES) {
      expect(
        isReferencedUnderExtensionSrc(flag),
        `capability flag "${flag}" looks dead - no reference under extension/src`,
      ).toBe(true);
    }
  });
});
