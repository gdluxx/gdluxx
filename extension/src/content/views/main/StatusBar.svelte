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
  import type { AppTab } from '#src/content/types';

  interface StatusBarProps {
    activeTab: AppTab;
    visibleCount: number;
    totalLinks: number;
    totalImages: number;
    selectedCount: number;
    compact: boolean;
    onCompactChange: (checked: boolean) => void;
  }

  let {
    activeTab,
    visibleCount,
    totalLinks,
    totalImages,
    selectedCount,
    compact,
    onCompactChange,
  }: StatusBarProps = $props();
</script>

<div class="flex h-12 items-center justify-between gap-3 px-6">
  {#if activeTab !== 'settings'}
    <div class="text-base-content/50 flex gap-3">
      <span>
        Visible: {visibleCount} / {activeTab === 'links'
          ? totalLinks
          : activeTab === 'images'
            ? totalImages
            : 0}
      </span>
      <span>Selected: {selectedCount}</span>
    </div>
    <label class="text-base-content/50 text-sm">
      <input
        type="checkbox"
        class="toggle toggle-accent toggle-xs"
        checked={compact}
        onchange={(event) => onCompactChange((event.target as HTMLInputElement).checked)}
      /> Compact rows
    </label>
  {/if}
</div>
