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

{#if isConfigured}
  <div class="mx-4 my-2 flex flex-row items-center gap-3">
    <!-- Primary Action Button -->
    <Button
      size="sm"
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
            size="sm"
            square
            variant="ghost"
            onclick={onCustomDirectoryClear}
            title="Close custom folder input"
          >
            <Icon iconName="close" />
          </Button>
        </div>
        {#if !isValid}
          <span class="text-error absolute top-full left-0 mt-1 text-xs">
            Invalid characters in folder name
          </span>
        {/if}
      </div>
    {:else}
      <Button
        size="sm"
        variant="ghost"
        onclick={onCustomDirectoryToggle}
        disabled={selectionCount === 0}
        title="Specify a custom folder for downloads"
      >
        <Icon iconName="folder-plus" />
        Custom folder
      </Button>
    {/if}

    <div class="join ml-auto">
      <Button
        size="sm"
        variant="neutral"
        onclick={onCopySelected}
        disabled={selectionCount === 0}
        class="join-item"
      >
        <Icon iconName="copy" />
        <span class="hidden sm:inline">Copy</span>
      </Button>
      <Button
        size="sm"
        variant="neutral"
        onclick={onDownloadSelected}
        disabled={selectionCount === 0}
        class="join-item"
      >
        <Icon iconName="download-arrow" />
        <span class="hidden sm:inline">Download</span>
      </Button>
    </div>
  </div>
{/if}
