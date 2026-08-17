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
  import type { CatalogFamily, CatalogOption, CatalogSite } from '$lib/types/catalog';
  import { bucketKind, kindBadgeClasses } from '$lib/utils/catalogFilter';
  import CatalogDetail from './CatalogDetail.svelte';

  interface Props {
    option: CatalogOption;
    customTypes: Record<string, string>;
    families: Record<string, CatalogFamily>;
    siteByKey: Map<string, CatalogSite>;
  }

  const { option, customTypes, families, siteByKey }: Props = $props();

  let open = $state(false);

  const nameParts = $derived.by(() => {
    const i = option.n.lastIndexOf('.');
    return i < 0
      ? { prefix: '', rest: option.n }
      : { prefix: option.n.slice(0, i + 1), rest: option.n.slice(i + 1) };
  });

  const familyBadge = $derived.by(() => {
    if (!option.fam) {
      return undefined;
    }
    const family = families[option.fam];
    if (!family || family.members.length === 0) {
      return undefined;
    }
    return { label: family.label, count: family.members.length };
  });

  const site = $derived(option.site ? siteByKey.get(option.site) : undefined);

  const defaultPreview = $derived.by(() => {
    if (!option.def) {
      return '';
    }
    const text = option.def.p ? JSON.stringify(option.def.v) : option.def.x;
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  });

  const detailId = $derived(`catalog-detail-${option.n.replace(/[^a-zA-Z0-9]/g, '-')}`);
</script>

<div class="mt-5 rounded-sm border border-strong">
  <button
    type="button"
    class="w-full cursor-pointer rounded-sm px-3 pt-3 text-left transition-colors hover:bg-surface-hover {open
      ? 'pb-2'
      : 'pb-5'}"
    aria-expanded={open}
    aria-controls={detailId}
    onclick={() => (open = !open)}
  >
    <span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span class="font-mono text-sm font-semibold text-foreground break-all">
        <span class="font-normal text-muted-foreground">{nameParts.prefix}</span>{nameParts.rest}
      </span>
      {#each option.t.slice(0, 3) as ref (ref.x)}
        <span
          class="rounded-xs px-1.5 py-px font-mono text-[10.5px] font-medium whitespace-nowrap {kindBadgeClasses(
            bucketKind(ref.k),
          )}"
          title={customTypes[ref.x]}
        >
          {ref.x}
        </span>
      {/each}
      {#if familyBadge}
        <span
          class="rounded-full border border-strong px-2 py-px text-[10.5px] font-medium whitespace-nowrap text-muted-foreground"
          title={`Applies to every ${familyBadge.label} instance`}
        >
          {familyBadge.label} · {familyBadge.count} sites
        </span>
      {/if}
      {#if defaultPreview}
        <span class="ml-auto max-w-[34ch] truncate font-mono text-xs text-foreground/80">
          = {defaultPreview}
        </span>
      {/if}
    </span>
    {#if option.d && !open}
      <span class="mt-3 line-clamp-2 block max-w-[70ch] text-sm text-foreground">
        {option.d}
      </span>
    {/if}
  </button>

  {#if open}
    <div
      id={detailId}
      class="px-3 pb-5"
    >
      <CatalogDetail
        {option}
        {site}
      />
    </div>
  {/if}
</div>
