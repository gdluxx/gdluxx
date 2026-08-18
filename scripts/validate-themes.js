#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Validates theme structure, semantic tokens, and Tailwind 4 integration
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');

export const REQUIRED_THEME_TOKENS = [
  'accent-foreground',
  'background',
  'border',
  'border-disabled',
  'border-error',
  'border-focus',
  'border-strong',
  'border-success',
  'error',
  'error-active',
  'error-hover',
  'error-text',
  'foreground',
  'info',
  'info-active',
  'info-hover',
  'info-text',
  'input-background',
  'input-disabled',
  'input-invalid',
  'input-valid',
  'muted-foreground',
  'primary',
  'primary-active',
  'primary-disabled',
  'primary-hover',
  'primary-text',
  'skeleton',
  'spinner',
  'success',
  'success-active',
  'success-hover',
  'success-text',
  'surface',
  'surface-active',
  'surface-disabled',
  'surface-elevated',
  'surface-hover',
  'surface-overlay',
  'surface-selected',
  'surface-sunken',
  'text-disabled',
  'text-inverse',
  'warning',
  'warning-active',
  'warning-hover',
  'warning-text',
];

export const REQUIRED_PACKAGE_SIDE_EFFECTS = ['**/*.css', 'src/lib/themes/css/index.ts'];

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} content
 * @returns {Set<string>}
 */
export function extractTokens(content) {
  return new Set([...content.matchAll(/--color-([a-z-]+)\s*:/g)].map((match) => match[1] ?? ''));
}

/**
 * @param {string} content
 * @param {string} themeName
 * @param {boolean} dark
 * @returns {string | null}
 */
function extractThemeBlock(content, themeName, dark) {
  const selector = `\\.theme-${escapeRegExp(themeName)}${dark ? '\\.dark' : ''}`;
  return content.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? null;
}

/**
 * @param {string} themeName
 * @param {string} mode
 * @param {string} content
 * @param {string[]} errors
 */
function validateTokenSet(themeName, mode, content, errors) {
  const tokens = extractTokens(content);

  for (const token of REQUIRED_THEME_TOKENS) {
    if (!tokens.has(token)) {
      errors.push(`${themeName} (${mode}): missing --color-${token}`);
    }
  }
}

/**
 * @param {unknown} sideEffects
 * @param {string[]} errors
 */
function validatePackageSideEffects(sideEffects, errors) {
  if (!Array.isArray(sideEffects)) {
    errors.push('package.json sideEffects must preserve theme CSS side-effect imports');
    return;
  }

  for (const sideEffect of REQUIRED_PACKAGE_SIDE_EFFECTS) {
    if (!sideEffects.includes(sideEffect)) {
      errors.push(`package.json sideEffects is missing ${sideEffect}`);
    }
  }
}

/**
 * @param {string} [rootDir]
 * @returns {{ errors: string[], themes: string[] }}
 */
export function validateThemes(rootDir = projectRoot) {
  const errors = [];
  const themesDir = path.join(rootDir, 'src', 'lib', 'themes', 'css');
  const registryPath = path.join(themesDir, 'index.ts');
  const appCssPath = path.join(rootDir, 'src', 'app.css');
  const packageJsonPath = path.join(rootDir, 'package.json');

  if (!existsSync(themesDir)) {
    return { errors: ['Theme directory src/lib/themes/css does not exist'], themes: [] };
  }

  const themes = readdirSync(themesDir)
    .filter((file) => file.endsWith('.css'))
    .map((file) => file.slice(0, -4))
    .sort();

  if (themes.length === 0) {
    errors.push('No theme CSS files found in src/lib/themes/css');
  }

  for (const themeName of themes) {
    const content = readFileSync(path.join(themesDir, `${themeName}.css`), 'utf8');
    const lightBlock = extractThemeBlock(content, themeName, false);
    const darkBlock = extractThemeBlock(content, themeName, true);

    if (!lightBlock) {
      errors.push(`${themeName}: missing .theme-${themeName} selector`);
    } else {
      validateTokenSet(themeName, 'light', lightBlock, errors);
    }

    if (!darkBlock) {
      errors.push(`${themeName}: missing .theme-${themeName}.dark selector`);
    } else {
      validateTokenSet(themeName, 'dark', darkBlock, errors);
    }
  }

  if (!existsSync(registryPath)) {
    errors.push('Theme registry src/lib/themes/css/index.ts does not exist');
  } else {
    const registry = readFileSync(registryPath, 'utf8');
    const importedThemes = [...registry.matchAll(/import '\.\/([^']+)\.css';/g)]
      .map((match) => match[1])
      .sort();

    if (JSON.stringify(importedThemes) !== JSON.stringify(themes)) {
      errors.push('Theme registry imports do not match the CSS theme files');
    }

    for (const themeName of themes) {
      if (!registry.includes(`'${themeName}'`)) {
        errors.push(`Theme registry is missing ${themeName} from AVAILABLE_THEME_FILES`);
      }
    }
  }

  if (!existsSync(appCssPath)) {
    errors.push('Tailwind entrypoint src/app.css does not exist');
  } else {
    const appCss = readFileSync(appCssPath, 'utf8');
    if (!/@import\s+['"]tailwindcss['"]\s*;/.test(appCss)) {
      errors.push("src/app.css must import 'tailwindcss'");
    }
    if (!/@theme\s*\{/.test(appCss)) {
      errors.push('src/app.css must define semantic tokens in an @theme block');
    }
    if (!/@custom-variant\s+dark\s*\(&:where\(\.dark,\s*\.dark \*\)\)\s*;/.test(appCss)) {
      errors.push('src/app.css must define a class-based dark custom variant');
    }

    const appTokens = extractTokens(appCss);
    for (const token of REQUIRED_THEME_TOKENS) {
      if (!appTokens.has(token)) {
        errors.push(`Tailwind @theme integration is missing --color-${token}`);
      }
    }
  }

  if (!existsSync(packageJsonPath)) {
    errors.push('package.json does not exist');
  } else {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    validatePackageSideEffects(packageJson.sideEffects, errors);
  }

  return { errors, themes };
}

function runCli() {
  console.log('Validating theme system...');
  const result = validateThemes();

  if (result.errors.length > 0) {
    console.error(`\nValidation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${result.themes.length} themes and Tailwind integration.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runCli();
}
