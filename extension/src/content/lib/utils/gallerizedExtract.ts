/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Inspiration from gallery-dl
 * Find the text between `begin` and `end` inside `txt` starting at `pos`
 * Returns [extracted, newPos] or [null, pos] if not found
 */
export function extract(txt: string, begin: string, end: string, pos = 0): [string | null, number] {
  const bi = txt.indexOf(begin, pos);
  if (bi === -1) return [null, pos];
  const start = bi + begin.length;
  const ei = txt.indexOf(end, start);
  if (ei === -1) return [null, pos];
  return [txt.slice(start, ei), ei + end.length];
}

/**
 * Single shot extraction
 * returns the value only, or `defaultVal` on failure
 */
export function extr(txt: string, begin: string, end: string, defaultVal = ''): string {
  const [val] = extract(txt, begin, end);
  return val === null ? defaultVal : val;
}

/**
 * Generator yields every occurrence of text between `begin` and `end`.
 */
export function* extrIter(txt: string, begin: string, end: string, pos = 0): Generator<string> {
  while (true) {
    const [val, next] = extract(txt, begin, end, pos);
    if (val === null) return;
    yield val;
    pos = next;
  }
}

/**
 * Returns a stateful extractor closure over `txt`
 * Each call advances an internal position cursor to enable sequential extraction.
 */
export function extractFrom(txt: string, defaultVal = ''): (begin: string, end: string) => string {
  let pos = 0;
  return function (begin: string, end: string): string {
    const [val, next] = extract(txt, begin, end, pos);
    if (val === null) return defaultVal;
    pos = next;
    return val;
  };
}
