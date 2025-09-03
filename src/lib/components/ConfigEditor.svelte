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
  import { Button, ConfirmModal, UploadModal, Chip, Tooltip, Info } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import { invalidateAll } from '$app/navigation';
  import { clientLogger } from '$lib/client/logger';

  interface Props {
    value?: string;
    onSave?:
      | ((content: string) => Promise<{ message: string; [key: string]: unknown }>)
      | undefined;
    theme?: 'light' | 'dark';
    height?: string;
    readonly?: boolean;
    enableUpload?: boolean;
    uploadEndpoint?: string;
    invalidateAfterUpload?: boolean;
    onUploadSuccess?: (file: File) => void;
    onUploadError?: (error: Error) => void;
    enableReload?: boolean;
    reloadEndpoint?: string;
    onReloadSuccess?: (content: string) => void;
    onReloadError?: (error: Error) => void;
    source?: 'config' | 'example';
    enableSourceBadge?: boolean;
    enableRestoreDefaults?: boolean;
    onRestoreSuccess?: (content: string) => void;
    onRestoreError?: (error: Error) => void;
    lastSavedISO?: string;
    onLastSavedChange?: (lastSaved: string | undefined) => void;
  }

  /* eslint-disable prefer-const */
  let {
    value = $bindable('{}'),
    onSave = undefined,
    theme = 'light',
    height = '400px',
    readonly = false,
    enableUpload = false,
    uploadEndpoint = '/config',
    invalidateAfterUpload = false,
    onUploadSuccess,
    onUploadError,
    enableReload = false,
    reloadEndpoint = '/config',
    onReloadSuccess,
    onReloadError,
    source = 'config',
    enableSourceBadge = false,
    enableRestoreDefaults = false,
    onRestoreSuccess,
    onRestoreError,
    lastSavedISO = undefined,
    onLastSavedChange,
  }: Props = $props();
  /* eslint-enable prefer-const */

  let container: HTMLDivElement | undefined = $state();
  let editor: EditorView | undefined = $state();
  let isSaving = $state(false);
  let saveStatus = $state('');
  let hasLintErrors = $state(false);
  let showConfirmModal = $state(false);
  let isFullscreen = $state(false);
  let showUploadModal = $state(false);
  let isUploading = $state(false);
  let showReloadConfirmModal = $state(false);
  let isReloading = $state(false);
  let initialValue = $state('{}');
  let currentSource = $state<'config' | 'example'>('config');
  let showRestoreConfirmModal = $state(false);
  let isRestoring = $state(false);

  // Track if content has changed
  const isDirty = $derived(value !== initialValue);

  const jsonLinter = linter(jsonParseLinter());

  // format relative time
  function formatRelativeTime(isoString: string): string {
    const now = new Date();
    const lastSaved = new Date(isoString);
    const diffMs = now.getTime() - lastSaved.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return 'just now';
    } else if (minutes < 60) {
      return `${minutes} min ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }

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

  async function handleUploadSuccess(file: File) {
    try {
      isUploading = true;
      clientLogger.info('Config upload completed, refreshing content', { filename: file.name });

      const response = await fetch(uploadEndpoint, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result?.success && result?.data?.content) {
        value = result.data.content;
        clientLogger.info('Config content updated successfully after upload');
      } else {
        throw new Error('Invalid response format from server');
      }

      if (invalidateAfterUpload) {
        await invalidateAll();
      }

      onUploadSuccess?.(file);
      showUploadModal = false;
    } catch (error) {
      clientLogger.error('Error during upload success handling:', error);
      onUploadError?.(error instanceof Error ? error : new Error('Upload handling failed'));
    } finally {
      isUploading = false;
      showUploadModal = false;
    }
  }

  function handleUploadClick() {
    isUploading = false;
    showUploadModal = true;
  }

  function handleUploadClose() {
    showUploadModal = false;
  }

  function prettify() {
    try {
      const obj = JSON.parse(value);
      value = JSON.stringify(obj, null, 2);
      checkLintErrors();
    } catch {
      // button disabled when errors exist
    }
  }

  function downloadCurrent() {
    const blob = new Blob([value ?? ''], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReloadClick() {
    if (isDirty) {
      showReloadConfirmModal = true;
    } else {
      performReload();
    }
  }

  async function performReload() {
    try {
      isReloading = true;
      clientLogger.info('Reloading config from disk');

      const response = await fetch(reloadEndpoint, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result?.success && result?.data?.content) {
        const newContent = result.data.content;
        value = newContent;
        initialValue = newContent;

        if (result?.data?.source) {
          currentSource = result.data.source;
        }

        if (result?.data?.mtimeISO) {
          onLastSavedChange?.(result.data.mtimeISO);
        } else {
          // If no mtime it's probably the example config
          onLastSavedChange?.(undefined);
        }

        clientLogger.info('Config reloaded successfully');
        onReloadSuccess?.(newContent);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      clientLogger.error('Error during config reload:', error);
      onReloadError?.(error instanceof Error ? error : new Error('Config reload failed'));
    } finally {
      isReloading = false;
      showReloadConfirmModal = false;
    }
  }

  function confirmReload() {
    showReloadConfirmModal = false;
    performReload();
  }

  function cancelReload() {
    showReloadConfirmModal = false;
  }

  function handleRestoreClick() {
    showRestoreConfirmModal = true;
  }

  async function performRestoreDefaults() {
    try {
      isRestoring = true;
      clientLogger.info('Restoring default configuration');

      const response = await fetch('/config-example.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const exampleContent = await response.text();

      try {
        JSON.parse(exampleContent);
      } catch {
        throw new Error('Invalid JSON format in example configuration');
      }

      value = exampleContent;
      currentSource = 'example';

      clientLogger.info('Default configuration loaded successfully');
      onRestoreSuccess?.(exampleContent);
    } catch (error) {
      clientLogger.error('Error during restore defaults:', error);
      onRestoreError?.(error instanceof Error ? error : new Error('Restore defaults failed'));
    } finally {
      isRestoring = false;
      showRestoreConfirmModal = false;
    }
  }

  function confirmRestoreDefaults() {
    showRestoreConfirmModal = false;
    performRestoreDefaults();
  }

  function cancelRestoreDefaults() {
    showRestoreConfirmModal = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      handleSave();
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      if (!hasLintErrors && !readonly) {
        prettify();
      }
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

    // Set initial value for unsaved tracking
    initialValue = value;
    // Setting initial source
    currentSource = source;

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
    : 'mx-auto'} rounded-t-sm bg-surface border-strong"
>
  <Info
    size="sm"
    class="mx-4 mt-3"
  >
    <span>
      For more information on how to setup your configuration file, visit the
      <a
        href="https://gdl-org.github.io/docs/configuration.html"
        class="underline hover:underline-offset-4"
        ><i>gallery-dl</i> documentation
      </a>.
    </span>
  </Info>
  <div class="rounded-t-sm px-4 py-3 font-medium border-b-strong">
    <div class="">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <!-- badges -->
        <div>
          {#if enableSourceBadge}
            <Tooltip
              content={currentSource === 'example'
                ? 'Loaded example configuration. Save to create your config file.'
                : 'Loaded from your configuration file.'}
            >
              <Chip
                label="From: {currentSource}"
                variant={currentSource === 'example' ? 'warning' : 'info'}
                size="sm"
                dismissible={false}
              />
            </Tooltip>
          {/if}
          {#if lastSavedISO}
            <Chip
              label="Last saved: {formatRelativeTime(lastSavedISO)}"
              variant="info"
              size="sm"
              dismissible={false}
            />
          {:else}
            <Chip
              label="Unsaved"
              variant="warning"
              size="sm"
              dismissible={false}
            />
          {/if}
          <Tooltip content="JSON syntax status">
            <Chip
              label="JSON: {hasLintErrors ? 'Errors' : 'OK'}"
              variant={hasLintErrors ? 'danger' : 'outline-success'}
              title=""
              size="sm"
              dismissible={false}
            />
          </Tooltip>
        </div>

        <!-- save/fullscreen buttons -->
        <div class="flex items-center gap-3">
          {#if onSave && !readonly}
            <Button
              variant="primary"
              onclick={() => handleSave()}
              disabled={isSaving}
              loading={isSaving}
              title=""
              size="sm"
            >
              {isSaving ? 'Saving...' : hasLintErrors ? 'Save (Errors)' : 'Save'}
            </Button>
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
        </div>
      </div>
    </div>

    <div class="data-list-controls mt-3">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <!-- reload/restore/format buttons -->
        <div>
          {#if enableReload && !readonly}
            <Button
              variant="outline-warning"
              size="sm"
              disabled={isReloading}
              loading={isReloading}
              onclick={handleReloadClick}
              title={isDirty ? 'Discard unsaved changes and reload from disk' : 'Reload from disk'}
            >
              <Icon
                iconName="reload"
                size={20}
                class="mr-2"
              />
              Reload
            </Button>
          {/if}
          {#if enableRestoreDefaults && !readonly}
            <Button
              variant="outline-warning"
              size="sm"
              disabled={isRestoring}
              loading={isRestoring}
              onclick={handleRestoreClick}
              title="Replace current editor content with the example configuration"
            >
              <Icon
                iconName="restore"
                size={20}
                class="mr-2"
              />
              Restore Defaults
            </Button>
          {/if}

          <Tooltip
            content={hasLintErrors
              ? 'Cannot format - JSON has errors'
              : 'Format JSON (Ctrl+Shift+F / Cmd+Shift+F)'}
          >
            <Button
              variant="outline-info"
              size="sm"
              disabled={hasLintErrors}
              onclick={prettify}
              title=""
            >
              <Icon
                iconName="format"
                size={20}
                class="mr-2"
              />
              Format
            </Button>
          </Tooltip>
        </div>

        <!-- import/export buttons -->
        <div>
          {#if enableUpload && !readonly}
            <Button
              variant="outline-primary"
              size="sm"
              disabled={showUploadModal || isUploading}
              onclick={handleUploadClick}
              title="Upload configuration file"
            >
              <Icon
                iconName="import"
                size={16}
                class="mr-2"
              />
              Import
            </Button>
          {/if}
          {#if !readonly}
            <Tooltip content="Export configuration file">
              <Button
                variant="outline-info"
                size="sm"
                onclick={downloadCurrent}
                title=""
              >
                <Icon
                  iconName="export"
                  size={16}
                  class="mr-2"
                />
                Export
              </Button>
            </Tooltip>
          {/if}
        </div>
        {#if saveStatus}
          <span
            class="save-status text-sm"
            class:error={saveStatus.startsWith('Error')}
          >
            {saveStatus}
          </span>
        {/if}
      </div>
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

{#if enableUpload}
  <UploadModal
    show={showUploadModal}
    type="config"
    onClose={handleUploadClose}
    onUploadSuccess={handleUploadSuccess}
  />
{/if}

<ConfirmModal
  show={showReloadConfirmModal}
  title="Reload Configuration?"
  message="Discard unsaved changes and reload from disk? This action cannot be undone."
  confirmText="Reload"
  cancelText="Cancel"
  confirmVariant="warning"
  cancelVariant="outline-warning"
  onConfirm={confirmReload}
  onCancel={cancelReload}
/>

<ConfirmModal
  show={showRestoreConfirmModal}
  title="Restore Default Configuration?"
  message="Replace current editor content with the example configuration? This does not save automatically."
  confirmText="Restore Defaults"
  cancelText="Cancel"
  confirmVariant="warning"
  cancelVariant="outline-warning"
  onConfirm={confirmRestoreDefaults}
  onCancel={cancelRestoreDefaults}
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
