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
  import Icon from '#components/ui/Icon.svelte';

  let {
    value = $bindable(''),
    inputEl = $bindable(null),
  }: {
    value: string;
    inputEl: HTMLInputElement | null;
  } = $props();
</script>

<div class="relative">
  <Icon
    iconName="magnifying-glass"
    class="text-base-content/40 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
  />
  <input
    class="input-bordered input focus:ring-primary/20 focus:input-primary w-full pr-10 pl-10 transition-all focus:ring-2"
    placeholder="Filter by keyword..."
    aria-label="Filter results by keyword"
    bind:value
    bind:this={inputEl}
  />
  {#if value}
    <button
      class="text-base-content/50 hover:text-base-content absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
      onclick={() => (value = '')}
      aria-label="Clear filter"
      type="button"
    >
      <Icon
        iconName="close"
        class="h-4 w-4"
      />
    </button>
  {/if}
</div>
