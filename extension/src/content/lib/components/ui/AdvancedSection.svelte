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
  }: {
    expanded?: boolean;
    title: string;
    hasActiveFilters?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div class="collapse-arrow border-base-300 bg-base-300 collapse border">
  <input
    type="checkbox"
    bind:checked={expanded}
  />
  <div
    class="collapse-title flex items-center justify-between text-xl font-medium {expanded
      ? 'bg-accent text-accent-content'
      : ''}"
  >
    <div class="flex items-center gap-3">
      <span>{title}</span>
      {#if hasActiveFilters && !expanded}
        <Badge
          label="Active"
          variant="primary"
        />
      {/if}
    </div>
  </div>
  <div class="collapse-content">
    {@render children?.()}
  </div>
</div>
