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
  import { onMount, tick } from 'svelte';
  import { AnsiUp } from 'ansi_up';
  import DOMPurify from 'dompurify';
  import type { ClientJob } from '$lib/stores/jobs.svelte';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { Button, ConfirmModal, CopyTooltip, Modal } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import { getStatusColor, getStatusText } from '$lib/utils/jobStatus';
  import { copyToClipboard } from '$lib/utils/clipboard';
  import { clientLogger } from '$lib/client/logger';

  interface Props {
    job: ClientJob;
  }

  const { job }: Props = $props();

  let outputContainer: HTMLElement | null = $state(null);
  let userScrolledUp = $state(false);
  let showDeleteConfirm = $state(false);

  const tooltip = $state({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

  const ansiConverter = new AnsiUp();
  ansiConverter.use_classes = false;
  ansiConverter.escape_html = true;

  // Auto scroll
  $effect(() => {
    void job.output.length;

    (async () => {
      await tick();
      const el = outputContainer;
      if (el && !userScrolledUp) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
      }
    })();
  });

  // Detect user scroll
  $effect(() => {
    const el = outputContainer;
    if (el) {
      const handleScroll = () => {
        const isAtBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 1;
        userScrolledUp = !isAtBottom;
      };

      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        el.removeEventListener('scroll', handleScroll);
      };
    }
  });

  // The job keeps running; closing the modal (Escape, backdrop, close button)
  // only hides it and returns to the job list.
  function handleMinimize() {
    jobStore.hideJob(job.id);
  }

  function handleDismiss() {
    showDeleteConfirm = true;
  }

  function confirmDelete() {
    jobStore.deleteJob(job.id);
    showDeleteConfirm = false;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  function formatOutput(output: (typeof job.output)[0]): string {
    let htmlContent = output.data;

    if (output.type === 'stdout' || output.type === 'stderr') {
      htmlContent = DOMPurify.sanitize(ansiConverter.ansi_to_html(output.data), {
        ALLOWED_TAGS: ['span'],
        ALLOWED_ATTR: ['style'],
      });

      // Custom styling for success/skip indicators
      // added trim to handle carriage returns
      const trimmedData = output.data.trim();
      if (trimmedData.startsWith('✔ ')) {
        htmlContent = `<span style="color: var(--color-success);">${htmlContent}</span>`;
      } else if (trimmedData.startsWith('# ')) {
        htmlContent = `<span style="color: var(--color-muted-foreground);">${htmlContent}</span>`;
      }
    }

    return htmlContent;
  }

  function getOutputStyle(type: (typeof job.output)[0]['type']): string {
    switch (type) {
      case 'stdout':
        return 'text-muted-foreground';
      case 'stderr':
        return 'text-warning';
      case 'error':
      case 'fatal':
        return 'text-error font-semibold';
      case 'info':
        return 'text-info';
      case 'status':
        return 'text-accent-foreground italic';
      default:
        return 'text-foreground';
    }
  }

  async function handleCopy(jobUrl: string, event: MouseEvent) {
    try {
      await copyToClipboard(jobUrl);

      tooltip.text = 'Copied!';
      tooltip.x = event.clientX;
      tooltip.y = event.clientY;
      tooltip.visible = true;

      setTimeout(() => {
        tooltip.visible = false;
      }, 1500);
    } catch (err) {
      clientLogger.error('Copy failed:', err);
      tooltip.text = 'Copy failed';
      tooltip.x = event.clientX;
      tooltip.y = event.clientY;
      tooltip.visible = true;

      setTimeout(() => {
        tooltip.visible = false;
      }, 1500);
    }
  }

  onMount(() => {
    const el = outputContainer;
    if (el && el.scrollHeight - el.clientHeight <= el.scrollTop + 1) {
      userScrolledUp = false;
    } else if (el) {
      userScrolledUp = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
    } else {
      userScrolledUp = false;
    }
  });
</script>

<Modal
  show
  size="xl"
  onClose={handleMinimize}
>
  {#snippet header()}
    <!-- Status row -->
    <div class="flex items-center justify-between px-4 py-3 pr-14 sm:px-6 sm:py-4 sm:pr-16">
      <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div class={`h-4 w-4 flex-shrink-0 rounded-full ${getStatusColor(job.status)}`}></div>
        <h2 class="text-lg font-semibold text-foreground sm:text-xl">
          {getStatusText(job.status)}
        </h2>

        <!-- stats section -->
        {#if job.status === 'success' || job.status === 'no_action'}
          <div class="flex items-center gap-4 text-sm">
            {#if job.downloadCount > 0}
              <span class="flex items-center gap-1 text-success">
                <Icon
                  iconName="download-arrow"
                  size={24}
                />
                {job.downloadCount} downloaded
              </span>
            {/if}
            {#if job.skipCount > 0}
              <span class="flex items-center gap-1 text-warning">
                <Icon
                  iconName="no-circle"
                  size={18}
                />
                {job.skipCount} skipped
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Job URL section -->
    <div
      class="flex items-center gap-2 bg-surface-elevated px-4 py-2 border-b-strong border-t-strong sm:px-6"
    >
      <p
        class="min-w-0 flex-1 text-sm break-all text-foreground"
        title={job.url}
      >
        {job.url}
      </p>
      <button
        onclick={(event: MouseEvent) => handleCopy(job.url, event)}
        aria-label="Copy Job URL"
        class="flex-shrink-0 cursor-pointer p-1 text-muted-foreground transition-all duration-base hover:scale-110 hover:text-foreground"
        title="Copy Job URL"
      >
        <Icon
          iconName="copy-clipboard"
          size={20}
        />
      </button>
      <CopyTooltip
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
        text={tooltip.text}
      />
    </div>
  {/snippet}

  <!-- Container -->
  <div
    bind:this={outputContainer}
    class="h-full overflow-y-auto bg-surface-sunken p-3 font-mono text-xs sm:p-4 sm:text-sm"
  >
    {#if job.output.length === 0}
      <p class="text-muted-foreground">Waiting for output...</p>
    {:else}
      {#each job.output as output (output)}
        <div class={`break-words whitespace-pre-wrap ${getOutputStyle(output.type)}`}>
          <span class="text-muted-foreground select-none">
            [{new Date(output.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}]
          </span>
          <span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html formatOutput(output)}
          </span>
        </div>
      {/each}
    {/if}
  </div>

  {#snippet footer()}
    <div class="px-3 py-2 text-xs border-t-strong sm:px-6 sm:py-3 sm:text-sm">
      <!-- Mobile layout -->
      <div class="flex items-start justify-between gap-2 sm:hidden">
        <Button
          variant="outline-danger"
          onclick={handleDismiss}
          aria-label="Delete job"
          class="flex-shrink-0 gap-1.5"
        >
          <Icon
            iconName="delete"
            size={16}
          />
          Delete job
        </Button>
        <div class="flex flex-col items-end gap-1 text-right">
          <div class="text-accent-foreground">
            Status: {job.status}
            {#if job.exitCode !== undefined}
              (Exit code: {job.exitCode})
            {/if}
          </div>
          <div class="text-accent-foreground">
            Started: {new Date(job.startTime).toLocaleTimeString()}
            {#if job.endTime}
              <br />Ended: {new Date(job.endTime).toLocaleTimeString()}
            {/if}
          </div>
        </div>
      </div>

      <!-- Desktop layout -->
      <div class="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
        <Button
          variant="outline-danger"
          onclick={handleDismiss}
          aria-label="Delete job"
          class="gap-1.5"
        >
          <Icon
            iconName="delete"
            size={18}
          />
          Delete job
        </Button>
        <div class="flex items-center gap-4">
          <div class="text-muted-foreground">
            Status: {job.status}
            {#if job.exitCode !== undefined}
              (Exit code: {job.exitCode})
            {/if}
          </div>
          <div class="text-muted-foreground">
            Started: {new Date(job.startTime).toLocaleTimeString()}
            {#if job.endTime}
              | Ended: {new Date(job.endTime).toLocaleTimeString()}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/snippet}
</Modal>

<ConfirmModal
  show={showDeleteConfirm}
  title="Delete job?"
  message="This will permanently delete the job and its output history. This action cannot be reversed."
  confirmText="Delete job"
  cancelText="Cancel"
  confirmVariant="outline-danger"
  onConfirm={confirmDelete}
  onCancel={cancelDelete}
/>
