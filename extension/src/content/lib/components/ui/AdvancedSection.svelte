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
  import { Badge, Button, Icon } from '#components/ui/index.ts';

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

<div class="border-base-300 card bg-base-100 border">
  <button
    class="border-base-300 flex w-full items-center justify-between border-b px-4 py-3 text-left font-medium"
  >
    <div class="flex items-center gap-3">
      <h2 class="card-title text-xl">{title}</h2>
      {#if hasActiveFilters && !expanded}
        <Badge
          label="Active"
          variant="info"
        />
      {/if}
    </div>
    <Button
      variant="ghost"
      size="xs"
      square
      onclick={() => (expanded = !expanded)}
    >
      <Icon iconName="close" />
    </Button>
  </button>

  {#if expanded}
    <div class="p-4">
      {@render children?.()}
    </div>
  {/if}
</div>
