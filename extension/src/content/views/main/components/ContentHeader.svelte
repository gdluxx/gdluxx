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

  const {
    active,
    linkCount,
    imageCount,
  }: {
    active: AppTab;
    linkCount: number;
    imageCount: number;
  } = $props();

  const headerTitle = $derived(
    active === 'links' ? 'URLs Found' : active === 'images' ? 'Images Found' : 'Settings',
  );

  const count = $derived(active === 'links' ? linkCount : active === 'images' ? imageCount : 0);
</script>

<div class="bg-base-200 rounded-box flex h-12 cursor-default items-center gap-4 px-4">
  <span class="font-medium">
    {headerTitle}
  </span>
  {#if headerTitle !== 'Settings'}
    <span class="badge badge-accent font-semibold">
      {count}
    </span>
  {/if}
</div>
