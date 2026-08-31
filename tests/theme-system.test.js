import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateThemes, parseThemeFile } from '../scripts/validate-themes.js';
import { findWarnBudgetViolations, validateContrast } from '../scripts/validate-contrast.js';
import {
  deltaEOk,
  grayscaleProjection,
  simulateMachado,
  srgbToOklch,
} from '../scripts/color-math.js';
import {
  REQUIRED_COLOR_TOKENS,
  OPTIONAL_DIALS,
  allowedThemeProperties,
  REQUIRED_PACKAGE_SIDE_EFFECTS,
} from '../src/lib/themes/tokenContract.ts';
import { AVAILABLE_THEMES } from '../src/lib/themes/themeUtils.ts';

const SWATCH_TOKENS = ['--color-primary', '--color-success', '--color-warning', '--color-info'];

describe('theme system', () => {
  test('discovers and validates all registered themes', () => {
    const result = validateThemes();

    expect(result.themes).toEqual([
      'developer-tool',
      'high-contrast',
      'indigo',
      'media-downloader',
      'media-gallery',
      'power-user',
      'terminal-dark',
      'torture',
    ]);
    expect(result.errors).toEqual([]);
  });

  test('maintains the complete theme token contract', () => {
    expect(REQUIRED_COLOR_TOKENS).toHaveLength(47);
    expect(new Set(REQUIRED_COLOR_TOKENS).size).toBe(REQUIRED_COLOR_TOKENS.length);
  });

  test('keeps every theme swatch aligned with its light semantic colors', () => {
    for (const [themeName, config] of Object.entries(AVAILABLE_THEMES)) {
      const content = readFileSync(`src/lib/themes/css/${themeName}.css`, 'utf8');
      const { errors, light } = parseThemeFile(content, themeName);

      expect(errors).toEqual([]);
      if (!light) {
        throw new Error(`${themeName}: missing light theme block`);
      }

      expect(config.swatch).toEqual(SWATCH_TOKENS.map((token) => light.get(token)));
    }
  });

  test('exposes exactly 15 optional non-color dials', () => {
    expect(Object.keys(OPTIONAL_DIALS)).toHaveLength(15);
  });

  test('allowlists every required color token', () => {
    const allowed = allowedThemeProperties();
    for (const token of REQUIRED_COLOR_TOKENS) {
      expect(allowed.has(`--color-${token}`)).toBe(true);
    }
    expect(allowed.has('color-scheme')).toBe(true);
  });

  test('rejects structural contract violations', () => {
    const bad = [
      '.theme-x { --color-primary: #fff !important; }',
      '.theme-x { --color-primary: url(https://evil.example/x); }',
      '.theme-x { --color-primary: \\75rl(https://evil.example/x); }',
      '@media (min-width: 600px) { .theme-x { --color-primary: #fff; } }',
      '.theme-x { .nested { color: red; } }',
      '.theme-x button { color: red; }',
      '.theme-x { --color-not-a-token: #fff; }',
      '.theme-x { padding: 4px; }',
    ];
    for (const content of bad) {
      const { errors } = parseThemeFile(content, 'x');
      expect(errors.length, content).toBeGreaterThan(0);
    }

    const good = parseThemeFile(
      '.theme-x { --color-primary: #fff; color-scheme: light; }\n.theme-x.dark { --color-primary: #000; }',
      'x',
    );
    expect(good.errors).toEqual([]);
    expect(good.light?.get('--color-primary')).toBe('#fff');
    expect(good.dark?.get('--color-primary')).toBe('#000');
  });

  test('passes the contrast gate with the checked-in baseline', () => {
    const result = validateContrast();
    expect(result.errors).toEqual([]);
    expect(result.budgetViolations).toEqual([]);
    expect(result.staleWaivers).toEqual([]);
  });

  test('enforces warning budgets after waivers', () => {
    /** @type {Parameters<typeof findWarnBudgetViolations>[0]} */
    const findings = [
      { id: 'a', family: 'example', level: 'warn', message: '', theme: 'test', mode: 'light' },
      { id: 'b', family: 'example', level: 'warn', message: '', theme: 'test', mode: 'light' },
      { id: 'c', family: 'example', level: 'fail', message: '', theme: 'test', mode: 'light' },
    ];

    expect(findWarnBudgetViolations(findings, new Set(), { example: 1 }).violations).toEqual([
      { family: 'example', actual: 2, allowed: 1 },
    ]);
    expect(findWarnBudgetViolations(findings, new Set(['b']), { example: 1 }).violations).toEqual(
      [],
    );
    expect(findWarnBudgetViolations([findings[0]], new Set(), {}).violations).toEqual([
      { family: 'example', actual: 1, allowed: undefined },
    ]);
  });

  test('keeps warning budgets as exact no-slack snapshots', () => {
    const budget = JSON.parse(readFileSync('scripts/theme-warn-budget.json', 'utf8')).families;
    const actual = validateContrast().warnCounts;

    expect(Object.keys(actual).filter((family) => !(family in budget))).toEqual([]);
    for (const [family, expected] of Object.entries(budget)) {
      expect(actual[family] ?? 0, family).toBe(expected);
    }
  });

  test('uses known OKLab and color-vision values', () => {
    /** @type {[number, number, number]} */
    const red = [255, 0, 0];
    /** @type {[number, number, number]} */
    const green = [0, 255, 0];
    /** @type {[number, number, number]} */
    const white = [255, 255, 255];
    /** @type {[number, number, number]} */
    const black = [0, 0, 0];
    const protanopiaRed = simulateMachado(red, 'protanopia');
    const grayscaleGreen = grayscaleProjection(green);

    expect(srgbToOklch(white)[0]).toBeCloseTo(1, 3);
    expect(srgbToOklch(black)[0]).toBeCloseTo(0, 3);
    expect(srgbToOklch(red)[0]).toBeCloseTo(0.627955, 5);
    expect(srgbToOklch(red)[2]).toBeCloseTo(29.23, 1);
    expect(deltaEOk(red, red)).toBe(0);
    expect(srgbToOklch(protanopiaRed)[2]).toBeGreaterThan(70);
    expect(srgbToOklch(protanopiaRed)[2]).toBeLessThan(120);
    expect(grayscaleGreen[0]).toBe(grayscaleGreen[1]);
    expect(grayscaleGreen[1]).toBe(grayscaleGreen[2]);
    expect(
      deltaEOk(simulateMachado(red, 'deuteranopia'), simulateMachado(green, 'deuteranopia')),
    ).toBeLessThan(deltaEOk(red, green));
  });

  test('preserves CSS side-effect imports during production builds', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.sideEffects).toEqual([...REQUIRED_PACKAGE_SIDE_EFFECTS]);
  });
});
