#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Validates theme structure, semantic tokens, and Tailwind 4 integration.
 *
 * Structural rules (H14): a theme file is an unlayered, third-party-authorable
 * surface, so it may contain only the two `.theme-X` / `.theme-X.dark` blocks,
 * only allowlisted custom properties plus `color-scheme`, no `!important`, no
 * at-rules, no nesting, no rules targeting app selectors, and no `url(` in any
 * value.
 *
 * Token data lives in src/lib/themes/tokenContract.ts (single source; Node
 * imports it via native type stripping).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import {
  REQUIRED_COLOR_TOKENS,
  CONTRACT_STAGE,
  LEGACY_SHADOW_TOKENS,
  OPTIONAL_DIALS,
  ALLOWED_BACKDROP_FILTER_FUNCTIONS,
  REQUIRED_PACKAGE_SIDE_EFFECTS,
  allowedThemeProperties,
} from '../src/lib/themes/tokenContract.ts';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');

// Back-compat name used by the test suite.
export const REQUIRED_THEME_TOKENS = REQUIRED_COLOR_TOKENS;
export { REQUIRED_PACKAGE_SIDE_EFFECTS };

const PX_PER_REM = 16;

/**
 * @typedef {{ prop: string, value: string }} ThemeDecl
 * @typedef {Map<string, string>} ThemeBlock
 */

/**
 * Parse one theme file into its two blocks, enforcing the structural contract.
 *
 * @param {string} content
 * @param {string} themeName
 * @returns {{ errors: string[], light: ThemeBlock | null, dark: ThemeBlock | null }}
 */
