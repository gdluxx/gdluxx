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
  import type { SubResult } from '#utils/substitution';

  const {
    links = [],
    counts = {},
    selected = new Set(),
    compact = false,
    onToggle,
    modifiedUrls = new Set<string>(),
    urlModifications = new Map<string, SubResult>(),
  }: {
    links?: string[];
    counts?: Record<string, number>;
    selected?: Set<string>;
    compact?: boolean;
    onToggle: (url: string) => void;
    modifiedUrls?: ReadonlySet<string>;
    urlModifications?: ReadonlyMap<string, SubResult>;
  } = $props();
</script>

<div class="mt-2">
  {#if links.length > 0}
    <div class="rounded-box border-secondary bg-base-200 overflow-hidden border">
      <table
        class="table"
        class:table-xs={compact}
      >
        <thead>
          <tr class="sr-only">
            <th>Select</th>
            <th>URL</th>
            <th>Duplicates</th>
          </tr>
        </thead>
        <tbody>
          {#each links as url (url)}
            <tr
              class="hover:bg-base-300 cursor-pointer border-r-4"
              class:border-r-transparent={!selected.has(url)}
              class:border-r-accent={selected.has(url)}
              onclick={() => onToggle(url)}
            >
              <th
                class="w-1 pr-2"
                class:pl-3={compact}
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-secondary pointer-events-none"
                  class:checkbox-xs={compact}
                  checked={selected.has(url)}
                />
              </th>
              <td class="pl-2 text-left">
                <div class="flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link link-hover link-primary break-all"
                    class:text-sm={compact}
                    onclick={(e) => e.stopPropagation()}
                  >
                    {url}
                  </a>
                  {#if modifiedUrls.has(url)}
                    {#if urlModifications.has(url)}
                      <Badge
                        label="Modified"
                        dismissible={false}
                        variant="accent"
                        size={compact ? 'xs' : 'sm'}
                        title={`Original: ${urlModifications.get(url)?.initialUrl ?? ''}`}
                      />
                    {/if}
                  {/if}
                </div>
              </td>
              <td class="text-right">
                {#if counts[url] > 1}
                  <span class="text-base-content/50 text-sm">×{counts[url]}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <Info
      variant="info"
      class="mt-4"
    >
      <span class="text-lg"> No URLs found </span>
    </Info>
  {/if}
</div>
