#!/usr/bin/env node

/* eslint-disable curly, no-console */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRAST_EXEMPT_COLOR_TOKENS } from '../src/lib/themes/tokenContract.ts';
import { deltaEOk, grayscaleProjection, simulateMachado, srgbToOklch } from './color-math.js';
import { parseThemeFile } from './validate-themes.js';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const BASELINE_PATH = path.join(projectRoot, 'scripts', 'theme-contrast-baseline.json');
const WARN_BUDGET_PATH = path.join(projectRoot, 'scripts', 'theme-warn-budget.json');
const STATUS_HUES = ['success', 'warning', 'error', 'info'];
const ALL_HUES = ['primary', ...STATUS_HUES];
const CORE_SURFACES = [
  'background',
  'surface',
  'surface-elevated',
  'surface-sunken',
  'surface-overlay',
];
const MIN_TEXT = 4.5;
const MIN_NON_TEXT = 3;
const MIN_LADDER_RATIO = 1.03;
const MIN_SELECTED_RATIO = 1.1;
const MIN_SELECTED_RGB = 10;
/** @typedef {[number, number, number]} ColorTriplet */
/** @typedef {'fail' | 'warn'} FindingLevel */
/** @typedef {'light' | 'dark'} ThemeMode */
/** @typedef {(level: FindingLevel, family: string, check: string, foregroundToken: string, backgroundToken: string, threshold: number) => void} MinimumCheck */
/** @typedef {(family: string, check: string, foregroundToken: string, backgroundToken: string, threshold: number, level?: FindingLevel) => void} MaximumCheck */
/** @type {Record<ThemeMode, FindingLevel>} */
const HIGH_CONTRAST_LEVEL = { light: 'fail', dark: 'fail' };

/* §5 family map (one prefix per table row):
 * state-text-selected -> foreground/muted-foreground vs surface-selected
 * state-text-interaction -> foreground/muted-foreground vs surface-hover/active
 * hue-text-surfaces -> primary/status hues as text vs surface/hover/active
 *   Excludes status-vs-surface because wcag-text already enforces those pairs at fail level.
 * hue-label-interaction -> hue labels vs hue hover/active fills
 * hue-tint-composite -> hue text over real 10%/15% tint consumers
 *   Excludes error at 10% because wcag-text.error-on-error-composite already fails it.
 *   The 20% outline Button active consumer remains advisory.
 * label-polarity -> light/dark block on-color label polarity
 * grayscale-spread -> grayscale separation among solid hue fills
 * focus-selected -> border-focus vs surface-selected
 * border-anchor -> border-strong vs input-background/surface
 * input-surface-split -> input-background vs surface
 * hue-state-direction -> hue hover/active direction grammar
 * dark-active-depth -> dark hue active-fill luminance floor
 * hue-family-stability -> hue drift across hover/active states
 * selected-hover-separation -> selected vs hover perceptual separation
 * spinner-fill -> D0-deleted spinner-vs-fill row; emits no findings
 * surface-ladder-perceptual -> perceptual surface steps and overlay ordering
 * hue-distance -> ΔE-OK, CVD collapse, and primary/status separation
 * text-hierarchy -> muted upper bound and foreground/accent/muted ordering
 * disabled-text -> disabled text lower/upper contrast bounds
 * high-contrast -> theme-scoped High Contrast override table
 * report-grouping -> tooling-only row; it emits no finding IDs
 */
const FAMILY = {
  selectedText: 'state-text-selected',
  interactionText: 'state-text-interaction',
  hueText: 'hue-text-surfaces',
  hueLabels: 'hue-label-interaction',
  hueTint: 'hue-tint-composite',
  polarity: 'label-polarity',
  grayscale: 'grayscale-spread',
  focusSelected: 'focus-selected',
  borderAnchor: 'border-anchor',
  inputSplit: 'input-surface-split',
  hueDirection: 'hue-state-direction',
  darkDepth: 'dark-active-depth',
  hueStability: 'hue-family-stability',
  selectedHover: 'selected-hover-separation',
  spinnerFill: 'spinner-fill',
  ladder: 'surface-ladder-perceptual',
  hueDistance: 'hue-distance',
  hierarchy: 'text-hierarchy',
  disabled: 'disabled-text',
  highContrast: 'high-contrast',
  reportGrouping: 'report-grouping',
};

