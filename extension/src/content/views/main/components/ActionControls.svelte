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

<div class="m-4 flex flex-col gap-4">
  <div class="join flex flex-wrap">
    <Button
      variant="primary"
      onclick={onSelectAll}
      class="join-item"
    >
      Select All
    </Button>
    <Button
      variant="primary"
      onclick={onSelectNone}
      disabled={selectionCount === 0}
      class="join-item"
    >
      Select None
    </Button>
    <Button
      variant="primary"
      onclick={onInvertSelection}
      disabled={selectionCount === 0}
      class="join-item"
    >
      Invert
    </Button>
    <Button
      disabled
      class={`join-item ${selectionCount === 0 ? '' : 'text-base-content/70'}`}
    >
      {selectionCount} selected
    </Button>
  </div>

  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <div class="join flex flex-wrap">
        <Button
          variant="secondary"
          onclick={onCopySelected}
          disabled={selectionCount === 0}
          class="join-item"
        >
          <Icon iconName="copy" />
          Copy Selected
        </Button>
        <Button
          variant="secondary"
          onclick={onDownloadSelected}
          disabled={selectionCount === 0}
          class="join-item"
        >
          <Icon iconName="download-arrow" />
          Download Selected
        </Button>
      </div>
    </div>

    {#if isConfigured}
      <!-- Custom directory -->
      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          {#if !customDirectoryEnabled}
            <Button
              variant="ghost"
              onclick={onCustomDirectoryToggle}
              title="Specify a custom folder for downloads"
            >
              <Icon iconName="folder-plus" />
              Custom folder
            </Button>
          {:else}
            <div class="flex flex-1 items-center justify-between gap-2">
              <input
                type="text"
                placeholder="folder-name"
                value={customDirectoryValue}
                oninput={(e) => onCustomDirectoryChange?.(e.currentTarget.value)}
                class="input input-bordered input-sm flex-1 {!isValid ? 'input-error' : ''}"
                maxlength="255"
              />
              <Button
                variant="ghost"
                onclick={onCustomDirectoryClear}
                title="Close custom folder input"
              >
                <Icon iconName="close" />
              </Button>
              {#if !isValid}
                <span class="text-error text-xs whitespace-nowrap">
                  Invalid folder name (avoid special characters)
                </span>
              {/if}
            </div>
          {/if}

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
        </div>
      </div>
    {/if}
  </div>
</div>
