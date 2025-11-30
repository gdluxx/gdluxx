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
  import { Badge, Info } from '#components/ui';
  import type { SubPreviewItem } from '#utils/substitution';

  interface SubPreviewProps {
    previewCount?: number;
    selectedCount?: number;
    items?: SubPreviewItem[];
  }

  let { previewCount = 0, selectedCount = 0, items = [] }: SubPreviewProps = $props();

  const hasItems = $derived(items.length > 0);
</script>

{#if selectedCount}
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-base-content ml-4 font-semibold">Preview</h3>
      <span class="text-sm">
        Modifying
        <Badge
          label="{previewCount}/{selectedCount}"
          size="sm"
        />
        {selectedCount === 1 ? 'item' : 'items'}
      </span>
    </div>

    {#if !selectedCount}
      <Info>
        <span class="text-lg">Select one or more URLs to see substitution preview</span>
      </Info>
    {:else if !previewCount}
      <Info variant="warning">
        <span class="text-lg">No matches detected with the current rules</span>
      </Info>
    {:else if hasItems}
      <div class="space-y-3">
        {#each items as item (item.original)}
          <div class="rounded-box border-base-300 bg-base-200 space-y-2 border p-3">
            <div class="text-base-content/70 text-xs font-semibold uppercase">Before</div>
            <div class="font-mono text-sm leading-snug break-all">{item.original}</div>
            <div class="text-base-content/70 text-xs font-semibold uppercase">After</div>
            <div class="text-success font-mono text-sm leading-snug break-all">{item.modified}</div>
          </div>
        {/each}
        {#if previewCount > items.length}
          <p class="text-base-content/70 text-sm">
            Showing first {items.length} updates. Additional URLs will also be modified.
          </p>
        {/if}
      </div>
    {/if}
  </div>
{/if}