export function parseThemeFile(content, themeName) {
  /** @type {string[]} */
  const errors = [];
  /** @type {ThemeBlock | null} */
  let light = null;
  /** @type {ThemeBlock | null} */
  let dark = null;

  let root;
  try {
    root = postcss.parse(content);
  } catch (error) {
    return {
      errors: [
        `${themeName}: CSS parse error: ${error instanceof Error ? error.message : String(error)}`,
      ],
      light: null,
      dark: null,
    };
  }

  const lightSelector = `.theme-${themeName}`;
  const darkSelector = `.theme-${themeName}.dark`;
  const allowed = allowedThemeProperties();

  for (const node of root.nodes) {
    if (node.type === 'comment') {
      continue;
    }
    if (node.type === 'atrule') {
      errors.push(`${themeName}: at-rules are not allowed in theme files (@${node.name})`);
      continue;
    }
    if (node.type !== 'rule') {
      continue;
    }

    const selector = node.selector.trim();
    let block;
    if (selector === lightSelector) {
      if (light) {
        errors.push(`${themeName}: duplicate ${lightSelector} block`);
        continue;
      }
      light = block = new Map();
    } else if (selector === darkSelector) {
      if (dark) {
        errors.push(`${themeName}: duplicate ${darkSelector} block`);
        continue;
      }
      dark = block = new Map();
    } else {
      errors.push(
        `${themeName}: selector "${selector}" is not allowed; only ${lightSelector} and ${darkSelector} may appear`,
      );
      continue;
    }

    const mode = selector === lightSelector ? 'light' : 'dark';

    for (const child of node.nodes ?? []) {
      if (child.type === 'comment') {
        continue;
      }
      if (child.type !== 'decl') {
        errors.push(`${themeName} (${mode}): nested rules and at-rules are not allowed`);
        continue;
      }

      const prop = child.prop;
      const value = child.value.trim();

      if (child.important) {
        errors.push(`${themeName} (${mode}): !important is not allowed (${prop})`);
      }
      if (/url\s*\(/i.test(value)) {
        errors.push(`${themeName} (${mode}): url() is not allowed in any value (${prop})`);
      }
      // CSS escapes could smuggle url( past the check above (\75rl(...) parses
      // as url(...)), and no legitimate token grammar needs a backslash.
      if (value.includes('\\')) {
        errors.push(`${themeName} (${mode}): backslash escapes are not allowed (${prop})`);
      }
      if (value.length === 0) {
        errors.push(`${themeName} (${mode}): empty value for ${prop}`);
      }

      if (!allowed.has(prop)) {
        if (
          !CONTRACT_STAGE.legacyShadowsAllowed &&
          LEGACY_SHADOW_TOKENS.includes(/** @type {never} */ (prop))
        ) {
          errors.push(
            `${themeName} (${mode}): ${prop} was renamed to a semantic elevation role; use --shadow-{raised,floating,overlay}`,
          );
        } else {
          errors.push(`${themeName} (${mode}): property ${prop} is not in the theme contract`);
        }
        continue;
      }

      if (block.has(prop)) {
        errors.push(`${themeName} (${mode}): duplicate declaration of ${prop}`);
      }
      block.set(prop, value);
    }
  }

  return { errors, light, dark };
}

/**
 * @param {string} value
 * @returns {number | null} pixels, or null if not a plain CSS length
 */
function parseLengthPx(value) {
  const match = value.match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (match[2] === undefined) {
    return amount === 0 ? 0 : null;
  }
  return match[2] === 'px' ? amount : amount * PX_PER_REM;
}

/**
 * @param {string} value
 * @returns {number | null} milliseconds, or null if not a duration
 */
function parseDurationMs(value) {
  const match = value.match(/^(\d*\.?\d+)(ms|s)$/);
  if (!match) {
    return null;
  }
  return match[2] === 'ms' ? Number(match[1]) : Number(match[1]) * 1000;
}

/**
 * @param {string} value
 * @returns {{ ok: boolean, blurPx: number | null }}
 */
function parseBackdropFilter(value) {
  if (value === 'none') {
    return { ok: true, blurPx: null };
  }
  const functionPattern = /([a-z-]+)\(([^()]*)\)/g;
  const stripped = value.replace(functionPattern, ' ').trim();
  if (stripped.length > 0) {
    return { ok: false, blurPx: null };
  }
  let blurPx = null;
  let sawAny = false;
  for (const match of value.matchAll(functionPattern)) {
    sawAny = true;
    const fn = match[1];
    if (!ALLOWED_BACKDROP_FILTER_FUNCTIONS.includes(/** @type {never} */ (fn))) {
      return { ok: false, blurPx: null };
    }
    if (fn === 'blur') {
      const px = parseLengthPx(match[2].trim());
      if (px !== null) {
        blurPx = Math.max(blurPx ?? 0, px);
      }
    }
  }
  return { ok: sawAny, blurPx };
}

/**
 * Validate one authored dial value. Type failures are errors; range
 * departures are warnings (H12: taste bounds are not invariants).
 *
 * @param {string} themeName
 * @param {string} mode
 * @param {string} prop
 * @param {string} value
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateDialValue(themeName, mode, prop, value, errors, warnings) {
  const spec = OPTIONAL_DIALS[/** @type {keyof typeof OPTIONAL_DIALS} */ (prop)];
  if (!spec) {
    return;
  }
  const where = `${themeName} (${mode})`;

  if (spec.type === 'length') {
    const px = parseLengthPx(value);
    if (px === null || px < 0) {
      errors.push(`${where}: ${prop} must be a non-negative px/rem/em length (got "${value}")`);
      return;
    }
    if ('hardMinPx' in spec && px < spec.hardMinPx) {
      errors.push(
        `${where}: ${prop} below ${spec.hardMinPx}px is a project hard floor (got "${value}")`,
      );
      return;
    }
    if ('warnMinPx' in spec && px < spec.warnMinPx) {
      warnings.push(`${where}: ${prop} below recommended ${spec.warnMinPx}px (got "${value}")`);
    }
    if ('warnMaxPx' in spec && px > spec.warnMaxPx && prop !== '--radius-pill') {
      warnings.push(`${where}: ${prop} above recommended ${spec.warnMaxPx}px (got "${value}")`);
    }
  } else if (spec.type === 'duration') {
    const ms = parseDurationMs(value);
    if (ms === null) {
      errors.push(`${where}: ${prop} must be a ms/s duration (got "${value}")`);
      return;
    }
    if ('warnMaxMs' in spec && ms > spec.warnMaxMs) {
      warnings.push(`${where}: ${prop} above recommended ${spec.warnMaxMs}ms (got "${value}")`);
    }
  } else if (spec.type === 'filter') {
    const { ok, blurPx } = parseBackdropFilter(value);
    if (!ok) {
      errors.push(
        `${where}: ${prop} must be none or a list of ${ALLOWED_BACKDROP_FILTER_FUNCTIONS.join('/')} functions (got "${value}")`,
      );
      return;
    }
    if ('warnMaxBlurPx' in spec && blurPx !== null && blurPx > spec.warnMaxBlurPx) {
      warnings.push(
        `${where}: ${prop} blur above recommended ${spec.warnMaxBlurPx}px (full-viewport compositing cost)`,
      );
    }
  }
  // 'shadow' and 'font-stack' dials have no static grammar beyond the
  // structural rules (non-empty, no url(), no !important).
}

