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
  import { resolve } from '$app/paths';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import type { ClientJob } from '$lib/stores/jobs.svelte';
  import { getStatusColor, getStatusText } from '$lib/utils/jobStatus';
  import { formatRelativeTime } from '$lib/utils/relativeTime';

  const RECENT_JOBS_LIMIT = 5;

  const recentJobs = $derived(
    [...jobStore.jobs].sort((a, b) => b.startTime - a.startTime).slice(0, RECENT_JOBS_LIMIT),
  );

  function openJob(job: ClientJob) {
    jobStore.showJob(job.id);
  }

  function handleKeydown(event: KeyboardEvent, job: ClientJob) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openJob(job);
    }
  }
</script>

{#if recentJobs.length > 0}
  <div class="content-panel">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-lg font-medium text-accent-foreground">Recent jobs</h2>
      <a
        href={resolve('/jobs')}
        class="text-sm text-primary hover:underline"
      >
        View all
      </a>
    </div>

    <ul>
      {#each recentJobs as job, i (job.id)}
        <li>
          <div
            role="button"
            tabindex="0"
            onclick={() => openJob(job)}
            onkeydown={(e) => handleKeydown(e, job)}
            class:border-t-strong={i > 0}
            class="flex w-full min-w-0 cursor-pointer items-center gap-3 py-2 text-left transition-colors duration-150 hover:bg-surface-hover focus:outline-none focus-visible:border-focus"
            aria-label={`View details for job ${job.url}`}
          >
            <div
              class={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${getStatusColor(job.status, { emphasized: true })}`}
              aria-hidden="true"
            ></div>
            <span class="min-w-0 flex-1 truncate text-sm text-foreground">
              {job.url}
            </span>
            <span class="flex-shrink-0 text-xs font-medium text-muted-foreground">
              {getStatusText(job.status)}
            </span>
            <span class="flex-shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(job.startTime)}
            </span>
          </div>
        </li>
      {/each}
    </ul>
  </div>
{/if}
