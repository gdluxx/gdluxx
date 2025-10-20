/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { getValue, setValue } from './storage';
export { loadSettings, saveSettings, validateServerUrl } from './settings';
export type { Settings } from './settings';
import type { DisplayMode } from '#src/content/types';

const THEME_KEY = 'gdluxx_us_theme';
const DISPLAY_MODE_KEY = 'gdluxx_us_display_mode';
const IGNORE_SESSION_KEY = 'gdluxx_us_ignore_profiles';
const IGNORE_SUB_KEY = 'gdluxx_ignored_sub_profiles';

export async function readThemePreference(defaultTheme: string): Promise<string> {
  try {
    return await getValue<string>(THEME_KEY, defaultTheme);
  } catch {
    return defaultTheme;
  }
}

export async function persistThemePreference(theme: string): Promise<void> {
  await setValue(THEME_KEY, theme);
}

export async function readDisplayModePreference(defaultMode: DisplayMode): Promise<DisplayMode> {
  try {
    return await getValue<DisplayMode>(DISPLAY_MODE_KEY, defaultMode);
  } catch {
    return defaultMode;
  }
}

export async function persistDisplayModePreference(mode: DisplayMode): Promise<void> {
  await setValue(DISPLAY_MODE_KEY, mode);
}

export function readIgnoredProfileIds(): Set<string> {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.sessionStorage.getItem(IGNORE_SESSION_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

export function persistIgnoredProfileIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(IGNORE_SESSION_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Silently fail to avoid breaking overlay flow
  }
}

export function readIgnoredSubProfileIds(): ReadonlySet<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(IGNORE_SUB_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value) => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export function persistIgnoredSubProfileIds(ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IGNORE_SUB_KEY, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error('Failed to persist ignored substitution profiles', error);
  }
}
