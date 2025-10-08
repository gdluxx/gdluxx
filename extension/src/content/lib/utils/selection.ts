/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export type SelectionSet = Set<string>;

export function toggleSelection(current: ReadonlySet<string>, value: string): SelectionSet {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function selectAll(current: ReadonlySet<string>, values: Iterable<string>): SelectionSet {
  const next = new Set(current);
  for (const value of values) {
    next.add(value);
  }
  return next;
}

export function clearSelection(): SelectionSet {
  return new Set<string>();
}

export function invertSelection(
  current: ReadonlySet<string>,
  visible: readonly string[],
): SelectionSet {
  const next = new Set<string>();

  for (const value of visible) {
    if (!current.has(value)) {
      next.add(value);
    }
  }

  for (const value of current) {
    if (!visible.includes(value)) {
      next.add(value);
    }
  }

  return next;
}
