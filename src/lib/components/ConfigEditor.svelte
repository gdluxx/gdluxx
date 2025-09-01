<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { hasJsonLintErrors } from '$lib/stores/lint';
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
  import { EditorState, StateEffect } from '@codemirror/state';
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
  import { Button, ConfirmModal } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';

  interface Props {
    value?: string;
    onSave?:
      | ((content: string) => Promise<{ message: string; [key: string]: unknown }>)
      | undefined;
    theme?: 'light' | 'dark';
    height?: string;
    readonly?: boolean;
  }

  /* eslint-disable prefer-const */
  let {
    value = $bindable('{}'),
    onSave = undefined,
    theme = 'light',
    height = '400px',
    readonly = false,
  }: Props = $props();
  /* eslint-enable prefer-const */

  let container: HTMLDivElement | undefined = $state();
  let editor: EditorView | undefined = $state();
  let isSaving = $state(false);
  let saveStatus = $state('');
  let hasLintErrors = $state(false);
  let showConfirmModal = $state(false);
  let isFullscreen = $state(false);

  const jsonLinter = linter(jsonParseLinter());

  function getBasicSetup() {
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

  function createEditorState(initialValue: string) {
    const editorHeight = isFullscreen ? 'calc(100vh - 120px)' : height;
    const extensions = [
      ...getBasicSetup(),
      json(),
      jsonLinter,
      lintGutter(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          value = update.state.doc.toString();
          checkLintErrors();
        }
      }),
      EditorState.readOnly.of(readonly),
      theme === 'dark' ? codemirrorDark : codemirrorLight,
      EditorView.theme({
        '&': { height: editorHeight },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ];

    return EditorState.create({
      doc: initialValue,
      extensions,
    });
  }

  function checkLintErrors() {
    if (!editor) {
      return;
    }

    try {
      JSON.parse(value);
      hasLintErrors = false;
      hasJsonLintErrors.set(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      hasLintErrors = true;
      hasJsonLintErrors.set(true);
    }
  }

  async function handleSave(force = false) {
    if (!onSave || isSaving) {
      return;
    }

    if (hasLintErrors && !force) {
      showConfirmModal = true;
      return;
    }

    isSaving = true;
    saveStatus = 'Saving...';

    try {
      const result = await onSave(value);
      saveStatus = result.message;
      setTimeout(() => {
        saveStatus = '';
      }, 3000);
    } catch (error) {
      saveStatus = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setTimeout(() => {
        saveStatus = '';
      }, 5000);
    } finally {
      isSaving = false;
    }
  }

  function confirmSaveWithErrors() {
    showConfirmModal = false;
    handleSave(true);
  }

  function cancelSave() {
    showConfirmModal = false;
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      handleSave();
    }

    if (event.key === 'Escape' && showConfirmModal) {
      event.preventDefault();
      cancelSave();
    }

    if (event.key === 'Escape' && !showConfirmModal && isFullscreen) {
      event.preventDefault();
      toggleFullscreen();
    }
  }

  onMount(() => {
    if (!container) {
      return;
    }

    editor = new EditorView({
      state: createEditorState(value),
      parent: container,
    });

    container.addEventListener('keydown', handleKeyDown);

    document.addEventListener('keydown', handleKeyDown);

    checkLintErrors();
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
    if (container) {
      container.removeEventListener('keydown', handleKeyDown);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  // React to theme, readonly, height, and fullscreen changes
  $effect(() => {
    if (editor && (theme || readonly || height || isFullscreen)) {
      const editorHeight = isFullscreen ? 'calc(100vh - 120px)' : height;
      editor.dispatch({
        effects: StateEffect.reconfigure.of([
          ...getBasicSetup(),
          json(),
          jsonLinter,
          lintGutter(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              value = update.state.doc.toString();
              checkLintErrors();
            }
          }),
          EditorState.readOnly.of(readonly),
          theme === 'dark' ? codemirrorDark : codemirrorLight,
          EditorView.theme({
            '&': { height: editorHeight },
            '.cm-scroller': { overflow: 'auto' },
          }),
        ]),
      });
    }
  });

  // React to value changes from outside
  $effect(() => {
    if (editor && value !== editor.state.doc.toString()) {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: value,
        },
      });
      checkLintErrors();
    }
  });
</script>

<div
  class="transition-all duration-300 {isFullscreen
    ? 'fixed inset-5 z-50 mx-0'
    : 'mx-auto'} rounded-t-sm border-strong"
>
  <div
    class="flex cursor-default items-center justify-between rounded-t-sm bg-surface px-4 py-3 font-medium border-b-strong"
  >
    <span class="text-muted-foreground">Edit your configuration file</span>
    <div class="flex items-center gap-3">
      {#if saveStatus}
        <span
          class="save-status"
          class:error={saveStatus.startsWith('Error')}
        >
          {saveStatus}
        </span>
      {/if}
      <Button
        variant="outline-info"
        onclick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        size="sm"
        square
      >
        {#if isFullscreen}
          <Icon
            iconName="minimize"
            size={20}
            class="w-[1rem] text-foreground"
          />
        {:else}
          <Icon
            iconName="maximize"
            size={20}
            class="w-[1rem] text-foreground"
          />
        {/if}
      </Button>
      {#if onSave && !readonly}
        <Button
          variant={hasLintErrors ? 'danger' : 'primary'}
          onclick={() => handleSave()}
          disabled={isSaving}
          loading={isSaving}
          title={hasLintErrors ? 'JSON has errors - click to save anyway' : 'Save (Ctrl+S / Cmd+S)'}
          size="sm"
        >
          {isSaving ? 'Saving...' : hasLintErrors ? 'Save (Errors)' : 'Save'}
        </Button>
      {/if}
    </div>
  </div>
  <div
    bind:this={container}
    class="font-mono text-sm"
  ></div>
</div>

<ConfirmModal
  show={showConfirmModal}
  title="Save with Errors?"
  message="The JSON contains syntax errors. Are you sure you want to save?"
  confirmText="Save Anyway"
  cancelText="Cancel"
  confirmVariant="warning"
  cancelVariant="outline-warning"
  onConfirm={confirmSaveWithErrors}
  onCancel={cancelSave}
/>

<style>
  .save-status {
    font-size: 0.875rem;
    color: var(--color-success);
  }

  .save-status.error {
    color: var(--color-error);
  }
</style>
