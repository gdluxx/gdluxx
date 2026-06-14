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
  import { Button } from '#components/ui';
  import Icon from '#components/ui/Icon.svelte';
  import ImageTargetConfig from './ImageTargetConfig.svelte';
  import { validateSelector } from '#utils/validation';
  import type { ContainerSource, ExtractionConfig, ImageSource } from '#src/content/types';

  interface ContainerModeTabProps {
    extraction: ExtractionConfig;
    rangeHint?: string | null;
    onmodechange?: (mode: 'range' | 'targeted') => void;
    onstartselectorchange?: (value: string) => void;
    onendselectorchange?: (value: string) => void;
    oncontainersourcechange?: (source: ContainerSource) => void;
    onimagesourcechange?: (source: ImageSource) => void;
    onapply?: () => void;
    onreset?: () => void;
    onshowselectorhelp?: () => void;
  }

  let {
    extraction,
    rangeHint = null,
    onmodechange,
    onstartselectorchange,
    onendselectorchange,
    oncontainersourcechange,
    onimagesourcechange,
    onapply,
    onreset,
    onshowselectorhelp,
  }: ContainerModeTabProps = $props();

  const mode = $derived(extraction.mode);

  let startSelectorError = $state('');
  let endSelectorError = $state('');
  let containerSelectorError = $state('');

  type ContainerVia = 'body' | 'selector' | 'string';
  const containerVia = $derived<ContainerVia>(
    extraction.mode === 'targeted' ? extraction.container.via : 'body',
  );

  function handleStartInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    startSelectorError = validateSelector(value);
    onstartselectorchange?.(value);
  }

  function handleEndInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    endSelectorError = validateSelector(value);
    onendselectorchange?.(value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) onapply?.();
  }

  function handleReset() {
    startSelectorError = '';
    endSelectorError = '';
    containerSelectorError = '';
    onreset?.();
  }

  function setContainerVia(via: ContainerVia) {
    if (via === 'body') {
      oncontainersourcechange?.({ via: 'body' });
    } else if (via === 'selector') {
      oncontainersourcechange?.({ via: 'selector', selector: '' });
    } else {
      oncontainersourcechange?.({ via: 'string', begin: '', end: '' });
    }
    containerSelectorError = '';
  }

  function handleContainerSelectorInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    containerSelectorError = validateSelector(value);
    oncontainersourcechange?.({ via: 'selector', selector: value });
  }

  function handleContainerBeginInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (extraction.mode === 'targeted' && extraction.container.via === 'string') {
      oncontainersourcechange?.({ via: 'string', begin: value, end: extraction.container.end });
    }
  }

  function handleContainerEndInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (extraction.mode === 'targeted' && extraction.container.via === 'string') {
      oncontainersourcechange?.({ via: 'string', begin: extraction.container.begin, end: value });
    }
  }
</script>

