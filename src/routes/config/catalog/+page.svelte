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
  import { SvelteSet } from 'svelte/reactivity';
  import catalogData from '$lib/assets/gallery-dl-catalog.json';
  import type { CatalogArtifact } from '$lib/types/catalog';
  import { Icon } from '$lib/components';
  import { PageLayout, Button, EmptyState } from '$lib/components/ui';
  import CatalogToolbar from '$lib/components/catalog/CatalogToolbar.svelte';
  import KindDistribution from '$lib/components/catalog/KindDistribution.svelte';
  import CatalogRow from '$lib/components/catalog/CatalogRow.svelte';
  import {
    matchesFilters,
    type BucketedKind,
    type CatalogFilterState,
  } from '$lib/utils/catalogFilter';

  const catalog = catalogData as unknown as CatalogArtifact;

  interface PageData {
    success: boolean;
    current?: string | null;
  }

  const { data }: { data: PageData } = $props();

  const PAGE_SIZE = 150;

  let rawQuery = $state('');
  let debouncedQuery = $state('');
  let activeSection = $state('');
  let activeSite = $state('');
  const selectedKinds = new SvelteSet<BucketedKind>();
  let shown = $state(PAGE_SIZE);

  $effect(() => {
    const value = rawQuery;
    const timer = setTimeout(() => {
      debouncedQuery = value.trim().toLowerCase();
    }, 80);
    return () => clearTimeout(timer);
  });

  const filterState: CatalogFilterState = $derived({
    q: debouncedQuery,
    section: activeSection,
    site: activeSite,
    kinds: selectedKinds,
    families: catalog.families,
  });

  const filteredOptions = $derived(
    catalog.options.filter((option) => matchesFilters(option, filterState)),
  );

  const visibleOptions = $derived(filteredOptions.slice(0, shown));
  const hasMore = $derived(filteredOptions.length > shown);

  const isFiltered = $derived(
    debouncedQuery !== '' || activeSection !== '' || activeSite !== '' || selectedKinds.size > 0,
  );

  const siteCount = $derived.by(() => {
    if (catalog.sites.length > 0) {
      return catalog.sites.length;
    }
    const seen: Record<string, true> = {};
    for (const option of catalog.options) {
      if (option.site) {
        seen[option.site] = true;
      }
    }
    return Object.keys(seen).length;
  });

  const siteByKey = $derived.by(() => new Map(catalog.sites.map((site) => [site.k, site])));

  const runtimeVersion = $derived(data.success ? (data.current ?? null) : null);
  const versionMismatch = $derived(
    runtimeVersion !== null && runtimeVersion !== catalog.provenance.galleryDlVersion,
  );

  function toggleKind(kind: BucketedKind) {
    if (selectedKinds.has(kind)) {
      selectedKinds.delete(kind);
    } else {
      selectedKinds.add(kind);
    }
    shown = PAGE_SIZE;
  }

  function handleSectionChange(id: string) {
    activeSection = id;
    shown = PAGE_SIZE;
  }

  function handleSiteChange(value: string) {
    activeSite = value;
    shown = PAGE_SIZE;
  }

  function handleQueryInput(value: string) {
    rawQuery = value;
    shown = PAGE_SIZE;
  }

  function showMore() {
    shown += PAGE_SIZE;
  }

  function clearFilters() {
    rawQuery = '';
    debouncedQuery = '';
    activeSection = '';
    activeSite = '';
    selectedKinds.clear();
    shown = PAGE_SIZE;
  }
</script>

<PageLayout
  title="Options Catalog"
  description="Every gallery-dl configuration option, searchable, straight from docs/configuration.rst."
>
  {#snippet icon()}
    <Icon
      iconName="options"
      size={32}
    />
  {/snippet}

  <div class="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
    <span>{catalog.provenance.optionCount} options · {siteCount} sites documented</span>
    <span>
      Generated from gallery-dl
      <code class="font-mono">v{catalog.provenance.galleryDlVersion}</code>
    </span>
    {#if versionMismatch}
      <span class="text-warning">
        Running v{runtimeVersion} — catalog may not reflect this version
      </span>
    {/if}
  </div>

  <KindDistribution
    options={catalog.options}
    {selectedKinds}
    onToggle={toggleKind}
  />

  <div
    class="sticky top-0 z-10 -mx-2 mt-4 border-b border-strong bg-background px-2 py-3 sm:mx-0 sm:px-0"
  >
    <CatalogToolbar
      query={rawQuery}
      onQueryInput={handleQueryInput}
      sections={catalog.sections}
      totalCount={catalog.options.length}
      {activeSection}
      onSectionChange={handleSectionChange}
      options={catalog.options}
      sites={catalog.sites}
      {activeSite}
      onSiteChange={handleSiteChange}
      resultCount={filteredOptions.length}
      {isFiltered}
    />
  </div>

  {#if filteredOptions.length === 0}
    <EmptyState
      icon="magnifying-glass"
      title="No options match"
      description="Try a different search or filter."
      class="py-12"
    >
      <Button
        variant="outline-primary"
        size="sm"
        onclick={clearFilters}
        class="mt-4"
      >
        Clear filters
      </Button>
    </EmptyState>
  {:else}
    <div>
      {#each visibleOptions as option (option.n)}
        <CatalogRow
          {option}
          customTypes={catalog.customTypes}
          families={catalog.families}
          {siteByKey}
        />
      {/each}
    </div>

    {#if hasMore}
      <div class="flex justify-center pt-6">
        <Button
          variant="outline-primary"
          size="sm"
          onclick={showMore}
        >
          Show {Math.min(PAGE_SIZE, filteredOptions.length - shown)} more of {filteredOptions.length}
        </Button>
      </div>
    {/if}
  {/if}
</PageLayout>
