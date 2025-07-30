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
  import { fade } from 'svelte/transition';
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
    initialJobs?: Job[];
  }

  const { initialJobs = [] }: Props = $props();

  let showDeleteConfirm = $state(false);
  let deleteAction = $state<'single' | 'all' | 'selected'>('all');
  let jobToDelete = $state<string | null>(null);
  let sortNewestFirst = $state(true);
  let sortBy = $state<'time' | 'downloads'>('time');
  let selectedJobs = $state<Set<string>>(new Set());
  let activeFilters = $state<Set<string>>(new Set(['all']));

  const allJobs = $derived(jobStore.jobs);
  const filteredJobs = $derived(
    activeFilters.has('all') || activeFilters.size === 0
      ? allJobs
      : allJobs.filter(job => activeFilters.has(job.status))
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

  function toggleFilter(filterType: string) {
    if (filterType === 'all') {
      activeFilters.clear();
      activeFilters.add('all');
    } else {
      activeFilters.delete('all');

      if (activeFilters.has(filterType)) {
        activeFilters.delete(filterType);
        if (activeFilters.size === 0) {
          activeFilters.add('all');
        }
      } else {
        activeFilters.add(filterType);
      }
    }
    activeFilters = new Set(activeFilters);
    selectedJobs.clear();
  }

  const selectedCount = $derived(selectedJobs.size);
  const hasSelection = $derived(selectedCount > 0);
  const allSelected = $derived(selectedCount === jobs.length && jobs.length > 0);

  // statistics
  const aggregateStats = $derived(() => {
    const stats = {
      total: allJobs.length,
      running: allJobs.filter(job => job.status === 'running').length,
      success: allJobs.filter(job => job.status === 'success').length,
      skips: allJobs.filter(job => job.status === 'no_action').length,
      error: allJobs.filter(job => job.status === 'error').length,
      totalDownloads: allJobs.reduce((sum, job) => sum + (job.downloadCount ?? 0), 0),
      totalSkips: allJobs.reduce((sum, job) => sum + (job.skipCount ?? 0), 0),
    };
    return stats;
  });

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
        return 'Skips';
      case 'error':
        return 'Error';
      default:
        console.warn(
          `Unknown job status encountered: "${status}". This may indicate a data migration issue.`
        );
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

  // Initialize job store with server-provided data on mount
  onMount(() => {
    if (initialJobs.length > 0) {
      jobStore.initializeWithJobs(initialJobs);
    }
  });
</script>

<div
  class="bg-primary-50 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
>
  <!-- Header -->
  <div class="cursor-default border-b border-secondary-200 px-4 py-4 dark:border-secondary-700">
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

    <!-- Statistics -->
    <div class="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <!-- running card -->
      <button
        onclick={() => toggleFilter('running')}
        class={`bg-secondary-50 dark:bg-secondary-900 rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('running')
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-blue-500"></div>
          <span class="text-xs font-medium text-secondary-600 dark:text-secondary-400">
            Running
          </span>
        </div>
        <div
          class="mt-1 text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex justify-center"
        >
          {aggregateStats().running}
        </div>
      </button>

      <!-- success card -->
      <button
        onclick={() => toggleFilter('success')}
        class={`bg-secondary-50 dark:bg-secondary-900 rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('success')
            ? 'border-green-500'
            : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-green-500"></div>
          <span class="text-xs font-medium text-secondary-600 dark:text-secondary-400">
            Success
          </span>
        </div>
        <div
          class="mt-1 text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex justify-center"
        >
          {aggregateStats().success}
        </div>
      </button>

      <!-- skips card -->
      <button
        onclick={() => toggleFilter('no_action')}
        class={`bg-secondary-50 dark:bg-secondary-900 rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('no_action')
            ? 'border-yellow-500'
            : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
          <span class="text-xs font-medium text-secondary-600 dark:text-secondary-400">
            Skips
          </span>
        </div>
        <div
          class="mt-1 text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex justify-center"
        >
          {aggregateStats().skips}
        </div>
      </button>

      <!-- error card -->
      <button
        onclick={() => toggleFilter('error')}
        class={`bg-secondary-50 dark:bg-secondary-900 rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('error')
            ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
            : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-red-500"></div>
          <span class="text-xs font-medium text-secondary-600 dark:text-secondary-400">
            Errors
          </span>
        </div>
        <div
          class="mt-1 text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex justify-center"
        >
          {aggregateStats().error}
        </div>
      </button>

      <!-- totalDownloads card -->
      <div
        class="bg-secondary-50 dark:bg-secondary-900 rounded-sm border border-secondary-200 dark:border-secondary-700 px-3 py-1.5"
      >
        <div class="flex items-center gap-2 justify-center">
          <Icon iconName="download-arrow" size={18} class="align-middle -mx-1 text-green-500" />
          <span class="text-xs font-medium text-secondary-600 dark:text-secondary-400">
            Downloads
          </span>
        </div>
        <div
          class="mt-1 text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex justify-center"
        >
          {aggregateStats().totalDownloads}
        </div>
      </div>

      <!-- totalSkips card -->
      <div
        class="bg-secondary-50 dark:bg-secondary-900 rounded-sm border px-3 py-1.5 border-secondary-200 dark:border-secondary-700"
      >
        <div class="flex items-center gap-2 justify-center">
          <Icon iconName="no-circle" size={16} class="align-middle text-yellow-500" />
          <span class="text-xs font-medium text-secondary-600 dark:text-secondary-400">
            Skips
          </span>
        </div>
        <div
          class="mt-1 text-lg font-semibold text-secondary-900 dark:text-secondary-100 flex justify-center"
        >
          {aggregateStats().totalSkips}
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div
      class="bg-secondary-50 dark:bg-secondary-800/50 rounded-sm border border-secondary-200 dark:border-secondary-700 p-3"
    >
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onclick={toggleSelectAll}>
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
              Delete Selected
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
        </div>

        <div class="flex items-center gap-3">
          <Button
            onclick={toggleSort}
            aria-label={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
            disabled={jobs.length === 0}
            variant="outline-primary"
            size="sm"
            title={`Sort ${sortNewestFirst ? 'descending' : 'ascending'}`}
          >
            <Icon iconName="sort" size={20} class={`${sortNewestFirst ? '' : 'rotate-180'}`} />
          </Button>
          <Button
            onclick={() => setSortBy('time')}
            aria-label={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
            disabled={jobs.length === 0}
            variant={`${sortBy === 'time' ? 'primary' : 'outline-primary'}`}
            size="sm"
            title={`Sort ${sortNewestFirst ? 'newest' : 'oldest'} first`}
          >
            <Icon iconName="date" class="w-5 h-5" />
          </Button>
          <Button
            onclick={() => setSortBy('downloads')}
            aria-label={`Sort ${sortNewestFirst ? 'oldest' : 'newest'} first`}
            disabled={jobs.length === 0}
            variant={`${sortBy === 'downloads' ? 'primary' : 'outline-primary'}`}
            size="sm"
            title={`Sort ${sortNewestFirst ? 'most' : 'fewest'} downloads first`}
          >
            <Icon iconName="download-arrow" class="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  </div>

  <!-- Job list -->
  <div class="overflow-y-auto">
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
                class="w-5 h-5 bg-white border-2 border-primary-300 rounded transition-all
                  duration-150 ease-in-out hover:border-primary-600
                  dark:checked:bg-primary-600 dark:checked:border-primary-600 dark:checked:hover:bg-primary-700
                  dark:checked:hover:border-primary-700
                  dark:bg-primary-800 dark:border-primary-600 checked:bg-primary-500 checked:border-primary-500
                  dark:hover:border-primary-400 appearance-none cursor-pointer relative
                  before:content-[''] before:absolute before:top-[2px] before:left-[5px]
                  before:w-[7px] before:h-[12px] before:border-r-2 before:border-b-2 before:border-white
                  before:transform before:rotate-45 before:scale-0 before:transition-transform before:duration-150
                  checked:before:scale-100"
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
                      role="tooltip"
                      aria-label={getStatusTooltip(job)}
                    ></div>
                    <span class="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                      {#if getStatusText(job.status) === 'Skips'}
                        Skipped
                      {:else}
                        {getStatusText(job.status)}
                      {/if}
                    </span>

                    <!-- Show download/skip counts for completed jobs -->
                    {#if job.status === 'success' || job.status === 'no_action'}
                      <span class="text-xs text-secondary-600 dark:text-secondary-400">
                        {#if job.downloadCount > 0}
                          <span class="text-green-600 dark:text-green-400">
                            <Icon
                              iconName="download-arrow"
                              size={18}
                              class="inline -translate-y-px"
                            />{job.downloadCount}
                          </span>
                        {/if}
                        {#if job.skipCount > 0}
                          <span class="text-yellow-600 dark:text-yellow-400">
                            <Icon
                              iconName="no-circle"
                              size={14}
                              class="inline -translate-y-px"
                            />{job.skipCount}
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