<div class="mt-2 space-y-3">
  <!-- Mode tabs -->
  <div class="join">
    <button
      type="button"
      class="join-item btn btn-sm {mode === 'range' ? 'btn-primary' : 'btn-neutral'}"
      onclick={() => onmodechange?.('range')}
    >
      Range
    </button>
    <button
      type="button"
      class="join-item btn btn-sm {mode === 'targeted' ? 'btn-primary' : 'btn-neutral'}"
      onclick={() => onmodechange?.('targeted')}
    >
      Targeted
    </button>
  </div>

  {#if mode === 'range'}
    <!-- Range mode: start/end CSS selectors -->
    <div class="flex items-center justify-between">
      <div class="text-base-content/70 text-sm">
        Restrict extraction to content between CSS selectors. Leave empty to scan the entire page.
      </div>
      <Button
        size="sm"
        variant="ghost"
        onclick={onshowselectorhelp}
        title="CSS Selector Help"
        aria-label="Show CSS selector help"
      >
        <Icon
          iconName="question"
          class="h-4 w-4"
        />
        Selector help
      </Button>
    </div>

    <div class="flex items-stretch gap-2">
      <div class="flex-1">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {startSelectorError
            ? 'input-error focus:input-error'
            : ''}"
          placeholder="Start selector (e.g. #content)"
          aria-label="Start CSS selector"
          list="extraction-common-selectors"
          value={extraction.mode === 'range' ? extraction.startSelector : ''}
          oninput={handleStartInput}
          onkeydown={handleKeydown}
        />
        {#if startSelectorError}
          <p class="text-error mt-1 text-sm">{startSelectorError}</p>
        {/if}
      </div>
      <div class="flex-1">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {endSelectorError
            ? 'input-error focus:input-error'
            : ''}"
          placeholder="End selector (e.g. #footer)"
          aria-label="End CSS selector"
          list="extraction-common-selectors"
          value={extraction.mode === 'range' ? extraction.endSelector : ''}
          oninput={handleEndInput}
          onkeydown={handleKeydown}
        />
        {#if endSelectorError}
          <p class="text-error mt-1 text-sm">{endSelectorError}</p>
        {/if}
      </div>
      <Button
        class="whitespace-nowrap"
        variant="neutral"
        onclick={onapply}
        title="Apply (Ctrl+Enter)"
      >
        Apply
      </Button>
      <Button
        class="whitespace-nowrap"
        variant="ghost"
        onclick={handleReset}
      >
        Reset
      </Button>
    </div>

    <datalist id="extraction-common-selectors">
      <option value="#content"></option>
      <option value="#main"></option>
      <option value=".container"></option>
      <option value="article"></option>
      <option value="main"></option>
      <option value=".post"></option>
      <option value=".entry"></option>
      <option value="section"></option>
      <option value="#wrapper"></option>
      <option value=".content"></option>
      <option value="#footer"></option>
      <option value=".footer"></option>
      <option value="nav"></option>
      <option value=".gallery"></option>
      <option value=".images"></option>
    </datalist>
  {:else}
    <!-- Targeted mode: container + image source configuration -->
    <div class="space-y-4">
      <!-- Container source -->
      <div class="space-y-2">
        <div class="text-base-content/70 text-xs font-medium tracking-wide uppercase">
          Container via
        </div>
        <div class="join">
          <button
            type="button"
            class="join-item btn btn-xs {containerVia === 'body' ? 'btn-primary' : 'btn-neutral'}"
            onclick={() => setContainerVia('body')}
          >
            Page body
          </button>
          <button
            type="button"
            class="join-item btn btn-xs {containerVia === 'selector'
              ? 'btn-primary'
              : 'btn-neutral'}"
            onclick={() => setContainerVia('selector')}
          >
            CSS Selector
          </button>
          <button
            type="button"
            class="join-item btn btn-xs {containerVia === 'string' ? 'btn-primary' : 'btn-neutral'}"
            onclick={() => setContainerVia('string')}
          >
            String Markers
          </button>
        </div>

        {#if containerVia === 'selector'}
          <div>
            <input
              class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {containerSelectorError
                ? 'input-error'
                : ''}"
              placeholder="Container selector (e.g. .gallery, #post-content)"
              aria-label="Container CSS selector"
              value={extraction.mode === 'targeted' && extraction.container.via === 'selector'
                ? extraction.container.selector
                : ''}
              oninput={handleContainerSelectorInput}
            />
            {#if containerSelectorError}
              <p class="text-error mt-1 text-xs">{containerSelectorError}</p>
            {/if}
          </div>
        {:else if containerVia === 'string'}
          <div class="flex gap-2">
            <input
              class="input-bordered input focus:ring-primary/20 focus:input-primary flex-1 transition-all focus:ring-2"
              placeholder="Begin marker"
              aria-label="Container begin marker"
              value={extraction.mode === 'targeted' && extraction.container.via === 'string'
                ? extraction.container.begin
                : ''}
              oninput={handleContainerBeginInput}
            />
            <input
              class="input-bordered input focus:ring-primary/20 focus:input-primary flex-1 transition-all focus:ring-2"
              placeholder="End marker"
              aria-label="Container end marker"
              value={extraction.mode === 'targeted' && extraction.container.via === 'string'
                ? extraction.container.end
                : ''}
              oninput={handleContainerEndInput}
            />
          </div>
        {/if}
      </div>

      <!-- Image source -->
      {#if extraction.mode === 'targeted'}
        <ImageTargetConfig
          images={extraction.images}
          {onimagesourcechange}
        />
      {/if}

      <div class="flex gap-2">
        <Button
          class="whitespace-nowrap"
          variant="neutral"
          size="sm"
          onclick={onapply}
        >
          Apply
        </Button>
        <Button
          class="whitespace-nowrap"
          variant="ghost"
          size="sm"
          onclick={handleReset}
        >
          Reset
        </Button>
      </div>

      <p class="text-base-content/50 text-xs">
        Targeted mode extracts images only. The Links tab will be empty.
      </p>
    </div>
  {/if}

  {#if rangeHint && mode === 'range'}
    <p class="text-base-content/60 text-xs">{rangeHint}</p>
  {/if}
</div>
