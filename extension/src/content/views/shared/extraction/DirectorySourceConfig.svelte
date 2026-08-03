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
  import type { DirectorySource } from '#src/content/types';
  import { validateSelector } from '#utils/validation';
  import { validateRegexPattern } from '#utils/substitution';
  import { resolveDirectoryFromSource } from '#utils/directorySource';

  interface DirectorySourceConfigProps {
    directorySource?: DirectorySource;
    ondirectorysourcechange?: (source: DirectorySource | undefined) => void;
  }

  let { directorySource, ondirectorysourcechange }: DirectorySourceConfigProps = $props();

  type DirectoryVia = 'off' | 'selector';

  const via = $derived<DirectoryVia>(directorySource ? 'selector' : 'off');
  const selector = $derived(directorySource?.selector ?? '');
  const attr = $derived(directorySource?.attr ?? '');
  const pattern = $derived(directorySource?.transform?.pattern ?? '');

  let selectorError = $state('');
  let transformError = $state('');
  let draftReplacement = $state('');
  let draftFlags = $state('');

  const replacement = $derived(directorySource?.transform?.replacement ?? draftReplacement);
  const flags = $derived(directorySource?.transform?.flags ?? draftFlags);

  const preview = $derived.by(() => {
    if (!directorySource || !selector.trim()) return null;
    if (selectorError || transformError) return null;
    return resolveDirectoryFromSource(directorySource);
  });

  // Always emits the same key order/shape the storage layer produces so a
  // saved profile and the in-memory config compare equal
  function emit(next: {
    selector: string;
    attr: string;
    transform?: DirectorySource['transform'];
  }) {
    ondirectorysourcechange?.({
      via: 'selector',
      selector: next.selector,
      attr: next.attr.trim() || undefined,
      transform: next.transform,
    });
  }

  function setVia(next: DirectoryVia) {
    selectorError = '';
    transformError = '';
    if (next === 'off') {
      ondirectorysourcechange?.(undefined);
      return;
    }
    emit({ selector: '', attr: '' });
  }

  function handleSelectorInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    selectorError = validateSelector(value);
    emit({ selector: value, attr, transform: directorySource?.transform });
  }

  function handleAttrInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    emit({ selector, attr: value, transform: directorySource?.transform });
  }

  function emitTransform(next: { pattern?: string; replacement?: string; flags?: string }) {
    const merged = {
      pattern: next.pattern ?? pattern,
      replacement: next.replacement ?? replacement,
      flags: next.flags ?? flags,
    };
    draftReplacement = merged.replacement;
    draftFlags = merged.flags;

    const trimmedPattern = merged.pattern.trim();
    transformError = trimmedPattern
      ? (validateRegexPattern(trimmedPattern, merged.flags).error ?? '')
      : '';

    emit({
      selector,
      attr,
      transform: trimmedPattern
        ? {
            pattern: merged.pattern,
            replacement: merged.replacement,
            flags: merged.flags || undefined,
          }
        : undefined,
    });
  }

  function handlePatternInput(e: Event) {
    emitTransform({ pattern: (e.target as HTMLInputElement).value });
  }

  function handleReplacementInput(e: Event) {
    emitTransform({ replacement: (e.target as HTMLInputElement).value });
  }

  function handleFlagsInput(e: Event) {
    emitTransform({ flags: (e.target as HTMLInputElement).value });
  }
</script>

<div class="space-y-2">
  <div class="text-base-content/70 text-xs font-medium tracking-wide uppercase">
    Folder name via
  </div>
  <div class="join">
    <button
      type="button"
      class="join-item btn btn-xs {via === 'off' ? 'btn-primary' : 'btn-neutral'}"
      onclick={() => setVia('off')}
    >
      Off
    </button>
    <button
      type="button"
      class="join-item btn btn-xs {via === 'selector' ? 'btn-primary' : 'btn-neutral'}"
      onclick={() => setVia('selector')}
    >
      CSS Selector
    </button>
  </div>

  {#if via === 'selector'}
    <div class="flex gap-2">
      <div class="flex-1">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {selectorError
            ? 'input-error'
            : ''}"
          placeholder="Folder name selector (e.g. h1, .post-title)"
          aria-label="Folder name CSS selector"
          value={selector}
          oninput={handleSelectorInput}
        />
        {#if selectorError}
          <p class="text-error mt-1 text-xs">{selectorError}</p>
        {/if}
      </div>
      <div class="w-24">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
          placeholder="attr (text)"
          aria-label="Folder name attribute"
          value={attr}
          oninput={handleAttrInput}
        />
      </div>
    </div>

    <div class="flex gap-2">
      <div class="flex-1">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {transformError
            ? 'input-error'
            : ''}"
          placeholder="Transform pattern (optional regex)"
          aria-label="Folder name transform pattern"
          value={pattern}
          oninput={handlePatternInput}
        />
        {#if transformError}
          <p class="text-error mt-1 text-xs">{transformError}</p>
        {/if}
      </div>
      <input
        class="input-bordered input focus:ring-primary/20 focus:input-primary flex-1 transition-all focus:ring-2"
        placeholder="Replacement"
        aria-label="Folder name transform replacement"
        value={replacement}
        oninput={handleReplacementInput}
      />
      <div class="w-24">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
          placeholder="flags"
          aria-label="Folder name transform flags"
          value={flags}
          maxlength="10"
          oninput={handleFlagsInput}
        />
      </div>
    </div>

    {#if preview}
      <p class="text-base-content/60 text-xs">
        {#if preview.value}
          &rarr; "{preview.value}"
        {:else}
          {preview.reason}
        {/if}
      </p>
    {/if}
  {/if}
</div>
