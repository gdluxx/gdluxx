/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { CatalogOption, JsonValue, JsonValueObject } from '$lib/types/catalog';
import { bucketKind } from './catalogFilter';

export interface CatalogSnippet {
  json: string;
  note: string;
  path: string[];
  value: JsonValue;
}

const GLOBAL_NOTE =
  'Set under extractor to apply globally, or under extractor.<site> to override per site.';

export function buildSnippet(option: CatalogOption): CatalogSnippet {
  const name = option.names?.[0] ?? option.n;
  const segments = name.split('.');
  let note = '';

  if (segments[0] === 'extractor' && segments[1] === '*') {
    segments.splice(1, 1);
    note = GLOBAL_NOTE;
  } else if (option.fam) {
    note = `Applies to the whole [${option.fam}] family of extractors.`;
  }

  const value = fallbackAwareDefault(option);

  let obj: JsonValue = value;
  for (let i = segments.length - 1; i >= 0; i--) {
    obj = { [segments[i]]: obj } satisfies JsonValueObject;
  }

  return { json: JSON.stringify(obj, null, 2), note, path: [...segments], value };
}

function fallbackAwareDefault(option: CatalogOption): JsonValue {
  if (option.def && option.def.p && option.def.v !== null) {
    return option.def.v;
  }

  const kind = option.t.length > 0 ? bucketKind(option.t[0].k) : 'custom';
  switch (kind) {
    case 'boolean':
      return true;
    case 'number':
      return 0;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return '…';
  }
}
