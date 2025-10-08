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
  import { validateSelector } from '#utils/validation';

  let {
    startSelector = $bindable(''),
    endSelector = $bindable(''),
    onapply,
    onreset,
    onshowselectorhelp,
  }: {
    startSelector?: string;
    endSelector?: string;
    onapply?: () => void;
    onreset?: () => void;
    onshowselectorhelp?: () => void;
  } = $props();

  let startSelectorError = $state('');
  let endSelectorError = $state('');

  function handleStartInput() {
    startSelectorError = validateSelector(startSelector);
  }

  function handleEndInput() {
    endSelectorError = validateSelector(endSelector);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) {
      onapply?.();
    }
  }

  function handleApply() {
    onapply?.();
  }

  function handleReset() {
    startSelector = '';
    endSelector = '';
    startSelectorError = '';
    endSelectorError = '';
    onreset?.();
  }

  function showSelectorHelp() {
    onshowselectorhelp?.();
  }
</script>

<div class="mt-2 space-y-3">
  <div class="flex items-center justify-between">
    <div class="text-base-content/70 text-sm">
      Restrict extraction to content between CSS selectors. Leave empty to scan the entire page.
    </div>
    <button
      class="btn btn-circle btn-ghost btn-sm"
      onclick={showSelectorHelp}
      title="CSS Selector Help"
      aria-label="Show CSS selector help"
    >
      <Icon
        iconName="question"
        class="h-4 w-4"
      />
    </button>
  </div>

  <div class="flex items-stretch gap-2">
    <div class="flex-1">
      <input
        class={`input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 ${startSelectorError ? 'input-error focus:input-error' : ''}`}
        placeholder="Start selector (e.g. #content)"
        aria-label="Start CSS selector"
        list="common-selectors"
        bind:value={startSelector}
        oninput={handleStartInput}
        onkeydown={handleKeydown}
      />
      {#if startSelectorError}
        <p class="text-error mt-1 text-sm">{startSelectorError}</p>
      {/if}
    </div>
    <div class="flex-1">
      <input
        class={`input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 ${endSelectorError ? 'input-error focus:input-error' : ''}`}
        placeholder="End selector (e.g. #footer)"
        aria-label="End CSS selector"
        list="common-selectors"
        bind:value={endSelector}
        oninput={handleEndInput}
        onkeydown={handleKeydown}
      />
      {#if endSelectorError}
        <p class="text-error mt-1 text-sm">{endSelectorError}</p>
      {/if}
    </div>
    <Button
      class="whitespace-nowrap"
      variant="primary"
      onclick={handleApply}
      title="Apply selectors (Ctrl+Enter)"
    >
      Apply
    </Button>
    <Button
      class="whitespace-nowrap"
      variant="neutral"
      onclick={handleReset}
    >
      Reset
    </Button>
  </div>

  <!-- Autocomplete datalist for common selectors -->
  <datalist id="common-selectors">
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
    <option value=".nav"></option>
    <option value=".gallery"></option>
    <option value=".images"></option>
  </datalist>
</div>
