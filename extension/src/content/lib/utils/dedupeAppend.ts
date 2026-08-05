/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface DedupeAppendResult {
  merged: string[];
  additions: string[];
}

export function dedupeAppend(existing: string[], candidates: string[]): DedupeAppendResult {
  if (candidates.length === 0) return { merged: existing, additions: [] };
  const seen = new Set(existing);
  const additions: string[] = [];
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    additions.push(url);
  }
  return { merged: additions.length > 0 ? [...existing, ...additions] : existing, additions };
}
