#!/usr/bin/env node

/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRAST_EXEMPT_COLOR_TOKENS } from '../src/lib/themes/tokenContract.ts';
import { parseThemeFile } from './validate-themes.js';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const BASELINE_PATH = path.join(projectRoot, 'scripts', 'theme-contrast-baseline.json');

const STATUS_HUES = ['success', 'warning', 'error', 'info'];
const ALL_HUES = ['primary', ...STATUS_HUES];

const MIN_TEXT_CONTRAST_RATIO = 4.5;
const MIN_NON_TEXT_CONTRAST_RATIO = 3;
const MIN_SURFACE_LADDER_STEP_RATIO = 1.03;
const MIN_SELECTED_CONTRAST_RATIO = 1.1;
const MIN_SELECTED_RGB_DISTANCE = 10;
const MIN_HUE_RGB_DISTANCE = 40;
const ERROR_TINT_ALPHA = 0.1;

/** @param {string} value @returns {[number, number, number] | null} */
function parseHex(value) {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = [...hex].map((c) => c + c).join('');
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** @param {[number, number, number]} rgb */
function relativeLuminance([r, g, b]) {
  /** @param {number} v */
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** @param {[number, number, number]} a @param {[number, number, number]} b */
function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * @param {[number, number, number]} top
 * @param {number} alpha
 * @param {[number, number, number]} bottom
 * @returns {[number, number, number]}
 */
function composite(top, alpha, bottom) {
  return /** @type {[number, number, number]} */ (
    top.map((t, i) => Math.round(t * alpha + bottom[i] * (1 - alpha)))
  );
}

/** @param {[number, number, number]} a @param {[number, number, number]} b */
function rgbDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * @typedef {{ id: string, level: 'fail' | 'warn', message: string }} Finding
 */

/**
 * @param {string} theme
 * @param {string} mode
 * @param {Map<string, string>} block
 * @param {Finding[]} findings
 * @param {string[]} notes
 */
function validateColorRelationships(theme, mode, block, findings, notes) {
  /** @type {Map<string, [number, number, number]>} */
  const colors = new Map();
  for (const [prop, value] of block) {
    if (!prop.startsWith('--color-')) {
      continue;
    }
    const token = prop.slice('--color-'.length);
    if (CONTRAST_EXEMPT_COLOR_TOKENS.includes(prop)) {
      continue;
    }
    const rgb = parseHex(value);
    if (rgb === null) {
      notes.push(`${theme} (${mode}): skipping non-hex ${prop} value "${value}"`);
      continue;
    }
    colors.set(token, rgb);
  }

  /** @param {string} check */
  const findingId = (check) => `${theme}.${mode}.${check}`;
  /** @param {string} token */
  const getColor = (token) => colors.get(token);

  /**
   * @param {'fail' | 'warn'} level
   * @param {string} check
   * @param {string} fgToken
   * @param {string} bgToken
   * @param {number} min
   */
  const checkContrast = (level, check, fgToken, bgToken, min) => {
    const fg = getColor(fgToken);
    const bg = getColor(bgToken);
    if (!fg || !bg) {
      return;
    }
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) {
      findings.push({
        id: findingId(check),
        level,
        message: `${theme} (${mode}): ${fgToken} vs ${bgToken} is ${ratio.toFixed(2)}:1 (needs ${min}:1)`,
      });
    }
  };

  for (const surface of [
    'background',
    'surface',
    'surface-elevated',
    'surface-sunken',
    'surface-overlay',
  ]) {
    checkContrast(
      'fail',
      `wcag-text.foreground-on-${surface}`,
      'foreground',
      surface,
      MIN_TEXT_CONTRAST_RATIO,
    );
  }
  for (const surface of ['surface', 'surface-elevated']) {
    checkContrast(
      'fail',
      `wcag-text.muted-foreground-on-${surface}`,
      'muted-foreground',
      surface,
      MIN_TEXT_CONTRAST_RATIO,
    );
    checkContrast(
      'fail',
      `wcag-text.accent-foreground-on-${surface}`,
      'accent-foreground',
      surface,
      MIN_TEXT_CONTRAST_RATIO,
    );
  }

  for (const hue of ALL_HUES) {
    checkContrast(
      'fail',
      `wcag-text.${hue}-text-on-${hue}`,
      `${hue}-text`,
      hue,
      MIN_TEXT_CONTRAST_RATIO,
    );
  }

  for (const hue of STATUS_HUES) {
    checkContrast('fail', `wcag-text.${hue}-on-surface`, hue, 'surface', MIN_TEXT_CONTRAST_RATIO);
    checkContrast(
      'fail',
      `wcag-text.${hue}-on-surface-elevated`,
      hue,
      'surface-elevated',
      MIN_TEXT_CONTRAST_RATIO,
    );
  }

  const error = getColor('error');
  const surface = getColor('surface');
  if (error && surface) {
    const tinted = composite(error, ERROR_TINT_ALPHA, surface);
    const ratio = contrastRatio(error, tinted);
    if (ratio < MIN_TEXT_CONTRAST_RATIO) {
      findings.push({
        id: findingId('wcag-text.error-on-error-composite'),
        level: 'fail',
        message: `${theme} (${mode}): error vs error@10%-over-surface is ${ratio.toFixed(2)}:1 (needs ${MIN_TEXT_CONTRAST_RATIO}:1)`,
      });
    }
  }
  checkContrast(
    'fail',
    'wcag-text.error-on-input-invalid',
    'error',
    'input-invalid',
    MIN_TEXT_CONTRAST_RATIO,
  );

  for (const s of ['background', 'surface', 'surface-elevated', 'surface-overlay']) {
    checkContrast(
      'fail',
      `wcag-nontext.border-focus-vs-${s}`,
      'border-focus',
      s,
      MIN_NON_TEXT_CONTRAST_RATIO,
    );
  }

  for (const bgToken of [...ALL_HUES, 'surface']) {
    checkContrast(
      'fail',
      `wcag-nontext.spinner-vs-${bgToken}`,
      'spinner',
      bgToken,
      MIN_NON_TEXT_CONTRAST_RATIO,
    );
  }
  checkContrast(
    'fail',
    'wcag-nontext.spinner-vs-skeleton',
    'spinner',
    'skeleton',
    MIN_NON_TEXT_CONTRAST_RATIO,
  );

  checkContrast('fail', 'ds.primary-vs-surface', 'primary', 'surface', MIN_NON_TEXT_CONTRAST_RATIO);

  checkContrast(
    'fail',
    'ds.border-error-vs-input-invalid',
    'border-error',
    'input-invalid',
    MIN_NON_TEXT_CONTRAST_RATIO,
  );
  checkContrast(
    'fail',
    'ds.border-success-vs-input-valid',
    'border-success',
    'input-valid',
    MIN_NON_TEXT_CONTRAST_RATIO,
  );

  const selected = getColor('surface-selected');
  if (selected && surface) {
    const ratio = contrastRatio(selected, surface);
    const distance = rgbDistance(selected, surface);
    if (ratio < MIN_SELECTED_CONTRAST_RATIO && distance < MIN_SELECTED_RGB_DISTANCE) {
      findings.push({
        id: findingId('ds.surface-selected-delta'),
        level: 'fail',
        message: `${theme} (${mode}): surface-selected is indistinguishable from surface (${ratio.toFixed(2)}:1, ${distance.toFixed(0)} RGB apart)`,
      });
    }
  }
  checkContrast(
    'fail',
    'ds.primary-vs-surface-selected',
    'primary',
    'surface-selected',
    MIN_NON_TEXT_CONTRAST_RATIO,
  );

  /** @type {Array<[string, string, 'lighter' | 'darker']>} */
  const ladderSteps =
    mode === 'dark'
      ? [
          ['background', 'surface', 'lighter'],
          ['surface', 'surface-elevated', 'lighter'],
        ]
      : [
          ['background', 'surface', 'darker'],
          ['surface', 'surface-elevated', 'lighter'],
        ];
  for (const [fromToken, toToken, direction] of ladderSteps) {
    const from = getColor(fromToken);
    const to = getColor(toToken);
    if (!from || !to) {
      continue;
    }
    const fromL = relativeLuminance(from);
    const toL = relativeLuminance(to);
    const orderedOk = direction === 'lighter' ? toL > fromL : toL < fromL;
    const stepRatio = contrastRatio(from, to);
    if (!orderedOk || stepRatio < MIN_SURFACE_LADDER_STEP_RATIO) {
      findings.push({
        id: findingId(`ds.ladder.${fromToken}-to-${toToken}`),
        level: 'fail',
        message: `${theme} (${mode}): ladder step ${fromToken} -> ${toToken} must go ${direction} with >= ${MIN_SURFACE_LADDER_STEP_RATIO}:1 step (got ${orderedOk ? '' : 'wrong direction, '}${stepRatio.toFixed(3)}:1)`,
      });
    }
  }

  for (let i = 0; i < ALL_HUES.length; i++) {
    for (let j = i + 1; j < ALL_HUES.length; j++) {
      const a = getColor(ALL_HUES[i]);
      const b = getColor(ALL_HUES[j]);
      if (!a || !b) {
        continue;
      }
      const distance = rgbDistance(a, b);
      if (distance < MIN_HUE_RGB_DISTANCE) {
        findings.push({
          id: findingId(`hue-distance.${ALL_HUES[i]}-vs-${ALL_HUES[j]}`),
          level: 'warn',
          message: `${theme} (${mode}): ${ALL_HUES[i]} and ${ALL_HUES[j]} are ${distance.toFixed(0)} RGB apart (may read as one hue)`,
        });
      }
    }
  }

  checkContrast(
    'warn',
    'adv.text-disabled-vs-input-disabled',
    'text-disabled',
    'input-disabled',
    MIN_NON_TEXT_CONTRAST_RATIO,
  );
  checkContrast('warn', 'adv.border-vs-surface', 'border', 'surface', MIN_NON_TEXT_CONTRAST_RATIO);
  checkContrast(
    'warn',
    'adv.border-strong-vs-surface',
    'border-strong',
    'surface',
    MIN_NON_TEXT_CONTRAST_RATIO,
  );
}

/**
 * @param {string} [rootDir]
 * @returns {{
 *   errors: string[],
 *   warnings: string[],
 *   notes: string[],
 *   waived: number,
 *   staleWaivers: string[],
 *   unwaivedFindings: Finding[],
 * }}
 */
export function validateContrast(rootDir = projectRoot) {
  const themesDir = path.join(rootDir, 'src', 'lib', 'themes', 'css');
  const baselinePath = path.join(rootDir, 'scripts', 'theme-contrast-baseline.json');

  /** @type {Map<string, string>} */
  const waivers = new Map();
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    for (const entry of baseline.waivers ?? []) {
      waivers.set(entry.id, entry.reason);
    }
  }

  /** @type {Finding[]} */
  const findings = [];
  /** @type {string[]} */
  const notes = [];

  const themes = readdirSync(themesDir)
    .filter((file) => file.endsWith('.css'))
    .map((file) => file.slice(0, -4))
    .sort();

  for (const themeName of themes) {
    const content = readFileSync(path.join(themesDir, `${themeName}.css`), 'utf8');
    const parsed = parseThemeFile(content, themeName);
    if (parsed.light) {
      validateColorRelationships(themeName, 'light', parsed.light, findings, notes);
    }
    if (parsed.dark) {
      validateColorRelationships(themeName, 'dark', parsed.dark, findings, notes);
    }
  }

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  let waived = 0;
  /** @type {Set<string>} */
  const matchedWaivers = new Set();
  /** @type {Finding[]} */
  const unwaivedFindings = [];

  for (const finding of findings) {
    if (waivers.has(finding.id)) {
      matchedWaivers.add(finding.id);
      waived += 1;
      continue;
    }
    unwaivedFindings.push(finding);
    if (finding.level === 'fail') {
      errors.push(finding.message);
    } else {
      warnings.push(finding.message);
    }
  }

  const staleWaivers = [...waivers.keys()].filter((id) => !matchedWaivers.has(id));

  return { errors, warnings, notes, waived, staleWaivers, unwaivedFindings };
}

function runCli() {
  console.log('Validating theme contrast relationships...');
  const result = validateContrast();

  for (const note of result.notes) {
    console.log(`note: ${note}`);
  }
  for (const warning of result.warnings) {
    console.warn(`warn: ${warning}`);
  }
  for (const stale of result.staleWaivers) {
    console.warn(`stale waiver (check now passes; remove it from the baseline): ${stale}`);
  }
  if (result.waived > 0) {
    console.log(`${result.waived} known failure(s) waived by the baseline.`);
  }

  if (result.errors.length > 0) {
    console.error(`\nContrast gate failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    console.error(
      '\nNew themes and regressions are not waivable; shipped debt belongs in scripts/theme-contrast-baseline.json with a reason.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('Contrast gate passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runCli();
}

export { BASELINE_PATH };