/**
 * @param {string} themeName
 * @param {string} mode
 * @param {ThemeBlock} block
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateBlock(themeName, mode, block, errors, warnings) {
  for (const token of REQUIRED_COLOR_TOKENS) {
    if (!block.has(`--color-${token}`)) {
      errors.push(`${themeName} (${mode}): missing --color-${token}`);
    }
  }

  if (CONTRACT_STAGE.requireColorScheme) {
    const scheme = block.get('color-scheme');
    if (scheme === undefined) {
      errors.push(`${themeName} (${mode}): missing color-scheme`);
    } else if (scheme !== 'light' && scheme !== 'dark') {
      errors.push(
        `${themeName} (${mode}): color-scheme must be "light" or "dark" (got "${scheme}")`,
      );
    }
  }

  for (const [prop, value] of block) {
    validateDialValue(themeName, mode, prop, value, errors, warnings);
  }
}

/**
 * Perceptual weight of a box-shadow value: max over layers of
 * alpha x (|y-offset| + blur). `none` scores zero, so partial flattening
 * passes the ordering check while an inverted stack warns.
 *
 * @param {string} value
 * @returns {number}
 */
export function shadowWeight(value) {
  if (value.trim() === 'none') {
    return 0;
  }
  // Split layers on commas outside parentheses.
  const layers = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') {
      depth += 1;
    }
    if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      layers.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  layers.push(current);

  let weight = 0;
  for (const layer of layers) {
    // The color may sit before or after the lengths; extract alpha from it,
    // then strip it so positional x/y/blur/spread indexing is order-safe.
    let alpha = 1;
    const slashAlpha = layer.match(/\/\s*(\d*\.?\d+)(%?)\s*\)/);
    const commaAlpha = layer.match(/(?:rgba|hsla)\([^)]*,\s*(\d*\.?\d+)\s*\)/);
    const hexAlpha = layer.match(/#[0-9a-f]{6}([0-9a-f]{2})\b|#[0-9a-f]{3}([0-9a-f])\b/i);
    const mixAlpha = /color-mix\([^)]*transparent[^)]*\)/i.test(layer)
      ? layer.match(/color-mix\([^)]*?(\d*\.?\d+)%[^)]*\)/i)
      : null;
    if (slashAlpha) {
      alpha = Number(slashAlpha[1]) / (slashAlpha[2] === '%' ? 100 : 1);
    } else if (commaAlpha) {
      alpha = Number(commaAlpha[1]);
    } else if (mixAlpha) {
      alpha = Number(mixAlpha[1]) / 100;
    } else if (hexAlpha) {
      const nibble = hexAlpha[1] ?? (hexAlpha[2] ?? 'f') + (hexAlpha[2] ?? 'f');
      alpha = parseInt(nibble.length === 1 ? nibble + nibble : nibble, 16) / 255;
    }

    let geometry = layer.replace(/#[0-9a-f]{3,8}\b/gi, ' ');
    // Peel color functions inside-out so nesting (color-mix over rgb) resolves.
    let previous;
    do {
      previous = geometry;
      geometry = geometry.replace(/[a-z-]+\([^()]*\)/gi, ' ');
    } while (geometry !== previous);

    const lengths = [...geometry.matchAll(/(?<![\w/.])(-?\d*\.?\d+)(px|rem|em)?(?=\s|$)/g)]
      .map((m) => parseLengthPx(`${m[1]}${m[2] ?? ''}`))
      .filter((px) => px !== null);
    const y = Math.abs(lengths[1] ?? 0);
    const blur = lengths[2] ?? 0;
    weight = Math.max(weight, alpha * (y + blur));
  }
  return weight;
}

/**
 * Elevation-role relationship checks (Phase 3, warn-level).
 *
 * @param {string} themeName
 * @param {ThemeBlock | null} light
 * @param {ThemeBlock | null} dark
 * @param {string[]} warnings
 */
function validateElevationRoles(themeName, light, dark, warnings) {
  if (!CONTRACT_STAGE.elevationRolesActive) {
    return;
  }
  const roles = ['--shadow-raised', '--shadow-floating', '--shadow-overlay'];

  for (const [mode, block] of [
    ['light', light],
    ['dark', dark],
  ]) {
    if (!block || typeof block === 'string') {
      continue;
    }
    const authored = roles.filter((r) => block.has(r));
    if (authored.length > 0 && authored.length < roles.length) {
      warnings.push(
        `${themeName} (${mode}): authors ${authored.join(', ')} but not all three elevation roles; missing roles fall back to app defaults (black ink)`,
      );
    }
    const weights = roles.map((r) => {
      const value = block.get(r);
      return value === undefined ? null : shadowWeight(value);
    });
    for (let i = 0; i < roles.length - 1; i++) {
      const a = weights[i];
      const b = weights[i + 1];
      if (a !== null && b !== null && b !== 0 && a > b) {
        warnings.push(
          `${themeName} (${mode}): elevation inverted, ${roles[i]} sits heavier than ${roles[i + 1]} (${a.toFixed(1)} > ${b.toFixed(1)})`,
        );
      }
    }
  }

  if (light && dark) {
    const lightRoles = roles.filter((r) => light.has(r));
    const darkRoles = roles.filter((r) => dark.has(r));
    if (darkRoles.length > 0 && darkRoles.length < lightRoles.length) {
      const missing = lightRoles.filter((r) => !dark.has(r));
      warnings.push(
        `${themeName}: dark block authors some shadow roles but not ${missing.join(', ')}; light-mode shadows leak into dark`,
      );
    }
  }
}

