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
  import type { Snippet } from 'svelte';
  import { Badge } from '#components/ui/index.ts';

  let {
    expanded = $bindable(false),
    title,
    hasActiveFilters = false,
    children,
    class: className = '',
  }: {
    expanded?: boolean;
    title: string;
    hasActiveFilters?: boolean;
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class="collapse-arrow border-base-300/50 bg-base-100 collapse border {className}">
  <input
    type="checkbox"
    bind:checked={expanded}
  />
  <div
    class="collapse-title flex items-center justify-between text-lg font-medium"
    class:bg-base-200={expanded}
  >
    <div class="flex items-center gap-3">
      <span>{title}</span>
      {#if hasActiveFilters && !expanded}
        <Badge
          label="Active"
          variant="info"
        />
      {/if}
    </div>
  </div>
  <div class="collapse-content">
    {@render children?.()}
  </div>
</div>
