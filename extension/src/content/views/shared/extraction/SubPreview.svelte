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
    sourceCount?: number;
    isSample?: boolean;
    sampleTotal?: number;
    items?: SubPreviewItem[];
  }

  let {
    previewCount = 0,
    sourceCount = 0,
    isSample = false,
    sampleTotal = 0,
    items = [],
  }: SubPreviewProps = $props();

  const hasSource = $derived(sourceCount > 0);
  const isTruncatedSample = $derived(isSample && sampleTotal > sourceCount);
</script>

<div class="space-y-3">
  {#if !hasSource}
    <Info>
      <span class="text-lg">
        Nothing to preview yet - extract URLs or images, or select some, to see substitution
        results.
      </span>
    </Info>
  {:else}
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-base-content ml-4 font-semibold">Preview</h3>
        {#if isSample}
          <Badge
            label="Sample"
            variant="outline-info"
            size="sm"
          />
        {/if}
      </div>
      <span class="text-sm">
        Modifying
        <Badge
          label="{previewCount}/{sourceCount}"
          size="sm"
        />
        {#if isTruncatedSample}
          of {sampleTotal} extracted URLs
        {:else if isSample}
          extracted {sourceCount === 1 ? 'URL' : 'URLs'}
        {:else}
          selected {sourceCount === 1 ? 'item' : 'items'}
        {/if}
      </span>
    </div>

    {#if isSample}
      <p class="text-base-content/60 ml-4 text-xs">
        Nothing is selected, so this previews all extracted URLs. Select URLs or images in the list
        to apply these rules.
      </p>
    {/if}

    {#if !previewCount}
      <Info
        variant="warning"
        size="sm"
        soft
      >
        <span class="text-lg">No matches detected with the current rules</span>
      </Info>
    {:else}
      <div class="space-y-3">
        {#each items as item, i (`${i}:${item.original}`)}
          <div class="rounded-box border-base-300 bg-base-200 border p-3">
            <div class="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-2">
              <span class="text-base-content/70 text-xs font-semibold uppercase">Before:</span>
              <span class="font-mono text-sm leading-snug break-all">{item.original}</span>
              <span class="text-base-content/70 text-xs font-semibold uppercase">After:</span>
              <span class="text-accent font-mono text-sm leading-snug break-all"
                >{item.modified}</span
              >
            </div>
          </div>
        {/each}
        {#if previewCount > items.length}
          <p class="text-base-content/70 text-sm">
            Showing first {items.length} updates. Additional URLs will also be modified.
          </p>
        {/if}
      </div>
    {/if}
  {/if}
</div>
