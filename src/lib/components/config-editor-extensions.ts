/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import { lintGutter, linter } from '@codemirror/lint';
import { codemirrorLight } from '$lib/themes/codemirror/codemirror-light';
import { codemirrorDark } from '$lib/themes/codemirror/codemirror-dark';

// Stateless, safe to share across every editor instance/rebuild.
const jsonLinter = linter(jsonParseLinter());

/**
 * Extensions shared by every JSON editor instance: keymaps, gutters,
 * selection/history behavior, folding, etc. Independent of any
 * ConfigEditor prop/state, so it never needs to be rebuilt.
 */
function getBasicSetup(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
  ];
}

export interface JsonEditorExtensionsOptions {
  /** Active app theme; selects the token-driven CodeMirror light/dark theme. */
  theme: 'light' | 'dark';
  /** Whether the document should be non-editable. */
  readonly: boolean;
  /** CSS height value for the editor (accounts for fullscreen mode). */
  editorHeight: string;
  /** Called with the new document text whenever the doc changes. */
  onDocChange: (doc: string) => void;
}

/**
 * Builds the full CodeMirror extensions array used by ConfigEditor, for
 * both initial editor creation and theme/readonly/height reconfiguration.
 * Kept as a single source of truth so the two call sites can't drift.
 */
export function buildJsonEditorExtensions({
  theme,
  readonly,
  editorHeight,
  onDocChange,
}: JsonEditorExtensionsOptions): Extension[] {
  return [
    ...getBasicSetup(),
    json(),
    jsonLinter,
    lintGutter(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onDocChange(update.state.doc.toString());
      }
    }),
    EditorState.readOnly.of(readonly),
    theme === 'dark' ? codemirrorDark : codemirrorLight,
    EditorView.theme({
      '&': { height: editorHeight },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ];
}
