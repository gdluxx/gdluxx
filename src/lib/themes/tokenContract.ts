/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// Keep this module compatible with Node's erasable TypeScript syntax.

export const REQUIRED_COLOR_TOKENS = [
  'accent-foreground',
  'background',
  'border',
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
  'scrim',
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
] as const;

export const CONTRACT_STAGE = {
  requireColorScheme: true,
  legacyShadowsAllowed: false,
  elevationRolesActive: true,
};

export const LEGACY_SHADOW_TOKENS = [
  '--shadow-2xs',
  '--shadow-xs',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-xl',
  '--shadow-2xl',
] as const;

export const ELEVATION_ROLE_TOKENS = [
  '--shadow-raised',
  '--shadow-floating',
  '--shadow-overlay',
] as const;

export const CONTRAST_EXEMPT_COLOR_TOKENS: string[] = ['--color-scrim'];

export const OPTIONAL_DIALS = {
  '--radius-control': { group: 'geometry', type: 'length', warnMaxPx: 24 },
  '--radius-surface': { group: 'geometry', type: 'length', warnMaxPx: 24 },
  '--radius-overlay': { group: 'geometry', type: 'length', warnMaxPx: 24 },
  '--radius-pill': { group: 'geometry', type: 'length' },
  '--stroke-base': { group: 'geometry', type: 'length', warnMinPx: 1, warnMaxPx: 3 },
  '--shadow-raised': { group: 'elevation', type: 'shadow' },
  '--shadow-floating': { group: 'elevation', type: 'shadow' },
  '--shadow-overlay': { group: 'elevation', type: 'shadow' },
  '--backdrop-filter': { group: 'elevation', type: 'filter', warnMaxBlurPx: 12 },
  '--focus-ring-width': {
    group: 'focus',
    type: 'length',
    // Project guardrail, not a WCAG requirement
    hardMinPx: 1,
    warnMinPx: 2,
  },
  '--focus-ring-offset': { group: 'focus', type: 'length' },
  '--motion-fast': { group: 'motion', type: 'duration', warnMaxMs: 400 },
  '--motion-base': { group: 'motion', type: 'duration', warnMaxMs: 400 },
  '--font-sans': { group: 'typography', type: 'font-stack' },
  '--font-mono': { group: 'typography', type: 'font-stack' },
} as const;

export const ALLOWED_BACKDROP_FILTER_FUNCTIONS = [
  'blur',
  'saturate',
  'brightness',
  'contrast',
  'grayscale',
  'sepia',
  'hue-rotate',
  'invert',
  'opacity',
] as const;

export const REQUIRED_PACKAGE_SIDE_EFFECTS = ['**/*.css', 'src/lib/themes/css/index.ts'] as const;

export function allowedThemeProperties(): Set<string> {
  const allowed = new Set<string>();
  for (const token of REQUIRED_COLOR_TOKENS) {
    allowed.add(`--color-${token}`);
  }
  allowed.add('color-scheme');
  if (CONTRACT_STAGE.legacyShadowsAllowed) {
    for (const name of LEGACY_SHADOW_TOKENS) {
      allowed.add(name);
    }
  }
  for (const name of Object.keys(OPTIONAL_DIALS)) {
    if (
      !CONTRACT_STAGE.elevationRolesActive &&
      (ELEVATION_ROLE_TOKENS as readonly string[]).includes(name)
    ) {
      continue;
    }
    if (!CONTRACT_STAGE.elevationRolesActive && name === '--backdrop-filter') {
      continue;
    }
    allowed.add(name);
  }
  return allowed;
}
