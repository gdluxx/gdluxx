<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { ClientJob } from '$lib/stores/jobs';
  import { jobStore } from '$lib/stores/jobs';
  import { Button, Info, ConfirmModal } from '$lib/components/ui';

  interface Props {
    variant?: 'modal' | 'page';
    isOpen?: boolean;
    onClose?: () => void;
  }

  const { variant = 'page', isOpen = true, onClose }: Props = $props();

  let showDeleteConfirm = $state(false);

  const jobs = $derived(Array.from($jobStore.values()));

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && variant === 'modal' && onClose) {
      onClose();
    }
  }

  function getStatusColor(status: ClientJob['status']): string {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  function getStatusText(status: ClientJob['status']): string {
    switch (status) {
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
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

  function handleDismiss(event: MouseEvent, jobId: string) {
    event.stopPropagation();
    jobStore.deleteJob(jobId);
  }

  function deleteAllJobs(event: MouseEvent) {
    event.stopPropagation();
    showDeleteConfirm = true;
  }

  function confirmDeleteAll() {
    jobs.forEach(function (job) {
      console.log('Job ID:', job.id);
      jobStore.deleteJob(job.id);
    });
    showDeleteConfirm = false;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
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
          class="cursor-default flex items-center justify-between border-b border-secondary-200 px-6 py-4 dark:border-secondary-700"
        >
          <h2 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
            Jobs: {jobs.length}
          </h2>
          <div class="flex items-center gap-4">
            {#if jobs.length > 0}
              <Button
                name="Delete All Jobs"
                onclick={deleteAllJobs}
                aria-label="Delete All Jobs"
                variant="danger"
              >
                Delete All Jobs
              </Button>
            {/if}

            <!-- Close button for modal -->
            <Button
              variant="primary"
              onclick={onClose}
              aria-label="Close Job List"
              title="Minimize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="m2 22l7-7m0 0H3.143M9 15v5.857M22 2l-7 7m0 0h5.857M15 9V3.143"
                />
              </svg>
            </Button>
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
                  <button
                    onclick={() => handleJobClick(job)}
                    class="flex min-w-0 flex-1 cursor-pointer flex-col text-left hover:scale-101 focus:outline-none"
                    aria-label={`View details for job ${job.url}`}
                  >
                    <div class="flex-grow">
                      <div class="mb-1 flex items-center gap-2">
                        <div class={`h-3 w-3 rounded-full ${getStatusColor(job.status)}`}></div>
                        <span
                          class="text-sm font-medium text-secondary-900 dark:text-secondary-100"
                        >
                          {getStatusText(job.status)}
                        </span>
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
                  <button
                    onclick={e => handleDismiss(e, job.id)}
                    class="ml-4 flex-shrink-0 cursor-pointer p-2 text-secondary-600 transition-all duration-200 hover:scale-120 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400"
                    title="Delete job"
                    aria-label={`Delete job ${job.url}`}
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
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
      <div
        class="cursor-default flex items-center justify-between border-b border-secondary-200 px-6 py-4 dark:border-secondary-700"
      >
        <h2 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
          Jobs: {jobs.length}
        </h2>
        <div class="flex items-center gap-4">
          {#if jobs.length > 0}
            <Button
              name="Delete All Jobs"
              onclick={deleteAllJobs}
              aria-label="Delete All Jobs"
              variant="danger"
            >
              Delete All Jobs
            </Button>
          {/if}
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
                <button
                  onclick={() => handleJobClick(job)}
                  class="flex min-w-0 flex-1 cursor-pointer flex-col text-left hover:scale-101 focus:outline-none"
                  aria-label={`View details for job ${job.url}`}
                >
                  <div class="flex-grow">
                    <div class="mb-1 flex items-center gap-2">
                      <div class={`h-3 w-3 rounded-full ${getStatusColor(job.status)}`}></div>
                      <span class="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                        {getStatusText(job.status)}
                      </span>
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
                <button
                  onclick={e => handleDismiss(e, job.id)}
                  class="ml-4 flex-shrink-0 cursor-pointer p-2 text-secondary-600 transition-all duration-200 hover:scale-120 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400"
                  title="Delete job"
                  aria-label={`Delete job ${job.url}`}
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<ConfirmModal
  show={showDeleteConfirm}
  title="Delete all Jobs?"
  confirmText="Delete All Jobs"
  cancelText="Cancel"
  confirmVariant="danger"
  cancelVariant="outline-primary"
  onConfirm={confirmDeleteAll}
  onCancel={cancelDelete}
>
  <p class="text-secondary-700 dark:text-secondary-300 mb-4">
    This will permanently delete all
    <span class="text-xl font-bold text-warning-500">{jobs.length}</span>
    jobs.
  </p>
  <Info variant="danger">This is a destructive action that cannot be reversed.</Info>
</ConfirmModal>
