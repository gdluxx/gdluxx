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
  import { captureHotkey } from '#utils/hotkeys';

  interface Props {
    settings: Settings;
    onToggleHotkey: (event: Event) => void;
    onHotkeyChange: (hotkey: string) => void;
    onToggleSendTabHotkey: (event: Event) => void;
    onSendTabHotkeyChange: (hotkey: string) => void;
  }

  const {
    settings,
    onToggleHotkey,
    onHotkeyChange,
    onToggleSendTabHotkey,
    onSendTabHotkeyChange,
  }: Props = $props();
  let isEditing = $state(false);
  let hotkeyInput = $state<HTMLInputElement | null>(null);
  let validationError = $state<string | null>(null);
  let isSendTabEditing = $state(false);
  let sendTabHotkeyInput = $state<HTMLInputElement | null>(null);
  let sendTabValidationError = $state<string | null>(null);

  $effect(() => {
    if (isEditing && hotkeyInput) {
      hotkeyInput.focus();
    }
  });

  $effect(() => {
    if (isSendTabEditing && sendTabHotkeyInput) {
      sendTabHotkeyInput.focus();
    }
  });

  function handleHotkeyKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    const captured = captureHotkey(event);

    if (!captured) {
      validationError =
        'Hotkey must include at least one modifier (Ctrl/Alt/Shift/Meta) and one key';
      return;
    }

    onHotkeyChange(captured);
    validationError = null;
    isEditing = false;
  }

  function handleKbdClick(): void {
    isEditing = true;
    validationError = null;
  }

  function handleBlur(): void {
    isEditing = false;
    validationError = null;
  }

  function handleSendTabHotkeyKeydown(event: KeyboardEvent): void {
    event.preventDefault();
    const captured = captureHotkey(event);

    if (!captured) {
      sendTabValidationError =
        'Hotkey must include at least one modifier (Ctrl/Alt/Shift/Meta) and one key';
      return;
    }

    onSendTabHotkeyChange(captured);
    sendTabValidationError = null;
    isSendTabEditing = false;
  }

  function handleSendTabKbdClick(): void {
    isSendTabEditing = true;
    sendTabValidationError = null;
  }

  function handleSendTabBlur(): void {
    isSendTabEditing = false;
    sendTabValidationError = null;
  }
</script>

<div class="mx-2 my-4 max-w-[640px]">
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Enable overlay hotkey</div>
      <div class="flex flex-row justify-between">
        <div class="flex-start flex">
          <p>Takes effect on next page load</p>
        </div>
        <input
          id="hotkey-enabled"
          type="checkbox"
          class="toggle toggle-accent toggle-sm"
          checked={settings.hotkeyEnabled}
          onchange={onToggleHotkey}
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
        {#if validationError}
          <p class="text-error mt-1 text-sm">{validationError}</p>
        {/if}
      </div>
    </div>
  </div>

  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Enable "send current tab" hotkey</div>
      <div class="flex flex-row justify-between">
        <div class="flex-start flex">
          <p>Sends current page/tab URL to gdluxx</p>
        </div>
        <input
          id="send-tab-hotkey-enabled"
          type="checkbox"
          class="toggle toggle-accent toggle-sm"
          checked={settings.sendTabHotkeyEnabled}
          onchange={onToggleSendTabHotkey}
        />
      </div>
      <div class="card-actions justify-end">
        {#if isSendTabEditing}
          <input
            class="input focus:input-primary mt-4 transition-all"
            placeholder="Press keys..."
            aria-label="Send tab hotkey combination"
            bind:value={settings.sendTabHotkey}
            style="max-width: 160px;"
            onkeydown={handleSendTabHotkeyKeydown}
            onblur={handleSendTabBlur}
            bind:this={sendTabHotkeyInput}
          />
        {:else}
          <button
            class="kbd kbd-xl mt-4 mb-2 cursor-pointer hover:opacity-80"
            onclick={handleSendTabKbdClick}
            aria-label="Click to edit send tab hotkey"
          >
            {settings.sendTabHotkey || 'Click to set'}
          </button>
        {/if}
        {#if sendTabValidationError}
          <p class="text-error mt-1 text-sm">{sendTabValidationError}</p>
        {/if}
      </div>
    </div>
  </div>
</div>
