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
  import { Button, Info, ConfirmModal, Toggle } from '$lib/components/ui';
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
        return 'bg-info shadow-lg animate-pulse';
      case 'success':
        return 'bg-success shadow-lg';
      case 'no_action':
        return 'bg-warning shadow-lg';
      case 'error':
        return 'bg-error shadow-lg';
      default:
        return 'bg-surface-sunken';
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

<div class="data-list">
  <!-- Header -->
  <div class="data-list-header">
    <div class="flex items-center justify-between mb-3">
      <h2>
        Jobs: {jobs.length} / {aggregateStats().total}
        {#if hasSelection}
          <span class="text-sm text-muted-foreground">
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
        class={`text-foreground rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('running')
            ? 'border-info bg-info/10'
            : 'bg-surface-elevated border-strong hover:border-info hover:bg-info-hover/10'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-info"></div>
          <span class="text-md font-medium text-accent-foreground">Running</span>
        </div>
        <div class="mt-1 text-xl font-semibold text-primary flex justify-center">
          {aggregateStats().running}
        </div>
      </button>

      <!-- success card -->
      <button
        onclick={() => toggleFilter('success')}
        class={`text-foreground rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('success')
            ? 'border-success bg-success/10'
            : 'bg-surface-elevated border-strong hover:border-success hover:bg-success-hover/10'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-success"></div>
          <span class="text-md font-medium text-accent-foreground">Success</span>
        </div>
        <div class="mt-1 text-xl font-semibold text-primary flex justify-center">
          {aggregateStats().success}
        </div>
      </button>

      <!-- skips card -->
      <button
        onclick={() => toggleFilter('no_action')}
        class={`text-foreground rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('no_action')
            ? 'border-warning bg-warning/10'
            : 'bg-surface-elevated border-strong hover:border-warning hover:bg-warning-hover/10'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-warning"></div>
          <span class="text-md font-medium text-accent-foreground">Skips</span>
        </div>
        <div class="mt-1 text-xl font-semibold text-primary flex justify-center">
          {aggregateStats().skips}
        </div>
      </button>

      <!-- error card -->
      <button
        onclick={() => toggleFilter('error')}
        class={`text-foreground rounded-sm border px-3 py-1.5 cursor-pointer ${
          activeFilters.has('error')
            ? 'border-error bg-error/10'
            : 'bg-surface-elevated border-strong hover:border-error hover:bg-error-hover/10'
        }`}
      >
        <div class="flex items-center gap-2 justify-center">
          <div class="w-2 h-2 rounded-full bg-error"></div>
          <span class="text-md font-medium text-accent-foreground">Errors</span>
        </div>
        <div class="mt-1 text-xl font-semibold text-primary flex justify-center">
          {aggregateStats().error}
        </div>
      </button>

      <!-- totalDownloads card -->
      <div class="data-list-stats">
        <div class="flex items-center gap-2 justify-center">
          <Icon iconName="download-arrow" size={18} class="align-middle -mx-1 text-success" />
          <span class="text-md font-medium text-accent-foreground">Downloads</span>
        </div>
        <div class="mt-1 text-xl font-semibold text-primary flex justify-center">
          {aggregateStats().totalDownloads}
        </div>
      </div>

      <!-- totalSkips card -->
      <div class="data-list-stats">
        <div class="flex items-center gap-2 justify-center">
          <Icon iconName="no-circle" size={16} class="align-middle text-warning" />
          <span class="text-md font-medium text-accent-foreground">Skips</span>
        </div>
        <div class="mt-1 text-xl font-semibold text-primary flex justify-center">
          {aggregateStats().totalSkips}
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="data-list-controls">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <Button variant="outline-primary" size="sm" onclick={toggleSelectAll}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>

          {#if hasSelection}
            <Button
              name="Delete Selected Jobs"
              onclick={deleteSelectedJobs}
              aria-label="Delete Selected Jobs"
              variant="outline-danger"
              size="sm"
            >
              Delete Selected
            </Button>
          {:else}
            <Button
              name="Delete All Jobs"
              onclick={deleteAllJobs}
              aria-label="Delete All Jobs"
              variant="outline-danger"
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
  <div class="overflow-y-auto mt-2">
    {#if jobs.length === 0}
      <div class="p-8 text-center text-foreground">No jobs to display</div>
    {:else}
      {#each jobs as job (job.id)}
        <div class="mt-2 data-list-item flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <Toggle
                checked={selectedJobs.has(job.id)}
                onchange={() => toggleJobSelection(job.id)}
                variant="primary"
                size="default"
              />
              <button
                onclick={() => handleJobClick(job)}
                class="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
                aria-label={`View details for job ${job.url}`}
              >
                <div class="flex-grow">
                  <div class="mb-1 flex items-center gap-2">
                    <!-- status circle -->
                    <div
                      class={`h-3 w-3 rounded-full cursor-help transition-transform hover:scale-125 ${getStatusColor(job.status)}`}
                      onmouseenter={e => showTooltip(e, getStatusTooltip(job))}
                      onmouseleave={hideTooltip}
                      role="tooltip"
                      aria-label={getStatusTooltip(job)}
                    ></div>
                    <!-- Job status text -->
                    <span class="text-sm font-medium text-primary">
                      {#if getStatusText(job.status) === 'Skips'}
                        <span class="text-warning">
                          Skipped
                        </span>
                      {:else}
                        <span
                          class:text-foreground={getStatusText(job.status) === 'Running'}
                          class:text-success={getStatusText(job.status) === 'Success'}
                          class:text-error={getStatusText(job.status) === 'Error'}
                        >
                          {getStatusText(job.status)}
                        </span>
                      {/if}
                    </span>

                    <!-- Show download/skip counts for completed jobs -->
                    {#if job.status === 'success' || job.status === 'no_action'}
                      <span class="text-xs">
                        {#if job.downloadCount > 0}
                          <span class="text-success">
                            <Icon
                              iconName="download-arrow"
                              size={18}
                              class="inline -translate-y-px"
                            />{job.downloadCount}
                          </span>
                        {/if}
                        {#if job.skipCount > 0}
                          <span class="text-warning">
                            <Icon
                              iconName="no-circle"
                              size={14}
                              class="inline -translate-y-px"
                            />{job.skipCount}
                          </span>
                        {/if}
                      </span>
                    {/if}

                    <span class="text-xs text-muted-foreground">
                      {formatDuration(job.startTime, job.endTime)}
                    </span>
                  </div>
                  <p class="truncate text-sm text-foreground">
                    {job.url}
                  </p>
                </div>

                <span class="mt-2 text-xs text-muted-foreground">
                  Started: {new Date(job.startTime).toLocaleString()}
                  {#if job.endTime}
                    | Ended: {new Date(job.endTime).toLocaleString()}
                  {/if}
                </span>
              </button>
            </div>
            <button
              onclick={e => deleteJob(e, job.id)}
              class="cursor-pointer ml-4 p-1 text-error hover:bg-error/50 hover:text-foreground rounded-sm focus:outline-none transition-colors"
              title="Delete job"
              aria-label={`Delete job ${job.url}`}
            >
              <Icon iconName="delete" size={20} />
            </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- Tooltip -->
{#if tooltip.visible}
  <div
    class="fixed z-50 px-2 py-1 text-xs text-foreground bg-surface-elevated border-strong rounded shadow-lg pointer-events-none whitespace-nowrap"
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
  confirmVariant="outline-danger"
  cancelVariant="default"
  onConfirm={confirmDelete}
  onCancel={cancelDelete}
>
  {#if deleteAction === 'selected'}
    <p class="text-muted-foreground mb-4">
      This will permanently delete
      <span class="text-xl font-bold text-error">{selectedCount}</span>
      selected jobs.
    </p>
    <Info variant="error">This is a destructive action that cannot be reversed.</Info>
  {:else}
    <p class="text-muted-foreground mb-4">
      This will permanently delete the job.
    </p>
    <Info variant="error">This action cannot be reversed.</Info>
  {/if}
</ConfirmModal>
