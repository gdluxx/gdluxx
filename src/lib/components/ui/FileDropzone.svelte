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
  import { Icon } from '$lib/components';

  interface Props {
    selectedFile?: File | null;
    accept?: string;
    prompt?: string;
    ariaLabel?: string;
    disabled?: boolean;
    class?: string;
    onSelect?: (file: File) => void;
  }

  /* eslint-disable prefer-const */
  let {
    selectedFile = $bindable(null),
    accept = '*',
    prompt = 'Click to upload or drag and drop',
    ariaLabel = 'Click to select file or drag and drop',
    disabled = false,
    class: className = '',
    onSelect,
  }: Props = $props();
  /* eslint-enable prefer-const */

  let fileInput: HTMLInputElement | undefined = $state();
  let isDragOver = $state(false);

  // Clearing `selectedFile` from the parent must also clear the native input,
  // otherwise re-picking the same file fires no change event.
  $effect(() => {
    if (!selectedFile && fileInput) {
      fileInput.value = '';
    }
  });

  function selectFile(file: File): void {
    selectedFile = file;
    onSelect?.(file);
  }

  function openPicker(): void {
    if (disabled) {
      return;
    }
    fileInput?.click();
  }

  function handleFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files?.[0]) {
      selectFile(target.files[0]);
    }
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!disabled) {
      isDragOver = true;
    }
  }

  function handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    // Ignore leave events fired while moving between the zone's own children.
    if (!(event.currentTarget as Element)?.contains(event.relatedTarget as Node | null)) {
      isDragOver = false;
    }
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    isDragOver = false;

    if (disabled) {
      return;
    }

    const files = event.dataTransfer?.files;
    if (files?.[0]) {
      selectFile(files[0]);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  }

  const zoneStateClasses = $derived(
    isDragOver
      ? 'border-solid border-primary bg-primary/10'
      : selectedFile
        ? 'border-solid border-success bg-success/10'
        : 'border-primary',
  );
</script>

<input
  bind:this={fileInput}
  type="file"
  {accept}
  {disabled}
  class="sr-only"
  onchange={handleFileSelect}
  aria-label={ariaLabel}
/>

<div
  class="cursor-pointer rounded-sm border-2 border-dashed p-8 text-center transition-colors {zoneStateClasses} {className}"
  class:cursor-not-allowed={disabled}
  class:opacity-60={disabled}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  role="button"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled}
  onclick={openPicker}
  onkeydown={handleKeydown}
  aria-label={ariaLabel}
>
  <div class="space-y-4">
    {#if selectedFile}
      <div class="flex items-center justify-center">
        <Icon
          iconName="circle"
          size={48}
          class="text-success"
          ariaLabel="File selected"
        />
      </div>
      <div>
        <p class="text-lg font-medium text-success">
          {selectedFile.name}
        </p>
        <p class="text-sm text-success">
          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
    {:else}
      <div class="flex items-center justify-center">
        <Icon
          iconName="plus"
          size={48}
          class="text-primary"
          ariaLabel="Upload icon"
        />
      </div>
      <div>
        <p class="text-lg font-medium text-muted-foreground">
          {prompt}
        </p>
      </div>
    {/if}
  </div>
</div>
