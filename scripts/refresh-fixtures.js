#!/usr/bin/env node

/* eslint-disable no-console */

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');

export const FIXTURES_DIR = path.join('tests', 'fixtures');
export const REQUIRED_FIXTURE_FILES = [
  'meta.json',
  'ping-response.json',
  'extraction-bundle.stripped.json',
  'external-send-response.json',
];

function readJson(rootDir, relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readGitShow(rootDir, tag, relativePath) {
  try {
    return execFileSync('git', ['show', `${tag}:${relativePath}`], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function checkGitConsistency(rootDir, tag) {
  const errors = [];
  const warnings = [];

  const pingSrc = readGitShow(rootDir, tag, 'src/routes/api/extension/ping/+server.ts');
  if (pingSrc === null) {
    warnings.push(`Could not read ping route source at ${tag} (unreachable tag or shallow clone).`);
  } else {
    if (pingSrc.includes('serverVersion') || pingSrc.includes('EXTENSION_CAPABILITIES')) {
      errors.push(
        `${tag}'s ping route already reports serverVersion/capabilities - ping-response.json ` +
          'no longer represents a pre-capability server. Update the fixture (and PREVIOUS_RELEASE_TAG).',
      );
    }
    if (!pingSrc.includes('keyName')) {
      errors.push(`${tag}'s ping route no longer matches the shape ping-response.json assumes.`);
    }
  }

  const extractionSchemaSrc = readGitShow(
    rootDir,
    tag,
    'src/lib/server/validation/extensionProfiles.ts',
  );
  if (extractionSchemaSrc === null) {
    warnings.push(
      `Could not read extensionProfiles.ts at ${tag} (unreachable tag or shallow clone).`,
    );
  } else if (
    extractionSchemaSrc.includes('directorySource') ||
    extractionSchemaSrc.includes('accumulate')
  ) {
    errors.push(
      `${tag}'s extraction profile schema already knows about directorySource/accumulate - ` +
        'extraction-bundle.stripped.json no longer represents a server that strips them.',
    );
  }

  const externalSrc = readGitShow(rootDir, tag, 'src/routes/api/extension/external/+server.ts');
  if (externalSrc === null) {
    warnings.push(
      `Could not read external route source at ${tag} (unreachable tag or shallow clone).`,
    );
  } else if (!externalSrc.includes('overallSuccess') || !externalSrc.includes('results')) {
    errors.push(
      `${tag}'s external route response shape no longer matches external-send-response.json.`,
    );
  }

  return { errors, warnings };
}

export function validateFixtures(rootDir = projectRoot, options = {}) {
  const errors = [];
  const warnings = [];

  const configPath = path.join(FIXTURES_DIR, 'config.json');
  if (!existsSync(path.join(rootDir, configPath))) {
    return { errors: [`Missing ${configPath}`], warnings, tag: null };
  }

  let configTag;
  try {
    const config = readJson(rootDir, configPath);
    configTag = config.PREVIOUS_RELEASE_TAG;
    if (typeof configTag !== 'string' || !configTag) {
      return {
        errors: [`${configPath} is missing a string PREVIOUS_RELEASE_TAG`],
        warnings,
        tag: null,
      };
    }
  } catch (error) {
    return {
      errors: [`Failed to parse ${configPath}: ${error instanceof Error ? error.message : error}`],
      warnings,
      tag: null,
    };
  }

  const tag = options.tag ?? configTag;
  const fixtureDir = path.join(FIXTURES_DIR, 'previous-release');

  if (!existsSync(path.join(rootDir, fixtureDir))) {
    return {
      errors: [`Fixture directory ${fixtureDir} does not exist`],
      warnings,
      tag,
    };
  }

  for (const file of REQUIRED_FIXTURE_FILES) {
    const filePath = path.join(fixtureDir, file);
    if (!existsSync(path.join(rootDir, filePath))) {
      errors.push(`Missing fixture file ${filePath}`);
      continue;
    }
    try {
      readJson(rootDir, filePath);
    } catch (error) {
      errors.push(
        `${filePath} is not valid JSON: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  if (errors.length === 0) {
    const meta = readJson(rootDir, path.join(fixtureDir, 'meta.json'));
    if (meta.tag !== tag) {
      errors.push(`${fixtureDir}/meta.json declares tag "${meta.tag}", expected "${tag}"`);
    }
    if (!Array.isArray(meta.baselineRoutes) || meta.baselineRoutes.length === 0) {
      errors.push(`${fixtureDir}/meta.json is missing a non-empty baselineRoutes array`);
    }
    if (options.tag === undefined && configTag !== tag) {
      errors.push(
        `config.json PREVIOUS_RELEASE_TAG ("${configTag}") does not match validated tag ("${tag}")`,
      );
    }
  }

  const gitCheck = checkGitConsistency(rootDir, tag);
  errors.push(...gitCheck.errors);
  warnings.push(...gitCheck.warnings);

  return { errors, warnings, tag };
}

function parseCliTag() {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--tag='));
  return arg ? arg.slice('--tag='.length) : undefined;
}

function runCli() {
  const tag = parseCliTag();
  console.log(
    tag ? `Validating fixtures for candidate tag ${tag}...` : 'Validating extension fixtures...',
  );

  const result = validateFixtures(projectRoot, { tag });

  for (const warning of result.warnings) {
    console.warn(`- warning: ${warning}`);
  }

  if (result.errors.length > 0) {
    console.error(`\nFixture validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Fixtures for ${result.tag} are consistent.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runCli();
}
