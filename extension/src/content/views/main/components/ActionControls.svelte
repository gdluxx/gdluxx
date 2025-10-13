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
  import { isValidDirectoryName } from '#utils/validation';

  const {
    isConfigured = false,
    selectionCount = 0,
    onSelectAll,
    onSelectNone,
    onInvertSelection,
    onCopySelected,
    onDownloadSelected,
    onSendSelected,
    customDirectoryEnabled = false,
    customDirectoryValue = '',
    onCustomDirectoryToggle,
    onCustomDirectoryChange,
    onCustomDirectoryClear,
  }: {
    isConfigured?: boolean;
    selectionCount?: number;
    onSelectAll: () => void;
    onSelectNone: () => void;
    onInvertSelection: () => void;
    onCopySelected: () => void;
    onDownloadSelected: () => void;
    onSendSelected: () => void | Promise<void>;
    customDirectoryEnabled?: boolean;
    customDirectoryValue?: string;
    onCustomDirectoryToggle?: () => void;
    onCustomDirectoryChange?: (value: string) => void;
    onCustomDirectoryClear?: () => void;
  } = $props();

  const isValid = $derived(isValidDirectoryName(customDirectoryValue));
</script>

<div class="m-4 flex flex-col justify-between gap-4 lg:flex-row">
  <!-- Selection Controls -->
  <div class="flex flex-wrap items-center gap-3">
    <div class="join">
      <Button
        onclick={onSelectAll}
        class="join-item"
      >
        Select All
      </Button>
      <Button
        onclick={onSelectNone}
        disabled={selectionCount === 0}
        class="join-item"
      >
        Select None
      </Button>
      <Button
        onclick={onInvertSelection}
        disabled={selectionCount === 0}
        class="join-item"
      >
        Invert
      </Button>
    </div>
  </div>

  <div class="flex gap-2">
    <Button
      onclick={onCopySelected}
      disabled={selectionCount === 0}
    >
      <Icon iconName="copy" />
      <span class="hidden sm:inline">Copy</span>
    </Button>
    <Button
      onclick={onDownloadSelected}
      disabled={selectionCount === 0}
    >
      <Icon iconName="download-arrow" />
      <span class="hidden sm:inline">Download</span>
    </Button>
  </div>
</div>

{#if isConfigured}
  <div class="mx-4 mb-4 flex flex-col gap-2">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
      <!-- Primary Action Button -->
      <Button
        variant="primary"
        title="Sends up to 25 URLs per request"
        onclick={onSendSelected}
        disabled={selectionCount === 0 ||
          (customDirectoryEnabled && (!customDirectoryValue.trim() || !isValid))}
      >
        <Icon iconName="send" />
        Send to gdluxx
      </Button>

      {#if customDirectoryEnabled}
        <div class="relative flex flex-1 flex-col">
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="folder-name"
              value={customDirectoryValue}
              oninput={(e) => onCustomDirectoryChange?.(e.currentTarget.value)}
              class="input input-secondary input-sm flex-1 {!isValid ? 'input-error' : ''}"
              maxlength="255"
            />
            <Button
              variant="ghost"
              onclick={onCustomDirectoryClear}
              title="Close custom folder input"
            >
              <Icon iconName="close" />
            </Button>
          </div>
          {#if !isValid}
            <span class="text-error mt absolute top-full left-0 text-xs">
              Invalid characters in folder name
            </span>
          {/if}
        </div>
      {:else}
        <Button
          variant="ghost"
          onclick={onCustomDirectoryToggle}
          disabled={selectionCount === 0}
          title="Specify a custom folder for downloads"
        >
          <Icon iconName="folder-plus" />
          Custom folder
        </Button>
      {/if}
    </div>
  </div>
{/if}
