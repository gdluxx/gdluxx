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
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import type { ClientJob } from '$lib/stores/jobs.svelte';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { Button, Info, ConfirmModal } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import type { Job } from '$lib/server/jobs/jobManager';

  const tooltip = $state({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

  interface Props {
    variant?: 'modal' | 'page';
    isOpen?: boolean;
    onClose?: () => void;
    initialJobs?: Job[];
  }

  const { variant = 'page', isOpen = true, onClose, initialJobs = [] }: Props = $props();

  let showDeleteConfirm = $state(false);
  let deleteAction = $state<'single' | 'all' | 'selected'>('all');
  let jobToDelete = $state<string | null>(null);
  let sortNewestFirst = $state(true);
  let sortBy = $state<'time' | 'downloads'>('time');
  let statusFilter = $state<'all' | 'running' | 'success' | 'no_action' | 'error'>('all');
  let selectedJobs = $state<Set<string>>(new Set());

  const allJobs = $derived(jobStore.jobs);
  const filteredJobs = $derived(
    statusFilter === 'all' ? allJobs : allJobs.filter(job => job.status === statusFilter)
  );
  const jobs = $derived(
    [...filteredJobs].sort((a, b) => {
      if (sortBy === 'downloads') {
        const aDownloads = a.downloadCount ?? 0;
        const bDownloads = b.downloadCount ?? 0;
        return sortNewestFirst ? bDownloads - aDownloads : aDownloads - bDownloads;
      } else {
        return sortNewestFirst ? b.startTime - a.startTime : a.startTime - b.startTime;
      }
    })
  );
  const selectedCount = $derived(selectedJobs.size);
  const hasSelection = $derived(selectedCount > 0);
  const allSelected = $derived(selectedCount === jobs.length && jobs.length > 0);

  // Aggregate statistics
  const aggregateStats = $derived(() => {
    const stats = {
      total: allJobs.length,
      running: allJobs.filter(job => job.status === 'running').length,
      success: allJobs.filter(job => job.status === 'success').length,
      noAction: allJobs.filter(job => job.status === 'no_action').length,
      error: allJobs.filter(job => job.status === 'error').length,
      totalDownloads: allJobs.reduce((sum, job) => sum + (job.downloadCount ?? 0), 0),
      totalSkips: allJobs.reduce((sum, job) => sum + (job.skipCount ?? 0), 0),
    };
    return stats;
  });

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && variant === 'modal' && onClose) {
      onClose();
    }
  }

  function getStatusColor(status: ClientJob['status']): string {
    switch (status) {
      case 'running':
        return 'bg-blue-500 shadow-lg animate-pulse';
      case 'success':
        return 'bg-green-500 shadow-lg';
      case 'no_action':
        return 'bg-yellow-500 shadow-lg';
      case 'error':
        return 'bg-red-500 shadow-lg';
      default:
        return 'bg-gray-500';
    }
  }

  function getStatusText(status: ClientJob['status']): string {
    switch (status) {
      case 'running':
        return 'Running';
      case 'success':
        return 'Success';
      case 'no_action':
        return 'No Action';
      case 'error':
        return 'Error';
      default:
        console.warn(`Unknown job status encountered: "${status}". This may indicate a data migration issue.`);
        return 'Unknown';
    }
  }

  function getStatusTooltip(job: ClientJob): string {
    switch (job.status) {
      case 'running':
        return 'Job is currently downloading...';
      case 'success':
        return `Completed successfully with ${job.downloadCount} file(s) downloaded${job.skipCount > 0 ? ` and ${job.skipCount} file(s) skipped` : ''}`;
      case 'no_action':
        return `Completed with no new downloads${job.skipCount > 0 ? ` (${job.skipCount} file(s) already exist)` : ''}`;
      case 'error':
        return `Failed with exit code ${job.exitCode ?? 'unknown'}`;
      default:
        return 'Status unknown';
    }
  }

  function showTooltip(event: MouseEvent, text: string) {
    tooltip.text = text;
    tooltip.x = event.clientX;
    tooltip.y = event.clientY;
    tooltip.visible = true;
  }

  function hideTooltip() {
    tooltip.visible = false;
  }

  function formatDuration(startTime: number, endTime?: number): string {
    const end = endTime ?? Date.now();
    const duration = Math.floor((end - startTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function handleJobClick(job: ClientJob) {
    jobStore.showJob(job.id);
    if (variant === 'modal' && onClose) {
      onClose();
    }
  }

  function deleteAllJobs(event: MouseEvent) {
    event.stopPropagation();
    deleteAction = 'all';
    jobToDelete = null;
    showDeleteConfirm = true;
  }

  function deleteSelectedJobs(event: MouseEvent) {
    event.stopPropagation();
    deleteAction = 'selected';
    jobToDelete = null;
    showDeleteConfirm = true;
  }

  function toggleSort() {
    sortNewestFirst = !sortNewestFirst;
  }

  function setSortBy(newSortBy: 'time' | 'downloads') {
    sortBy = newSortBy;
  }

  function setStatusFilter(newFilter: 'all' | 'running' | 'success' | 'no_action' | 'error') {
    statusFilter = newFilter;
    // Clear selection when changing filter
    selectedJobs.clear();
    selectedJobs = new Set(selectedJobs);
  }

  function toggleJobSelection(jobId: string) {
    if (selectedJobs.has(jobId)) {
      selectedJobs.delete(jobId);
    } else {
      selectedJobs.add(jobId);
    }
    selectedJobs = new Set(selectedJobs);
  }

  function toggleSelectAll() {
    if (allSelected) {
      selectedJobs.clear();
    } else {
      selectedJobs = new Set(jobs.map(job => job.id));
    }
    selectedJobs = new Set(selectedJobs);
  }

  function deleteJob(event: MouseEvent, jobId: string) {
    event.stopPropagation();
    deleteAction = 'single';
    jobToDelete = jobId;
    showDeleteConfirm = true;
  }

  function confirmDelete() {
    if (deleteAction === 'single' && jobToDelete) {
      jobStore.deleteJob(jobToDelete);
    } else if (deleteAction === 'all') {
      jobs.forEach(function (job) {
        jobStore.deleteJob(job.id);
      });
    } else if (deleteAction === 'selected') {
      Array.from(selectedJobs).forEach(function (jobId) {
        jobStore.deleteJob(jobId);
      });
      selectedJobs.clear();
      selectedJobs = new Set(selectedJobs);
    }
    showDeleteConfirm = false;
    jobToDelete = null;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    jobToDelete = null;
  }

  const getHeightClass = () => {
    if (variant === 'modal') {
      return 'max-h-[calc(80vh-theme(spacing.16)-theme(spacing.16))]';
    } else {
      return 'min-h-[60vh]';
    }
  };

  const getContainerClass = () => {
    if (variant === 'modal') {
      return 'relative flex max-h-[80vh] w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl flex-col overflow-hidden bg-primary-50 hover:dark:border-primary-400 rounded-sm border hover:border-primary-600 dark:bg-primary-800';
    } else {
      return 'bg-primary-50 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800';
    }
  };

  // Initialize job store with server-provided data on mount
  onMount(() => {
    if (initialJobs.length > 0) {
      jobStore.initializeWithJobs(initialJobs);
    }
  });
</script>

{#if variant === 'page' || (variant === 'modal' && isOpen)}
  {#if variant === 'modal'}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      transition:fade={{ duration: 200 }}
      onclick={handleBackdropClick}
      onkeydown={e => e.key === 'Escape' && onClose && onClose()}
      role="button"
      tabindex="-1"
    >
      <div
        class={getContainerClass()}
        transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}
      >
        <!-- Header -->
        <div
          class="cursor-default border-b border-secondary-200 px-6 py-4 dark:border-secondary-700"
        >
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
              Jobs: {jobs.length} / {aggregateStats().total}
              {#if hasSelection}
                <span class="text-sm text-secondary-600 dark:text-secondary-400">
                  ({selectedCount} selected)
                </span>
              {/if}
            </h2>
          </div>

          <!-- Aggregate Statistics -->
          <div class="flex items-center gap-4 text-sm mb-3">
            <span class="text-blue-600 dark:text-blue-400"
              >🔵 {aggregateStats().running} Running</span
            >
            <span class="text-green-600 dark:text-green-400"
              >🟢 {aggregateStats().success} Success</span
            >
            <span class="text-yellow-600 dark:text-yellow-400"
              >🟡 {aggregateStats().noAction} No Action</span
            >
            <span class="text-red-600 dark:text-red-400">🔴 {aggregateStats().error} Error</span>
            {#if aggregateStats().totalDownloads > 0}
              <span class="text-green-600 dark:text-green-400"
                >↓ {aggregateStats().totalDownloads} Downloads</span
              >
            {/if}
            {#if aggregateStats().totalSkips > 0}
              <span class="text-yellow-600 dark:text-yellow-400"
                >⊘ {aggregateStats().totalSkips} Skips</span
              >
            {/if}
          </div>

          <!-- Controls -->
          <div class="flex items-center justify-between">
            <!-- Status Filter -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-secondary-600 dark:text-secondary-400">Filter:</span>
              <select
                bind:value={statusFilter}
                onchange={() => setStatusFilter(statusFilter)}
                class="text-sm bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="running">Running ({aggregateStats().running})</option>
                <option value="success">Success ({aggregateStats().success})</option>
                <option value="no_action">No Action ({aggregateStats().noAction})</option>
                <option value="error">Error ({aggregateStats().error})</option>
              </select>
            </div>
            <!-- Sort Options -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-secondary-600 dark:text-secondary-400">Sort by:</span>
              <select
                bind:value={sortBy}
                onchange={() => setSortBy(sortBy)}
                class="text-sm bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded px-2 py-1"
              >
                <option value="time">Time</option>
                <option value="downloads">Downloads</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              {#if jobs.length > 0}
                <Button
                  onclick={toggleSort}
                  aria-label={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
                  variant="outline-primary"
                  size="sm"
                  title={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
                >
                  <Icon iconName="sort" size={16} class={sortNewestFirst ? '' : 'rotate-180'} />
                </Button>

                <Button
                  onclick={toggleSelectAll}
                  aria-label={allSelected ? 'Deselect all' : 'Select all'}
                  variant="outline-primary"
                  size="sm"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>

                {#if hasSelection}
                  <Button
                    name="Delete Selected Jobs"
                    onclick={deleteSelectedJobs}
                    aria-label="Delete Selected Jobs"
                    variant="danger"
                    size="sm"
                  >
                    Delete Selected ({selectedCount})
                  </Button>
                {:else}
                  <Button
                    name="Delete All Jobs"
                    onclick={deleteAllJobs}
                    aria-label="Delete All Jobs"
                    variant="danger"
                    size="sm"
                  >
                    Delete All
                  </Button>
                {/if}
              {/if}

              <!-- Close button for modal -->
              <Button
                variant="primary"
                onclick={onClose}
                aria-label="Close Job List"
                title="Minimize"
                size="sm"
              >
                <Icon iconName="minimize" size={20} />
              </Button>
            </div>
          </div>
        </div>

        <!-- Job List -->
        <div class={`${getHeightClass()} overflow-y-auto`}>
          {#if jobs.length === 0}
            <div class="p-8 text-center text-secondary-600 dark:text-secondary-400">
              No jobs to display
            </div>
          {:else}
            <ul class="divide-y divide-secondary-200 dark:divide-secondary-700">
              {#each jobs as job (job.id)}
                <li
                  class="flex w-full items-center justify-between p-4 transition-colors hover:bg-primary-100 dark:hover:bg-primary-900 hover:rounded-sm"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onchange={() => toggleJobSelection(job.id)}
                      class="w-4 h-4 text-primary-600 bg-white border-2 border-primary-300 rounded transition-all duration-150 ease-in-out hover:border-primary-400 focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:border-primary-500 checked:bg-primary-600 checked:border-primary-600 checked:hover:bg-primary-700 checked:hover:border-primary-700 dark:bg-primary-800 dark:border-primary-600 dark:checked:bg-primary-500 dark:checked:border-primary-500 dark:hover:border-primary-500 dark:focus:ring-primary-400 dark:focus:ring-offset-primary-900"
                      aria-label={`Select job ${job.url}`}
                    />
                    <button
                      onclick={() => handleJobClick(job)}
                      class="flex min-w-0 flex-1 cursor-pointer flex-col text-left hover:scale-101 focus:outline-none"
                      aria-label={`View details for job ${job.url}`}
                    >
                      <div class="flex-grow">
                        <div class="mb-1 flex items-center gap-2">
                          <div
                            class={`h-3 w-3 rounded-full cursor-help transition-transform hover:scale-125 ${getStatusColor(job.status)}`}
                            onmouseenter={e => showTooltip(e, getStatusTooltip(job))}
                            onmouseleave={hideTooltip}
                            title={getStatusTooltip(job)}
                            role="tooltip"
                            aria-label={getStatusTooltip(job)}
                          ></div>
                          <span
                            class="text-sm font-medium text-secondary-900 dark:text-secondary-100"
                          >
                            {getStatusText(job.status)}
                          </span>

                          <!-- Show download/skip counts for completed jobs -->
                          {#if job.status === 'success' || job.status === 'no_action'}
                            <span class="text-xs text-secondary-600 dark:text-secondary-400">
                              {#if job.downloadCount > 0}
                                <span class="text-green-600 dark:text-green-400">
                                  ↓{job.downloadCount}
                                </span>
                              {/if}
                              {#if job.skipCount > 0}
                                <span class="text-yellow-600 dark:text-yellow-400">
                                  ⊘{job.skipCount}
                                </span>
                              {/if}
                            </span>
                          {/if}

                          <span class="text-xs text-secondary-500 dark:text-secondary-400">
                            {formatDuration(job.startTime, job.endTime)}
                          </span>
                        </div>
                        <p class="truncate text-sm text-secondary-700 dark:text-secondary-300">
                          {job.url}
                        </p>
                      </div>

                      <span class="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
                        Started: {new Date(job.startTime).toLocaleString()}
                        {#if job.endTime}
                          | Ended: {new Date(job.endTime).toLocaleString()}
                        {/if}
                      </span>
                    </button>
                  </div>
                  <button
                    onclick={e => deleteJob(e, job.id)}
                    class="ml-4 flex-shrink-0 cursor-pointer p-2 text-secondary-600 transition-all hover:scale-120 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400"
                    title="Delete job"
                    aria-label={`Delete job ${job.url}`}
                  >
                    <Icon iconName="delete" size={20} />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <!-- Page variant -->
    <div class={getContainerClass()}>
      <!-- Header -->
      <div class="cursor-default border-b border-secondary-200 px-6 py-4 dark:border-secondary-700">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
            Jobs: {jobs.length} / {aggregateStats().total}
            {#if hasSelection}
              <span class="text-sm text-secondary-600 dark:text-secondary-400">
                ({selectedCount} selected)
              </span>
            {/if}
          </h2>
        </div>

        <!-- Aggregate Statistics -->
        <div class="flex items-center gap-4 text-sm mb-3">
          <span class="text-blue-600 dark:text-blue-400">🔵 {aggregateStats().running} Running</span
          >
          <span class="text-green-600 dark:text-green-400"
            >🟢 {aggregateStats().success} Success</span
          >
          <span class="text-yellow-600 dark:text-yellow-400"
            >🟡 {aggregateStats().noAction} No Action</span
          >
          <span class="text-red-600 dark:text-red-400">🔴 {aggregateStats().error} Error</span>
          {#if aggregateStats().totalDownloads > 0}
            <span class="text-green-600 dark:text-green-400"
              >↓ {aggregateStats().totalDownloads} Downloads</span
            >
          {/if}
          {#if aggregateStats().totalSkips > 0}
            <span class="text-yellow-600 dark:text-yellow-400"
              >⊘ {aggregateStats().totalSkips} Skips</span
            >
          {/if}
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-between">
          <!-- Status Filter -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-secondary-600 dark:text-secondary-400">Filter:</span>
            <select
              bind:value={statusFilter}
              onchange={() => setStatusFilter(statusFilter)}
              class="text-sm bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="running">Running ({aggregateStats().running})</option>
              <option value="success">Success ({aggregateStats().success})</option>
              <option value="no_action">No Action ({aggregateStats().noAction})</option>
              <option value="error">Error ({aggregateStats().error})</option>
            </select>
          </div>
          <!-- Sort Options -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-secondary-600 dark:text-secondary-400">Sort by:</span>
            <select
              bind:value={sortBy}
              onchange={() => setSortBy(sortBy)}
              class="text-sm bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded px-2 py-1"
            >
              <option value="time">Time</option>
              <option value="downloads">Downloads</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            {#if jobs.length > 0}
              <Button
                onclick={toggleSort}
                aria-label={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
                variant="outline-primary"
                size="sm"
                title={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
              >
                <Icon iconName="sort" size={20} class={sortNewestFirst ? '' : 'rotate-180'} />
              </Button>

              <Button
                onclick={toggleSelectAll}
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
                variant="outline-primary"
                size="sm"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>

              {#if hasSelection}
                <Button
                  name="Delete Selected Jobs"
                  onclick={deleteSelectedJobs}
                  aria-label="Delete Selected Jobs"
                  variant="danger"
                  size="sm"
                >
                  Delete Selected ({selectedCount})
                </Button>
              {:else}
                <Button
                  name="Delete All Jobs"
                  onclick={deleteAllJobs}
                  aria-label="Delete All Jobs"
                  variant="danger"
                  size="sm"
                >
                  Delete All
                </Button>
              {/if}
            {/if}
          </div>
        </div>
      </div>

      <!-- Job list -->
      <div class={`${getHeightClass()} overflow-y-auto`}>
        {#if jobs.length === 0}
          <div class="p-8 text-center text-secondary-600 dark:text-secondary-400">
            No jobs to display
          </div>
        {:else}
          <ul class="divide-y divide-secondary-200 dark:divide-secondary-700">
            {#each jobs as job (job.id)}
              <li
                class="flex w-full items-center justify-between p-4 transition-colors hover:bg-primary-100 dark:hover:bg-primary-900 hover:rounded-sm"
              >
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedJobs.has(job.id)}
                    onchange={() => toggleJobSelection(job.id)}
                    class="w-4 h-4 text-primary-600 bg-white border-2 border-primary-300 rounded transition-all duration-150 ease-in-out hover:border-primary-400 focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 focus:border-primary-500 checked:bg-primary-600 checked:border-primary-600 checked:hover:bg-primary-700 checked:hover:border-primary-700 dark:bg-primary-800 dark:border-primary-600 dark:checked:bg-primary-500 dark:checked:border-primary-500 dark:hover:border-primary-500 dark:focus:ring-primary-400 dark:focus:ring-offset-primary-900"
                    aria-label={`Select job ${job.url}`}
                  />
                  <button
                    onclick={() => handleJobClick(job)}
                    class="flex min-w-0 flex-1 cursor-pointer flex-col text-left hover:scale-101 focus:outline-none"
                    aria-label={`View details for job ${job.url}`}
                  >
                    <div class="flex-grow">
                      <div class="mb-1 flex items-center gap-2">
                        <div
                          class={`h-3 w-3 rounded-full cursor-help transition-transform hover:scale-125 ${getStatusColor(job.status)}`}
                          onmouseenter={e => showTooltip(e, getStatusTooltip(job))}
                          onmouseleave={hideTooltip}
                          title={getStatusTooltip(job)}
                          role="tooltip"
                          aria-label={getStatusTooltip(job)}
                        ></div>
                        <span
                          class="text-sm font-medium text-secondary-900 dark:text-secondary-100"
                        >
                          {getStatusText(job.status)}
                        </span>

                        <!-- Show download/skip counts for completed jobs -->
                        {#if job.status === 'success' || job.status === 'no_action'}
                          <span class="text-xs text-secondary-600 dark:text-secondary-400">
                            {#if job.downloadCount > 0}
                              <span class="text-green-600 dark:text-green-400">
                                ↓{job.downloadCount}
                              </span>
                            {/if}
                            {#if job.skipCount > 0}
                              <span class="text-yellow-600 dark:text-yellow-400">
                                ⊘{job.skipCount}
                              </span>
                            {/if}
                          </span>
                        {/if}

                        <span class="text-xs text-secondary-500 dark:text-secondary-400">
                          {formatDuration(job.startTime, job.endTime)}
                        </span>
                      </div>
                      <p class="truncate text-sm text-secondary-700 dark:text-secondary-300">
                        {job.url}
                      </p>
                    </div>

                    <span class="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
                      Started: {new Date(job.startTime).toLocaleString()}
                      {#if job.endTime}
                        | Ended: {new Date(job.endTime).toLocaleString()}
                      {/if}
                    </span>
                  </button>
                </div>
                <button
                  onclick={e => deleteJob(e, job.id)}
                  class="ml-4 flex-shrink-0 cursor-pointer p-2 text-secondary-600 transition-all hover:scale-120 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400"
                  title="Delete job"
                  aria-label={`Delete job ${job.url}`}
                >
                  <Icon iconName="delete" size={20} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<!-- Tooltip -->
{#if tooltip.visible}
  <div
    class="fixed z-50 px-2 py-1 text-xs text-white bg-black rounded shadow-lg pointer-events-none whitespace-nowrap"
    style:left="{tooltip.x + 10}px"
    style:top="{tooltip.y - 30}px"
    transition:fade={{ duration: 150 }}
  >
    {tooltip.text}
  </div>
{/if}

<ConfirmModal
  show={showDeleteConfirm}
  title={deleteAction === 'all'
    ? 'Delete all Jobs?'
    : deleteAction === 'selected'
      ? 'Delete Selected Jobs?'
      : 'Delete Job?'}
  confirmText={deleteAction === 'all'
    ? 'Delete All Jobs'
    : deleteAction === 'selected'
      ? `Delete ${selectedCount} Jobs`
      : 'Delete Job'}
  cancelText="Cancel"
  confirmVariant="danger"
  cancelVariant="outline-primary"
  onConfirm={confirmDelete}
  onCancel={cancelDelete}
>
  {#if deleteAction === 'all'}
    <p class="text-secondary-700 dark:text-secondary-300 mb-4">
      This will permanently delete all
      <span class="text-xl font-bold text-warning-500">{jobs.length}</span>
      jobs.
    </p>
    <Info variant="danger">This is a destructive action that cannot be reversed.</Info>
  {:else if deleteAction === 'selected'}
    <p class="text-secondary-700 dark:text-secondary-300 mb-4">
      This will permanently delete
      <span class="text-xl font-bold text-warning-500">{selectedCount}</span>
      selected jobs.
    </p>
    <Info variant="danger">This is a destructive action that cannot be reversed.</Info>
  {:else}
    <p class="text-secondary-700 dark:text-secondary-300 mb-4">
      This will permanently delete this job.
    </p>
    <Info variant="danger">This action cannot be reversed.</Info>
  {/if}
</ConfirmModal>
