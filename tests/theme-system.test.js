import { describe, expect, test } from 'vitest';
import {
  REQUIRED_THEME_TOKENS,
  extractTokens,
  validateThemes,
} from '../scripts/validate-themes.js';

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
    ]);
    expect(result.errors).toEqual([]);
  });

  test('extracts semantic color tokens', () => {
    expect(extractTokens('--color-primary: #fff; --color-surface: #000;')).toEqual(
      new Set(['primary', 'surface']),
    );
  });

  test('maintains the complete theme token contract', () => {
    expect(REQUIRED_THEME_TOKENS).toHaveLength(47);
    expect(new Set(REQUIRED_THEME_TOKENS).size).toBe(REQUIRED_THEME_TOKENS.length);
  });
});