/** @type {Record<string, { default: FindingLevel, advisory?: FindingLevel }>} */
const FAMILY_LEVEL = {
  [FAMILY.selectedText]: { default: 'fail' },
  [FAMILY.interactionText]: { default: 'fail' },
  [FAMILY.hueText]: { default: 'fail', advisory: 'warn' },
  [FAMILY.hueLabels]: { default: 'fail' },
  [FAMILY.hueTint]: { default: 'fail', advisory: 'warn' },
  [FAMILY.polarity]: { default: 'fail' },
  [FAMILY.focusSelected]: { default: 'fail' },
  [FAMILY.borderAnchor]: { default: 'fail' },
  [FAMILY.darkDepth]: { default: 'fail' },
  [FAMILY.hierarchy]: { default: 'fail' },
  [FAMILY.grayscale]: { default: 'fail', advisory: 'warn' },
  [FAMILY.hueDirection]: { default: 'fail' },
  [FAMILY.selectedHover]: { default: 'fail' },
  [FAMILY.disabled]: { default: 'fail', advisory: 'warn' },
};

/** @param {string} family @param {'default' | 'advisory'} [subcheck] @returns {FindingLevel} */
const levelFor = (family, subcheck = 'default') => FAMILY_LEVEL[family]?.[subcheck] ?? 'warn';

