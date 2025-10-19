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
  import type { Settings } from '#utils/settings';

  const { settings }: { settings: Settings } = $props();
  let isEditing = $state(false);
  let hotkeyInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (isEditing && hotkeyInput) {
      hotkeyInput.focus();
    }
  });

  function handleHotkeyKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    const key = event.key;
    if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key.toUpperCase());
    }
    if (parts.length > 1) {
      settings.hotkey = parts.join('+');
      isEditing = false;
    }
  }

  function handleKbdClick(): void {
    isEditing = true;
  }

  function handleBlur(): void {
    isEditing = false;
  }
</script>

<div class="mx-2 my-4 max-w-[640px]">
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Enable global hotkey</div>
      <div class="flex flex-row justify-between">
        <div class="flex-start flex">
          <p>Takes effect on next page load</p>
        </div>
        <input
          id="hotkey-enabled"
          type="checkbox"
          class="toggle toggle-accent toggle-sm"
          bind:checked={settings.hotkeyEnabled}
        />
      </div>
      <div class="card-actions justify-end">
        {#if isEditing}
          <input
            class="input focus:input-primary mt-4 transition-all"
            placeholder="Press keys..."
            aria-label="Hotkey combination"
            bind:value={settings.hotkey}
            style="max-width: 160px;"
            onkeydown={handleHotkeyKeydown}
            onblur={handleBlur}
            bind:this={hotkeyInput}
          />
        {:else}
          <button
            class="kbd kbd-xl mt-4 mb-2 cursor-pointer hover:opacity-80"
            onclick={handleKbdClick}
            aria-label="Click to edit hotkey"
          >
            {settings.hotkey || 'Click to set'}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
