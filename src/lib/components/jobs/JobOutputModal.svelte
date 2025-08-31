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
  import { onMount, tick } from 'svelte';
  import { AnsiUp } from 'ansi_up';
  import DOMPurify from 'dompurify';
  import type { ClientJob } from '$lib/stores/jobs.svelte';
  import { jobStore } from '$lib/stores/jobs.svelte';
  import { CopyTooltip } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';

  interface Props {
    job: ClientJob;
  }

  const { job }: Props = $props();

  let outputContainer: HTMLElement | null = $state(null);
  let userScrolledUp = $state(false);

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

  function handleMinimize() {
    jobStore.hideJob(job.id);
  }

  function handleDismiss() {
    jobStore.deleteJob(job.id);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleMinimize();
    }
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
        htmlContent = `<span style="color: limegreen;">${htmlContent}</span>`;
      } else if (trimmedData.startsWith('# ')) {
        htmlContent = `<span style="color: gray;">${htmlContent}</span>`;
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

  function getStatusColor(status: ClientJob['status']): string {
    switch (status) {
      case 'running':
        return 'bg-info';
      case 'success':
        return 'bg-success';
      case 'no_action':
        return 'bg-warning';
      case 'error':
        return 'bg-error';
      default:
        return 'bg-muted-foreground';
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
          `Unknown job status encountered: "${status}". This may indicate a data migration issue.`,
        );
        return 'Unknown';
    }
  }

  function fallbackCopy(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('aria-hidden', 'true');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error('Fallback copy method failed');
    }
  }

  async function copyToClipboard(jobUrl: string, event: MouseEvent) {
    try {
      // Modern clipboard
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(jobUrl);
        } catch (clipboardError) {
          // if errors received, fall back
          console.warn('Clipboard API failed, falling back to execCommand:', clipboardError);
          fallbackCopy(jobUrl);
        }
      } else {
        // Last effort
        fallbackCopy(jobUrl);
      }

      tooltip.text = 'Copied!';
      tooltip.x = event.clientX;
      tooltip.y = event.clientY;
      tooltip.visible = true;

      setTimeout(() => {
        tooltip.visible = false;
      }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
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

<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
  transition:fade={{ duration: 200 }}
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === 'Escape' && handleMinimize()}
  role="button"
  tabindex="-1"
>
  <div
    class="relative flex max-h-[90vh] w-full max-w-full flex-col overflow-hidden rounded-sm border-primary/35 bg-surface shadow-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
    transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
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

      <div class="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <button
          onclick={(event: MouseEvent) => copyToClipboard(job.url, event)}
          aria-label="Copy Job URL"
          class="cursor-pointer p-1 text-muted-foreground transition-all duration-200 hover:scale-110 hover:text-foreground sm:p-2"
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

        <button
          onclick={handleMinimize}
          aria-label="Show Job List"
          class="cursor-pointer p-1 text-muted-foreground transition-all duration-200 hover:scale-110 hover:text-foreground sm:p-2"
          title="Show Job List"
        >
          <Icon
            iconName="close"
            size={20}
          />
        </button>
      </div>
    </div>

    <!-- Job URL section -->
    <div class="bg-surface-elevated px-4 py-2 border-b-strong border-t-strong sm:px-6">
      <p
        class="text-sm break-all text-foreground"
        title={job.url}
      >
        {job.url}
      </p>
    </div>

    <!-- Container -->
    <div
      bind:this={outputContainer}
      class="flex-1 overflow-y-auto bg-surface-sunken p-3 font-mono text-xs sm:p-4 sm:text-sm"
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

    <!-- Footer -->
    <div class="px-3 py-2 text-xs border-t-strong sm:px-6 sm:py-3 sm:text-sm">
      <!-- Mobile layout -->
      <div class="flex items-start justify-between sm:hidden">
        <div class="flex flex-col gap-1">
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
        <button
          onclick={handleDismiss}
          aria-label="Delete Job"
          class="ml-2 cursor-pointer p-1 text-muted-foreground transition-all duration-200 hover:scale-120 hover:text-error"
          title="Delete"
        >
          <Icon
            iconName="delete"
            size={20}
          />
        </button>
      </div>

      <!-- Desktop layout -->
      <div class="hidden sm:block">
        <div class="flex items-center justify-between">
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
        <div class="mt-2 flex justify-end">
          <button
            onclick={handleDismiss}
            aria-label="Delete Job"
            class="cursor-pointer rounded-sm p-0.5 text-error transition-colors hover:bg-error/50 hover:text-foreground focus:outline-none sm:py-2"
            title="Delete"
          >
            <Icon
              iconName="delete"
              size={32}
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
