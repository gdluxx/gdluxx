/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export function isValidUrl(str: string): boolean {
  return normalizeUrl(str) !== null;
}

export function normalizeUrl(str: string): string | null {
  try {
    const base = typeof window !== 'undefined' ? window.location.href : undefined;
    const u = base ? new URL(str, base) : new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function escapeHtml(str: string): string {
  const el = document.createElement('p');
  el.textContent = str;
  return el.innerHTML;
}
