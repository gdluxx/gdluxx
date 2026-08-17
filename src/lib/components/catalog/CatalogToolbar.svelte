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
  import type { CatalogOption, CatalogSection, CatalogSite } from '$lib/types/catalog';
  import SitePicker from './SitePicker.svelte';

  interface Props {
    query: string;
    onQueryInput: (value: string) => void;
    sections: CatalogSection[];
    totalCount: number;
    activeSection: string;
    onSectionChange: (id: string) => void;
    options: CatalogOption[];
    sites: CatalogSite[];
    activeSite: string;
    onSiteChange: (value: string) => void;
    resultCount: number;
    isFiltered: boolean;
  }

  const {
    query,
    onQueryInput,
    sections,
    totalCount,
    activeSection,
    onSectionChange,
    options,
    sites,
    activeSite,
    onSiteChange,
    resultCount,
    isFiltered,
  }: Props = $props();

  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== '/') {
        return;
      }
      const active = document.activeElement;
      if (active === inputEl) {
        return;
      }
      if (active instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) {
        return;
      }
      event.preventDefault();
      inputEl?.focus();
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="flex flex-col gap-2.5">
  <div class="flex items-center gap-2.5">
    <label
      class="flex flex-1 items-center gap-2 rounded-sm border border-strong bg-surface px-3 py-2 focus-within:border-focus focus-within:ring-1 focus-within:ring-primary"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        aria-hidden="true"
        class="flex-shrink-0 text-muted-foreground"
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        ></circle>
        <path d="m20 20-3.5-3.5"></path>
      </svg>
      <input
        bind:this={inputEl}
        type="search"
        value={query}
        oninput={(event) => onQueryInput((event.target as HTMLInputElement).value)}
        placeholder={`Search ${totalCount} options… e.g. filename, sleep, pixiv`}
        aria-label="Search options"
        class="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <kbd
        class="flex-shrink-0 rounded-xs border border-strong px-1.5 text-xs text-muted-foreground"
        >/</kbd
      >
    </label>

    <SitePicker
      {sites}
      {options}
      value={activeSite}
      onChange={onSiteChange}
    />
  </div>

  <div
    class="flex flex-wrap items-center gap-1.5"
    role="group"
    aria-label="Filter by section"
  >
    <button
      type="button"
      class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors {activeSection ===
      ''
        ? 'border-primary bg-primary text-on-primary'
        : 'border-strong bg-surface text-muted-foreground hover:border-primary hover:text-foreground'}"
      aria-pressed={activeSection === ''}
      onclick={() => onSectionChange('')}
    >
      All · {totalCount}
    </button>
    {#each sections as section (section.id)}
      <button
        type="button"
        class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors {activeSection ===
        section.id
          ? 'border-primary bg-primary text-on-primary'
          : 'border-strong bg-surface text-muted-foreground hover:border-primary hover:text-foreground'}"
        aria-pressed={activeSection === section.id}
        onclick={() => onSectionChange(section.id)}
      >
        {section.label} · {section.count}
      </button>
    {/each}

    {#if isFiltered}
      <span class="ml-auto text-xs tabular-nums text-muted-foreground">
        <b class="font-semibold text-foreground">{resultCount}</b>
        {resultCount === 1 ? 'match' : 'matches'}
      </span>
    {/if}
  </div>
</div>
