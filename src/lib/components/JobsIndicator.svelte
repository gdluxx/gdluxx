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
  import { Icon } from '$lib/components/index';

  const jobCount = $derived(jobStore.jobCount);
  const runningJobCount = $derived(jobStore.runningJobCount);

  function handleClick() {
    jobStore.showJobListModal();
  }
</script>

<button
  onclick={handleClick}
  class="relative flex items-center justify-center p-2 text-secondary-900 dark:text-secondary-100 hover:bg-secondary-200 dark:hover:bg-secondary-800 rounded-md transition-colors cursor-pointer"
  aria-label="Show jobs list"
  title="Show jobs list"
>
  <Icon iconName="job" size={24} />
  {#if runningJobCount > 0}
    <span
      class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse"
    >
      {runningJobCount}
    </span>
  {:else}
    <span
      class="absolute -top-0.25 -right-0.25 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
    >
      {jobCount}
    </span>
  {/if}
</button>
