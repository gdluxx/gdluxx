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
 * Comment preserving merge of a single option value into the raw gallery-dl
 * config text.
 *
 * gallery-dl configs may use multiple `"#"` keys as pseudo-comments
 */

import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree } from 'jsonc-parser';
import type { FormattingOptions, ParseError } from 'jsonc-parser';
import { serverLogger as logger } from '$lib/server/logger';
import type { JsonValue } from '$lib/types/catalog';

export interface MergeResult {
  text: string;
  existed: boolean;
  currentValue?: JsonValue;
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

export function mergeIntoConfigText(text: string, path: string[], value: JsonValue): MergeResult {
  const formattingOptions: FormattingOptions = {
    tabSize: 2,
    insertSpaces: true,
    eol: detectEol(text),
  };

  let existed = false;
  let currentValue: JsonValue | undefined;

  const errors: ParseError[] = [];
  const tree = parseTree(text, errors);

  if (errors.length > 0) {
    logger.warn(`Config text has parse errors while merging path "${path.join('.')}"`);
  } else if (tree) {
    const node = findNodeAtLocation(tree, path);
    if (node !== undefined) {
      existed = true;
      currentValue = getNodeValue(node) as JsonValue;
    }
  }

  const edits = modify(text, path, value, { formattingOptions });
  const newText = applyEdits(text, edits);

  return { text: newText, existed, currentValue };
}
