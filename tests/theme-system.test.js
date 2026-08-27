import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateThemes, parseThemeFile } from '../scripts/validate-themes.js';
import { validateContrast } from '../scripts/validate-contrast.js';
import {
  REQUIRED_COLOR_TOKENS,
  OPTIONAL_DIALS,
  allowedThemeProperties,
  REQUIRED_PACKAGE_SIDE_EFFECTS,
} from '../src/lib/themes/tokenContract.ts';

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
    expect(result.staleWaivers).toEqual([]);
  });

  test('preserves CSS side-effect imports during production builds', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.sideEffects).toEqual([...REQUIRED_PACKAGE_SIDE_EFFECTS]);
  });
});
