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
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { Icon } from '$lib/components';

  const jobCount = $derived(jobStore.jobCount);
  const runningJobCount = $derived(jobStore.runningJobCount);
</script>

<div
  class="relative flex items-center justify-center rounded-sm p-2 text-muted-foreground"
  aria-label="Show jobs list"
  title="Show jobs list"
>
  <Icon
    iconName="job"
    size={24}
  />
  {#if runningJobCount > 0}
    <span
      class="absolute -top-1 -right-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-error/75 text-xs text-foreground"
    >
      {runningJobCount}
    </span>
  {:else}
    <span
      class="absolute -top-0.25 -right-0.25 flex h-5.5 w-5.5 cursor-default items-center justify-center rounded-full bg-primary/75 text-xs font-semibold text-black select-none"
    >
      {jobCount}
    </span>
  {/if}
</div>
