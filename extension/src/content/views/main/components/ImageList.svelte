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
    images = [],
    counts = {},
    selected = new Set(),
    compact = false,
    showHoverPreview,
    updateHoverPosition,
    hideHoverPreview,
    onToggle,
    showImagePreviews = false,
    modifiedUrls = new Set<string>(),
    urlModifications = new Map<string, SubResult>(),
    applyToPreview = false,
  }: {
    images?: string[];
    counts?: Record<string, number>;
    selected?: Set<string>;
    compact?: boolean;
    showHoverPreview: (url: string, event: MouseEvent | FocusEvent) => void;
    updateHoverPosition: (event: MouseEvent) => void;
    hideHoverPreview: () => void;
    onToggle: (url: string) => void;
    showImagePreviews?: boolean;
    modifiedUrls?: ReadonlySet<string>;
    urlModifications?: ReadonlyMap<string, SubResult>;
    applyToPreview?: boolean;
  } = $props();

  let imageErrors = $state<Set<string>>(new Set());

  function handleImageError(url: string) {
    imageErrors.add(url);
    imageErrors = imageErrors; // Trigger reactivity
  }

  function getDisplayUrl(url: string): string {
    const modification = urlModifications.get(url);
    if (!modification) return url;
    return applyToPreview ? modification.modifiedUrl : modification.initialUrl;
  }
</script>

<div class="mt-2">
  {#if images.length > 0}
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
          {#each images as url (url)}
            <tr
              class="hover:bg-base-300 cursor-pointer border-r-4"
              class:border-r-transparent={!selected.has(url)}
              class:border-r-accent={selected.has(url)}
              onclick={() => onToggle(url)}
              onmouseenter={(event) => showHoverPreview(url, event)}
              onmousemove={updateHoverPosition}
              onmouseleave={hideHoverPreview}
              onfocus={(event) => showHoverPreview(url, event)}
              onblur={hideHoverPreview}
            >
              <th class="w-1 pr-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-secondary pointer-events-none rounded-sm"
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

              {#if showImagePreviews}
                <td>
                  <img
                    src={getDisplayUrl(url)}
                    alt="Preview"
                    class="max-h-40 rounded-2xl object-contain object-right"
                    loading="lazy"
                    decoding="async"
                    referrerpolicy="no-referrer"
                    style:display={imageErrors.has(url) ? 'none' : 'block'}
                    onerror={() => handleImageError(url)}
                  />
                </td>
              {/if}
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
      <span class="text-lg"> No images found </span>
    </Info>
  {/if}
</div>
