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
  import Icon from '#components/ui/Icon.svelte';
  import type { AppTab } from '#src/content/types';

  interface ContentTabsProps {
    active: AppTab;
    imageCount: number;
    linkCount: number;
    onchange?: (tab: AppTab) => void;
  }

  const { active, imageCount, linkCount, onchange }: ContentTabsProps = $props();

  function select(tab: AppTab): void {
    if (tab === active) return;
    onchange?.(tab);
  }
</script>

<div class="border-base-300 border-b">
  <div class="px-6">
    <div class="flex">
      <button
        class="tab tab-active text-base-content/70 hover:text-base-content flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-all duration-200"
        class:border-b-primary={active === 'images'}
        class:text-primary={active === 'images'}
        class:font-semibold={active === 'images'}
        onclick={() => select('images')}
      >
        <Icon iconName="image" />
        Images ({imageCount})
      </button>
      <button
        class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm transition-all duration-200"
        class:border-b-primary={active === 'links'}
        class:text-primary={active === 'links'}
        class:font-semibold={active === 'links'}
        onclick={() => select('links')}
      >
        <Icon iconName="link" />
        URLs ({linkCount})
      </button>
    </div>
  </div>
</div>
