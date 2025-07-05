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
  import { createEventDispatcher } from 'svelte';
  import { Icon } from '$lib/components';

  interface Props {
    label: string;
    value?: string | number | boolean;
    editable?: boolean;
  }

  const { label, value, editable = false }: Props = $props();
  const dispatch = createEventDispatcher<{
    remove: object;
    edit: { value: string | number | boolean };
  }>();

  let isEditing = $state(false);
  let editValue = $state('');
  let inputRef = $state<HTMLInputElement>();

  function handleRemove() {
    dispatch('remove', {});
  }

  function startEditing() {
    if (editable && value && typeof value !== 'boolean') {
      isEditing = true;
      editValue = String(value);
      // Focus input in next tick
      setTimeout(() => inputRef?.focus(), 0);
    }
  }

  function stopEditing() {
    isEditing = false;
  }

  function handleEditSubmit() {
    if (editValue.trim()) {
      dispatch('edit', { value: editValue.trim() });
    }
    stopEditing();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      stopEditing();
    }
  }
</script>

<div
  class="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1.5 text-primary-800 transition-colors group dark:bg-primary-900 dark:text-primary-200 hover:bg-primary-200 dark:hover:bg-primary-800"
>
  <span class="text-sm font-medium">{label}</span>
  {#if value && typeof value !== 'boolean'}
    {#if isEditing}
      <input
        bind:this={inputRef}
        bind:value={editValue}
        onkeydown={handleKeydown}
        onblur={stopEditing}
        class="text-sm bg-transparent border-none outline-none text-primary-800 dark:text-primary-200 w-20 min-w-0"
        placeholder="Enter value"
      />
    {:else}
      <button
        type="button"
        class="text-sm text-primary-600 dark:text-primary-400 cursor-pointer hover:underline bg-transparent border-none p-0"
        onclick={startEditing}
        onkeydown={e => e.key === 'Enter' && startEditing()}
        title={editable ? 'Click to edit' : ''}
      >
        {value}
      </button>
    {/if}
  {/if}
  <button
    onclick={handleRemove}
    class="opacity-60 group-hover:opacity-100 hover:opacity-100 transition-opacity"
    title="Remove option"
  >
    <Icon iconName="close" size={12} />
  </button>
</div>