/** @param {string} value @returns {[number, number, number] | null} */
function parseHex(value) {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map((value) => value + value).join('');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** @param {[number, number, number]} rgb */
function relativeLuminance([r, g, b]) {
  /** @param {number} value */
  const linear = (value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** @param {[number, number, number]} first @param {[number, number, number]} second */
function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** @param {[number, number, number]} top @param {number} alpha @param {[number, number, number]} bottom @returns {[number, number, number]} */
function composite(top, alpha, bottom) {
  return /** @type {[number, number, number]} */ (
    top.map((channel, index) => Math.round(channel * alpha + bottom[index] * (1 - alpha)))
  );
}

/** @param {[number, number, number]} first @param {[number, number, number]} second */
function rgbDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

/** @param {number} first @param {number} second */
function angularDistance(first, second) {
  if (!Number.isFinite(first) || !Number.isFinite(second)) return 0;
  const distance = Math.abs(first - second) % 360;
  return Math.min(distance, 360 - distance);
}

/** @typedef {{ id: string, family: string, level: FindingLevel, message: string, theme: string, mode: ThemeMode }} Finding */

/** @param {string} theme @param {ThemeMode} mode @param {Map<string, string>} block @param {Finding[]} findings @param {string[]} notes */
function validateColorRelationships(theme, mode, block, findings, notes) {
  /** @type {Map<string, [number, number, number]>} */
  const colors = new Map();
  for (const [property, value] of block) {
    if (!property.startsWith('--color-') || CONTRAST_EXEMPT_COLOR_TOKENS.includes(property))
      continue;
    const rgb = parseHex(value);
    if (rgb) colors.set(property.slice('--color-'.length), rgb);
    else notes.push(`${theme} (${mode}): skipping non-hex ${property} value "${value}"`);
  }
  /** @param {string} token */
  const get = (token) => colors.get(token);
  /** @param {FindingLevel} level @param {string} family @param {string} check @param {string} message */
  const add = (level, family, check, message) =>
    findings.push({
      id: `${theme}.${mode}.${check}`,
      family,
      level,
      message: `${theme} (${mode}): ${message}`,
      theme,
      mode,
    });
  /** @type {MinimumCheck} */
  const minimum = (level, family, check, foregroundToken, backgroundToken, threshold) => {
    const foreground = get(foregroundToken);
    const background = get(backgroundToken);
    if (!foreground || !background) return;
    const ratio = contrastRatio(foreground, background);
    if (ratio < threshold)
      add(
        level,
        family,
        check,
        `${foregroundToken} vs ${backgroundToken} is ${ratio.toFixed(2)}:1 (needs ${threshold}:1)`,
      );
  };
  /** @type {MaximumCheck} */
  const maximum = (family, check, foregroundToken, backgroundToken, threshold, level = 'warn') => {
    const foreground = get(foregroundToken);
    const background = get(backgroundToken);
    if (!foreground || !background) return;
    const ratio = contrastRatio(foreground, background);
    if (ratio > threshold)
      add(
        level,
        family,
        check,
        `${foregroundToken} vs ${backgroundToken} is ${ratio.toFixed(2)}:1 (maximum ${threshold}:1)`,
      );
  };

  for (const surface of CORE_SURFACES)
    minimum(
      'fail',
      'wcag-text',
      `wcag-text.foreground-on-${surface}`,
      'foreground',
      surface,
      MIN_TEXT,
    );
  for (const surface of ['surface', 'surface-elevated']) {
    minimum(
      'fail',
      'wcag-text',
      `wcag-text.muted-foreground-on-${surface}`,
      'muted-foreground',
      surface,
      MIN_TEXT,
    );
    minimum(
      'fail',
      'wcag-text',
      `wcag-text.accent-foreground-on-${surface}`,
      'accent-foreground',
      surface,
      MIN_TEXT,
    );
  }
  for (const hue of ALL_HUES)
    minimum('fail', 'wcag-text', `wcag-text.${hue}-text-on-${hue}`, `${hue}-text`, hue, MIN_TEXT);
  for (const hue of STATUS_HUES)
    for (const surface of ['surface', 'surface-elevated'])
      minimum('fail', 'wcag-text', `wcag-text.${hue}-on-${surface}`, hue, surface, MIN_TEXT);

  const error = get('error');
  const surface = get('surface');
  const surfaceHover = get('surface-hover');
  const surfaceStateDirection =
    surface && surfaceHover
      ? srgbToOklch(surfaceHover)[0] > srgbToOklch(surface)[0]
        ? 'lighter'
        : 'darker'
      : null;
  if (error && surface) {
    const ratio = contrastRatio(error, composite(error, 0.1, surface));
    if (ratio < MIN_TEXT)
      add(
        'fail',
        'wcag-text',
        'wcag-text.error-on-error-composite',
        `error vs error@10%-over-surface is ${ratio.toFixed(2)}:1 (needs ${MIN_TEXT}:1)`,
      );
  }
  minimum(
    'fail',
    'wcag-text',
    'wcag-text.error-on-input-invalid',
    'error',
    'input-invalid',
    MIN_TEXT,
  );
  for (const target of ['background', 'surface', 'surface-elevated', 'surface-overlay'])
    minimum(
      'fail',
      'wcag-nontext',
      `wcag-nontext.border-focus-vs-${target}`,
      'border-focus',
      target,
      MIN_NON_TEXT,
    );
  minimum(
    'fail',
    'wcag-nontext',
    'wcag-nontext.spinner-vs-surface',
    'spinner',
    'surface',
    MIN_NON_TEXT,
  );
  minimum(
    'fail',
    'wcag-nontext',
    'wcag-nontext.spinner-vs-skeleton',
    'spinner',
    'skeleton',
    MIN_NON_TEXT,
  );
  minimum('fail', 'ds', 'ds.primary-vs-surface', 'primary', 'surface', MIN_NON_TEXT);
  minimum(
    'fail',
    'ds',
    'ds.border-error-vs-input-invalid',
    'border-error',
    'input-invalid',
    MIN_NON_TEXT,
  );
  minimum(
    'fail',
    'ds',
    'ds.border-success-vs-input-valid',
    'border-success',
    'input-valid',
    MIN_NON_TEXT,
  );

  const selected = get('surface-selected');
  if (selected && surface) {
    const ratio = contrastRatio(selected, surface);
    const distance = rgbDistance(selected, surface);
    if (ratio < MIN_SELECTED_RATIO && distance < MIN_SELECTED_RGB)
      add(
        'fail',
        'ds',
        'ds.surface-selected-delta',
        `surface-selected is indistinguishable from surface (${ratio.toFixed(2)}:1, ${distance.toFixed(0)} RGB apart)`,
      );
  }
  minimum(
    'fail',
    'ds',
    'ds.primary-vs-surface-selected',
    'primary',
    'surface-selected',
    MIN_NON_TEXT,
  );
  /** @type {Array<[string, string, 'lighter' | 'darker']>} */
  const existingLadder =
    mode === 'dark'
      ? [
          ['background', 'surface', 'lighter'],
          ['surface', 'surface-elevated', 'lighter'],
        ]
      : [
          ['background', 'surface', 'darker'],
          ['surface', 'surface-elevated', 'lighter'],
        ];
  for (const [fromToken, toToken, direction] of existingLadder) {
    const from = get(fromToken);
    const to = get(toToken);
    if (!from || !to) continue;
    const ordered =
      direction === 'lighter'
        ? relativeLuminance(to) > relativeLuminance(from)
        : relativeLuminance(to) < relativeLuminance(from);
    const ratio = contrastRatio(from, to);
    if (!ordered || ratio < MIN_LADDER_RATIO)
      add(
        'fail',
        'ds',
        `ds.ladder.${fromToken}-to-${toToken}`,
        `ladder step ${fromToken} -> ${toToken} must go ${direction} with >= ${MIN_LADDER_RATIO}:1 step (got ${ordered ? '' : 'wrong direction, '}${ratio.toFixed(3)}:1)`,
      );
  }

  for (const token of ['foreground', 'muted-foreground']) {
    minimum(
      levelFor(FAMILY.selectedText),
      FAMILY.selectedText,
      `${FAMILY.selectedText}.${token}-on-surface-selected`,
      token,
      'surface-selected',
      MIN_TEXT,
    );
    minimum(
      levelFor(FAMILY.interactionText),
      FAMILY.interactionText,
      `${FAMILY.interactionText}.${token}-on-surface-hover`,
      token,
      'surface-hover',
      MIN_TEXT,
    );
    minimum(
      levelFor(FAMILY.interactionText),
      FAMILY.interactionText,
      `${FAMILY.interactionText}.${token}-on-surface-active`,
      token,
      'surface-active',
      MIN_TEXT,
    );
  }

  for (const hue of ALL_HUES) {
    const hueTextTargets =
      hue === 'primary'
        ? ['surface', 'surface-hover', 'surface-active']
        : ['surface-hover', 'surface-active'];
    for (const target of hueTextTargets)
      minimum(
        levelFor(FAMILY.hueText, target === 'surface-active' ? 'advisory' : 'default'),
        FAMILY.hueText,
        `${FAMILY.hueText}.${hue}-on-${target}${target === 'surface-active' ? '-advisory' : ''}`,
        hue,
        target,
        MIN_TEXT,
      );
    for (const state of ['hover', 'active'])
      minimum(
        levelFor(FAMILY.hueLabels),
        FAMILY.hueLabels,
        `${FAMILY.hueLabels}.${hue}-text-on-${hue}-${state}`,
        `${hue}-text`,
        `${hue}-${state}`,
        MIN_TEXT,
      );
    const base = get(hue);
    if (base && surface) {
      /** @type {Array<[number, string, 'default' | 'advisory']>} */
      const consumers = hue === 'error' ? [] : [[0.1, 'ten-percent', 'default']];
      if (hue !== 'error') consumers.push([0.15, 'catalog-badge', 'default']);
      consumers.push([0.2, 'outline-active-advisory', 'advisory']);
      for (const [alpha, consumer, subcheck = 'default'] of consumers) {
        const ratio = contrastRatio(base, composite(base, alpha, surface));
        if (ratio < MIN_TEXT)
          add(
            levelFor(FAMILY.hueTint, subcheck),
            FAMILY.hueTint,
            `${FAMILY.hueTint}.${hue}-on-${consumer}`,
            `${hue} vs ${hue}@${Math.round(alpha * 100)}%-over-surface is ${ratio.toFixed(2)}:1 (needs ${MIN_TEXT}:1)`,
          );
      }
    }
    const label = get(`${hue}-text`);
    if (label) {
      const labelL = srgbToOklch(label)[0];
      if (mode === 'dark' ? labelL >= 0.5 : labelL < 0.5)
        add(
          levelFor(FAMILY.polarity),
          FAMILY.polarity,
          `${FAMILY.polarity}.${hue}-text`,
          `${hue}-text has ${mode === 'dark' ? 'white-family' : 'black-family'} polarity in a ${mode} block`,
        );
    }
    const hover = get(`${hue}-hover`);
    const active = get(`${hue}-active`);
    if (!base || !hover || !active) continue;
    const baseL = srgbToOklch(base)[0];
    const hoverL = srgbToOklch(hover)[0];
    const activeL = srgbToOklch(active)[0];
    if (surfaceStateDirection !== null) {
      const exempt = mode === 'light' && baseL <= 0.45;
      const hoverDirectionOk =
        surfaceStateDirection === 'lighter' ? hoverL > baseL : hoverL < baseL;
      const activeDirectionOk = mode === 'light' ? activeL < hoverL : activeL < baseL;
      const directionOk = (exempt || hoverDirectionOk) && activeDirectionOk;
      if (!directionOk)
        add(
          levelFor(FAMILY.hueDirection),
          FAMILY.hueDirection,
          `${FAMILY.hueDirection}.${hue}`,
          `${hue} hover does not follow the ${surfaceStateDirection} surface direction or active is not beyond hover (L ${baseL.toFixed(3)} -> ${hoverL.toFixed(3)} -> ${activeL.toFixed(3)})`,
        );
    }
    if (mode === 'dark' && relativeLuminance(active) < 0.185)
      add(
        levelFor(FAMILY.darkDepth),
        FAMILY.darkDepth,
        `${FAMILY.darkDepth}.${hue}-active`,
        `${hue}-active luminance is ${relativeLuminance(active).toFixed(3)} (needs >= 0.185)`,
      );
    const baseHue = srgbToOklch(base)[2];
    /** @type {Array<[string, ColorTriplet]>} */
    const hueStates = [
      ['hover', hover],
      ['active', active],
    ];
    for (const [state, color] of hueStates) {
      const drift = angularDistance(baseHue, srgbToOklch(color)[2]);
      if (drift > 25)
        add(
          'warn',
          FAMILY.hueStability,
          `${FAMILY.hueStability}.${hue}-${state}`,
          `${hue}-${state} hue drifts ${drift.toFixed(1)}° from ${hue} (maximum 25°)`,
        );
    }
  }

  for (let firstIndex = 0; firstIndex < ALL_HUES.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < ALL_HUES.length; secondIndex += 1) {
      const firstToken = ALL_HUES[firstIndex];
      const secondToken = ALL_HUES[secondIndex];
      const first = get(firstToken);
      const second = get(secondToken);
      if (!first || !second) continue;
      const pair = `${firstToken}-vs-${secondToken}`;
      const grayscaleDelta = deltaEOk(grayscaleProjection(first), grayscaleProjection(second));
      if (grayscaleDelta < 0.025)
        add(
          levelFor(FAMILY.grayscale, pair === 'primary-vs-warning' ? 'default' : 'advisory'),
          FAMILY.grayscale,
          `${FAMILY.grayscale}.${pair}${pair === 'primary-vs-warning' ? '' : '-advisory'}`,
          `${pair} grayscale ΔE-OK is ${grayscaleDelta.toFixed(3)} (needs >= 0.025${pair === 'primary-vs-warning' ? '' : ', advisory pair'})`,
        );
      const delta = deltaEOk(first, second);
      if (delta < 0.09)
        add(
          'warn',
          FAMILY.hueDistance,
          `${FAMILY.hueDistance}.${pair}`,
          `${pair} ΔE-OK is ${delta.toFixed(3)} (needs >= 0.09)`,
        );
      for (const deficiency of /** @type {Array<'protanopia' | 'deuteranopia'>} */ ([
        'protanopia',
        'deuteranopia',
      ])) {
        const simulated = deltaEOk(
          simulateMachado(first, deficiency),
          simulateMachado(second, deficiency),
        );
        if (simulated < 0.06)
          add(
            'warn',
            FAMILY.hueDistance,
            `${FAMILY.hueDistance}.${pair}-${deficiency}`,
            `${pair} ${deficiency} ΔE-OK is ${simulated.toFixed(3)} (needs >= 0.06)`,
          );
      }
      if (firstToken !== 'primary') continue;
      if (delta < 0.12)
        add(
          'warn',
          FAMILY.hueDistance,
          `${FAMILY.hueDistance}.${pair}-primary-status`,
          `${pair} separation ΔE-OK is ${delta.toFixed(3)} (needs >= 0.12)`,
        );
    }
  }

  minimum(
    levelFor(FAMILY.focusSelected),
    FAMILY.focusSelected,
    `${FAMILY.focusSelected}.border-focus-vs-surface-selected`,
    'border-focus',
    'surface-selected',
    3,
  );
  for (const target of ['input-background', 'surface'])
    minimum(
      levelFor(FAMILY.borderAnchor),
      FAMILY.borderAnchor,
      `${FAMILY.borderAnchor}.border-strong-vs-${target}`,
      'border-strong',
      target,
      3,
    );
  minimum(
    'warn',
    FAMILY.inputSplit,
    `${FAMILY.inputSplit}.input-background-vs-surface`,
    'input-background',
    'surface',
    1.06,
  );
  const hover = get('surface-hover');
  if (selected && hover && deltaEOk(selected, hover) < 0.03)
    add(
      levelFor(FAMILY.selectedHover),
      FAMILY.selectedHover,
      `${FAMILY.selectedHover}.surface-selected-vs-surface-hover`,
      `surface-selected vs surface-hover ΔE-OK is ${deltaEOk(selected, hover).toFixed(3)} (needs >= 0.030)`,
    );

  /** @type {Array<[string, string, 'lighter' | 'darker', number]>} */
  const perceptualLadder = [
    ['background', 'surface', mode === 'dark' ? 'lighter' : 'darker', 0.015],
    ['surface', 'surface-elevated', 'lighter', 0.015],
    ['surface-elevated', 'surface-overlay', 'lighter', 0],
  ];
  for (const [fromToken, toToken, direction, stepMinimum] of perceptualLadder) {
    const from = get(fromToken);
    const to = get(toToken);
    if (!from || !to) continue;
    const fromL = srgbToOklch(from)[0];
    const toL = srgbToOklch(to)[0];
    const ordered = direction === 'lighter' ? toL > fromL : toL < fromL;
    const step = Math.abs(toL - fromL);
    if (!ordered || step < stepMinimum)
      add(
        'warn',
        FAMILY.ladder,
        `${FAMILY.ladder}.${fromToken}-to-${toToken}`,
        `${fromToken} -> ${toToken} must go ${direction}${stepMinimum ? ` with OKLCH-L step >= ${stepMinimum.toFixed(3)}` : ''} (got ${step.toFixed(3)}${ordered ? '' : ', wrong direction'})`,
      );
  }

  maximum(
    FAMILY.hierarchy,
    `${FAMILY.hierarchy}.muted-foreground-on-surface-maximum`,
    'muted-foreground',
    'surface',
    theme === 'high-contrast' ? 10 : 8,
    levelFor(FAMILY.hierarchy),
  );
  const foreground = get('foreground');
  const accent = get('accent-foreground');
  const muted = get('muted-foreground');
  if (foreground && accent && muted) {
    const [foregroundL, accentL, mutedL] = [foreground, accent, muted].map(
      (color) => srgbToOklch(color)[0],
    );
    const ordered =
      mode === 'light'
        ? foregroundL < accentL && accentL < mutedL
        : foregroundL > accentL && accentL > mutedL;
    if (!ordered)
      add(
        levelFor(FAMILY.hierarchy),
        FAMILY.hierarchy,
        `${FAMILY.hierarchy}.foreground-accent-muted-order`,
        `foreground -> accent-foreground -> muted-foreground L is not monotone (${foregroundL.toFixed(3)} -> ${accentL.toFixed(3)} -> ${mutedL.toFixed(3)})`,
      );
  }
  for (const target of ['surface', 'surface-disabled', 'primary-disabled']) {
    minimum(
      levelFor(FAMILY.disabled),
      FAMILY.disabled,
      `${FAMILY.disabled}.text-disabled-vs-${target}-minimum`,
      'text-disabled',
      target,
      3.2,
    );
    if (theme !== 'high-contrast')
      maximum(
        FAMILY.disabled,
        `${FAMILY.disabled}.text-disabled-vs-${target}-maximum-advisory`,
        'text-disabled',
        target,
        4.5,
      );
  }
  minimum(
    'warn',
    'legacy-disabled-input',
    'adv.text-disabled-vs-input-disabled',
    'text-disabled',
    'input-disabled',
    MIN_NON_TEXT,
  );
  minimum(
    'warn',
    'legacy-border-surface',
    'adv.border-vs-surface',
    'border',
    'surface',
    MIN_NON_TEXT,
  );

  if (theme === 'high-contrast') validateHighContrast(mode, minimum, maximum);
}

/** @param {ThemeMode} mode @param {MinimumCheck} minimum @param {MaximumCheck} maximum */
function validateHighContrast(mode, minimum, maximum) {
  const family = FAMILY.highContrast;
  const level = HIGH_CONTRAST_LEVEL[mode];
  for (const surface of [...CORE_SURFACES, 'surface-hover', 'surface-active', 'surface-selected'])
    minimum(level, family, `${family}.body-on-${surface}`, 'foreground', surface, 12);
  for (const surface of [
    'surface',
    'surface-elevated',
    'surface-hover',
    'surface-active',
    'surface-selected',
  ])
    minimum(level, family, `${family}.muted-on-${surface}`, 'muted-foreground', surface, 7);
  maximum(family, `${family}.muted-on-surface-maximum`, 'muted-foreground', 'surface', 10, level);
  for (const hue of STATUS_HUES)
    for (const surface of ['surface', 'surface-elevated', 'surface-hover', 'surface-active'])
      minimum(level, family, `${family}.${hue}-text-role-on-${surface}`, hue, surface, 7);
  for (const surface of ['background', 'surface', 'surface-elevated', 'surface-overlay']) {
    minimum(level, family, `${family}.focus-on-${surface}`, 'border-focus', surface, 7);
    for (const hue of ALL_HUES)
      minimum(
        level,
        family,
        `${family}.${hue}-fill-on-${surface}`,
        hue,
        surface,
        surface === 'surface-overlay' ? 4.5 : 6,
      );
  }
  for (const hue of ALL_HUES)
    for (const state of ['', '-hover', '-active'])
      minimum(
        level,
        family,
        `${family}.${hue}-label-on-${hue}${state}`,
        `${hue}-text`,
        `${hue}${state}`,
        6,
      );
  for (const target of ['surface', 'surface-disabled', 'primary-disabled'])
    minimum(level, family, `${family}.text-disabled-on-${target}`, 'text-disabled', target, 6);
  for (const target of ['surface', 'input-background'])
    minimum(level, family, `${family}.border-strong-on-${target}`, 'border-strong', target, 4.5);
}

/** @param {Finding[]} findings @param {Set<string>} waivedIds @param {Record<string, number>} budget */
export function findWarnBudgetViolations(findings, waivedIds, budget) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const finding of findings) {
    if (finding.level !== 'warn' || waivedIds.has(finding.id)) continue;
    counts[finding.family] = (counts[finding.family] ?? 0) + 1;
  }
  const violations = Object.entries(counts)
    .filter(([family, actual]) => budget[family] === undefined || actual > budget[family])
    .map(([family, actual]) => ({ family, actual, allowed: budget[family] }));
  return { counts, violations };
}