// Left-anchored so drop-shadow-*/inset-shadow-*/text-shadow-* (namespaces
// Phase 3 did not clear) and --shadow-* custom properties do not false-positive.
const STOCK_SHADOW_PATTERN = /(?<![-\w])shadow-(2xs|xs|sm|md|lg|xl|2xl)\b/;
// Bare/sized stock radii are banned after the geometry migration; the role
// utilities (rounded-{control,surface,overlay,pill}) and the H15 literals
// (rounded-full, rounded-none) deliberately do not match.
const STOCK_RADIUS_PATTERN =
  /(?<![-\w])rounded(-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?(-(?:xs|sm|md|lg|xl|2xl|3xl|4xl))?(?![-\w])/;

/**
 * The cleared shadow namespace makes a stray stock utility render nothing;
 * this guard makes it fail loudly instead. tokenContract.ts is exempt (it
 * names the legacy tokens to produce the rename hint).
 *
 * @param {string} srcDir
 * @param {string[]} errors
 */
function checkStockShadowLeaks(srcDir, errors) {
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (
        !/\.(svelte|css|ts|js)$/.test(entry.name) ||
        full.endsWith(path.join('lib', 'themes', 'tokenContract.ts'))
      ) {
        continue;
      }
      const content = readFileSync(full, 'utf8');
      const shadowMatch = content.match(STOCK_SHADOW_PATTERN);
      if (shadowMatch) {
        errors.push(
          `${path.relative(path.dirname(srcDir), full)}: stock shadow "${shadowMatch[0]}" found; the namespace is cleared, use shadow-{raised,floating,overlay}`,
        );
      }
      const radiusMatch = content.match(STOCK_RADIUS_PATTERN);
      if (radiusMatch) {
        errors.push(
          `${path.relative(path.dirname(srcDir), full)}: stock radius "${radiusMatch[0]}" found; use rounded-{control,surface,overlay,pill} (or literal rounded-full/rounded-none for H15 circles and squares)`,
        );
      }
    }
  };
  walk(srcDir);
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
 * @returns {{ errors: string[], warnings: string[], themes: string[] }}
 */
export function validateThemes(rootDir = projectRoot) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const themesDir = path.join(rootDir, 'src', 'lib', 'themes', 'css');
  const registryPath = path.join(themesDir, 'index.ts');
  const appCssPath = path.join(rootDir, 'src', 'app.css');
  const packageJsonPath = path.join(rootDir, 'package.json');

  if (!existsSync(themesDir)) {
    return {
      errors: ['Theme directory src/lib/themes/css does not exist'],
      warnings,
      themes: [],
    };
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
    const parsed = parseThemeFile(content, themeName);
    errors.push(...parsed.errors);

    if (!parsed.light) {
      errors.push(`${themeName}: missing .theme-${themeName} selector`);
    } else {
      validateBlock(themeName, 'light', parsed.light, errors, warnings);
    }

    if (!parsed.dark) {
      errors.push(`${themeName}: missing .theme-${themeName}.dark selector`);
    } else {
      validateBlock(themeName, 'dark', parsed.dark, errors, warnings);
    }

    validateElevationRoles(themeName, parsed.light, parsed.dark, warnings);
  }

  checkStockShadowLeaks(path.join(rootDir, 'src'), errors);

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
    if (!/@import\s+['"]tailwindcss['"](\s+source\([^)]*\))?\s*;/.test(appCss)) {
      errors.push("src/app.css must import 'tailwindcss'");
    }
    if (!/@theme\s*\{/.test(appCss)) {
      errors.push('src/app.css must define semantic tokens in an @theme block');
    }
    if (!/@custom-variant\s+dark\s*\(&:where\(\.dark,\s*\.dark \*\)\)\s*;/.test(appCss)) {
      errors.push('src/app.css must define a class-based dark custom variant');
    }

    const appTokens = new Set(
      [...appCss.matchAll(/--color-([a-z-]+)\s*:/g)].map((match) => match[1] ?? ''),
    );
    for (const token of REQUIRED_COLOR_TOKENS) {
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

  return { errors, warnings, themes };
}

function runCli() {
  console.log('Validating theme system...');
  const result = validateThemes();

  for (const warning of result.warnings) {
    console.warn(`warn: ${warning}`);
  }

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
