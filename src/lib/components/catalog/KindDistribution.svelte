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
  import type { CatalogOption } from '$lib/types/catalog';
  import {
    KIND_LABELS,
    KIND_ORDER,
    kindSwatchClasses,
    optionKind,
    type BucketedKind,
  } from '$lib/utils/catalogFilter';

  interface Props {
    options: CatalogOption[];
    selectedKinds: ReadonlySet<BucketedKind>;
    onToggle: (kind: BucketedKind) => void;
  }

  const { options, selectedKinds, onToggle }: Props = $props();

  const segments = $derived.by(() => {
    const counts: Record<BucketedKind, number> = {
      boolean: 0,
      string: 0,
      number: 0,
      array: 0,
      object: 0,
      custom: 0,
    };
    for (const option of options) {
      counts[optionKind(option)] += 1;
    }
    return KIND_ORDER.map((kind) => ({ kind, count: counts[kind] })).filter(
      (segment) => segment.count > 0,
    );
  });

  const isFiltered = $derived(selectedKinds.size > 0);
</script>

<div class="mt-4">
  <div
    class="flex h-7 overflow-hidden rounded-sm border border-strong"
    role="group"
    aria-label="Filter by value type"
  >
    {#each segments as segment (segment.kind)}
      <button
        type="button"
        style:flex-grow={segment.count}
        class="min-w-2 cursor-pointer border-0 p-0 transition-opacity {kindSwatchClasses(
          segment.kind,
        )}"
        class:opacity-20={isFiltered && !selectedKinds.has(segment.kind)}
        aria-pressed={selectedKinds.has(segment.kind)}
        aria-label={`Filter: ${KIND_LABELS[segment.kind]} (${segment.count} options)`}
        title={`${KIND_LABELS[segment.kind]} · ${segment.count} options`}
        onclick={() => onToggle(segment.kind)}
      ></button>
    {/each}
  </div>

  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {#each segments as segment (segment.kind)}
      <button
        type="button"
        class="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0.5 transition-opacity"
        class:opacity-45={isFiltered && !selectedKinds.has(segment.kind)}
        aria-pressed={selectedKinds.has(segment.kind)}
        onclick={() => onToggle(segment.kind)}
      >
        <span class="h-2.5 w-2.5 rounded-xs {kindSwatchClasses(segment.kind)}"></span>
        {KIND_LABELS[segment.kind]}
        <span class="text-foreground">{segment.count}</span>
      </button>
    {/each}
  </div>

  <p class="mt-1.5 text-xs text-muted-foreground">
    Every gallery-dl option, typed. Click a segment to filter by value type.
  </p>
</div>