/** @param {Finding[]} findings @param {boolean} [includeMode] */
function groupFindings(findings, includeMode = false) {
  /** @type {Record<string, Record<string, number>>} */
  const groups = {};
  for (const finding of findings) {
    const key = includeMode ? `${finding.theme}.${finding.mode}` : finding.theme;
    groups[key] ??= {};
    groups[key][finding.family] = (groups[key][finding.family] ?? 0) + 1;
  }
  return groups;
}

/** @param {string} [rootDir] */
export function validateContrast(rootDir = projectRoot) {
  const themesDir = path.join(rootDir, 'src', 'lib', 'themes', 'css');
  const baselinePath = path.join(rootDir, 'scripts', 'theme-contrast-baseline.json');
  const budgetPath = path.join(rootDir, 'scripts', 'theme-warn-budget.json');
  /** @type {{ waivers?: Array<{ id: string, reason: string }> }} */
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : { waivers: [] };
  /** @type {Record<string, number>} */
  const budget = existsSync(budgetPath)
    ? (JSON.parse(readFileSync(budgetPath, 'utf8')).families ?? {})
    : {};
  const waivers = new Map((baseline.waivers ?? []).map((entry) => [entry.id, entry.reason]));
  /** @type {Finding[]} */
  const findings = [];
  /** @type {string[]} */
  const notes = [];
  for (const file of readdirSync(themesDir)
    .filter((name) => name.endsWith('.css'))
    .sort()) {
    const theme = file.slice(0, -4);
    const parsed = parseThemeFile(readFileSync(path.join(themesDir, file), 'utf8'), theme);
    if (parsed.light) validateColorRelationships(theme, 'light', parsed.light, findings, notes);
    if (parsed.dark) validateColorRelationships(theme, 'dark', parsed.dark, findings, notes);
  }
  const matchedWaivers = new Set();
  const waivedFindings = [];
  const unwaivedFindings = [];
  for (const finding of findings) {
    if (waivers.has(finding.id)) {
      matchedWaivers.add(finding.id);
      waivedFindings.push(finding);
    } else unwaivedFindings.push(finding);
  }
  const errors = unwaivedFindings
    .filter((finding) => finding.level === 'fail')
    .map((finding) => finding.message);
  const warnings = unwaivedFindings
    .filter((finding) => finding.level === 'warn')
    .map((finding) => finding.message);
  const budgetResult = findWarnBudgetViolations(findings, matchedWaivers, budget);
  for (const violation of budgetResult.violations)
    errors.push(
      `warn budget exceeded for ${violation.family}: ${violation.actual} finding(s), committed ${violation.allowed ?? 'missing'}`,
    );
  if (waivedFindings.some((finding) => finding.family === FAMILY.highContrast))
    errors.push('high-contrast override findings cannot be waived');
  return {
    errors,
    warnings,
    notes,
    waived: matchedWaivers.size,
    staleWaivers: [...waivers.keys()].filter((id) => !matchedWaivers.has(id)),
    unwaivedFindings,
    budgetViolations: budgetResult.violations,
    warnCounts: budgetResult.counts,
    warningGroups: groupFindings(unwaivedFindings.filter((finding) => finding.level === 'warn')),
    warningModeGroups: groupFindings(
      unwaivedFindings.filter((finding) => finding.level === 'warn'),
      true,
    ),
    waiverGroups: groupFindings(waivedFindings),
  };
}

/** @param {string} label @param {Record<string, Record<string, number>>} groups */
function printGroups(label, groups) {
  console.log(`${label}:`);
  let total = 0;
  for (const group of Object.keys(groups).sort()) {
    for (const [family, count] of Object.entries(groups[group]).sort()) {
      console.log(`  ${group} × ${family}: ${count}`);
      total += count;
    }
  }
  console.log(`  total: ${total}`);
}

function runCli() {
  console.log('Validating theme contrast relationships...');
  const result = validateContrast();
  for (const note of result.notes) console.log(`note: ${note}`);
  printGroups('Baseline waivers', result.waiverGroups);
  printGroups('Warnings', result.warningGroups);
  for (const stale of result.staleWaivers)
    console.warn(`stale waiver (check now passes; remove it from the baseline): ${stale}`);
  if (result.errors.length > 0) {
    console.error(`\nContrast gate failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Contrast gate passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) runCli();

export { BASELINE_PATH, WARN_BUDGET_PATH };
