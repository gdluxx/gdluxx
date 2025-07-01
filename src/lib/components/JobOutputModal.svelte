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
  import type { ClientJob } from '$lib/stores/jobs';
  import { jobStore } from '$lib/stores/jobs';
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

      // Custom styling for success/skip indicators // TODO: stopped working?
      if (htmlContent.startsWith('✔ ')) {
        htmlContent = `<span style="color: limegreen;">${htmlContent}</span>`;
      } else if (htmlContent.startsWith('# ')) {
        htmlContent = `<span style="color: gray;">${htmlContent}</span>`;
      }
    }

    return htmlContent;
  }

  function getOutputStyle(type: (typeof job.output)[0]['type']): string {
    switch (type) {
      case 'stdout':
        return 'text-secondary-700 dark:text-secondary-300';
      case 'stderr':
        return 'text-orange-600 dark:text-orange-400';
      case 'error':
      case 'fatal':
        return 'text-red-600 dark:text-red-400 font-semibold';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      case 'status':
        return 'text-purple-600 dark:text-purple-400 italic';
      default:
        return 'text-gray-900 dark:text-gray-100';
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

  async function copyToClipboard(jobUrl: string, event: MouseEvent) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(jobUrl);
      } else {
        // Fallback for mobile/unsupported browsers
        const textArea = document.createElement('textarea');
        textArea.value = jobUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('aria-hidden', 'true');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        // TODO: Need to find modern option that works as well as this does
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error('Fallback copy method failed');
        }
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
  class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
  transition:fade={{ duration: 200 }}
  onclick={handleBackdropClick}
  onkeydown={e => e.key === 'Escape' && handleMinimize()}
  role="button"
  tabindex="-1"
>
  <div
    class="relative w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] bg-white dark:bg-secondary-900 rounded-lg shadow-xl overflow-hidden flex flex-col"
    transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}
  >
    <!-- Header -->
    <div
      class="px-4 sm:px-6 py-3 sm:py-4 border-b border-secondary-200 dark:border-secondary-700 flex items-center justify-between"
    >
      <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div class={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusColor(job.status)}`}></div>
        <h2
          class="text-sm sm:text-lg font-semibold text-secondary-900 dark:text-secondary-100 truncate"
          title={job.url}
        >
          {job.url}
        </h2>
        <button
          onclick={(event: MouseEvent) => copyToClipboard(job.url, event)}
          aria-label="Copy Job URL"
          class="cursor-pointer p-1 sm:p-2 text-secondary-600 hover:text-secondary-800 dark:text-secondary-400 dark:hover:text-secondary-200 transition-all duration-200 hover:scale-110 flex-shrink-0"
          title="Copy Job URL"
        >
          <Icon iconName="copy-clipboard" size={20} />
        </button>
        <CopyTooltip x={tooltip.x} y={tooltip.y} visible={tooltip.visible} text={tooltip.text} />
      </div>
      <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button
          onclick={handleMinimize}
          aria-label="Show Job List"
          class="cursor-pointer p-1 sm:p-2 text-secondary-600 hover:text-secondary-800 dark:text-secondary-400 dark:hover:text-secondary-200 transition-all duration-200 hover:scale-110"
          title="Show Job List"
        >
          <Icon iconName="close" size={20} />
        </button>
      </div>
    </div>

    <!-- Container -->
    <div
      bind:this={outputContainer}
      class="flex-1 overflow-y-auto p-3 sm:p-4 bg-secondary-50 dark:bg-secondary-950 font-mono text-xs sm:text-sm"
    >
      {#if job.output.length === 0}
        <p class="text-secondary-600 dark:text-secondary-400">Waiting for output...</p>
      {:else}
        {#each job.output as output (output)}
          <div class={`whitespace-pre-wrap break-words ${getOutputStyle(output.type)}`}>
            <span class="text-gray-500 select-none dark:text-gray-600">
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
    <div
      class="px-3 sm:px-6 py-2 sm:py-3 border-t border-secondary-200 dark:border-secondary-700 text-xs sm:text-sm"
    >
      <!-- Mobile layout -->
      <div class="flex justify-between items-start sm:hidden">
        <div class="flex flex-col gap-1">
          <div class="text-secondary-600 dark:text-secondary-400">
            Status: {job.status}
            {#if job.exitCode !== undefined}
              (Exit code: {job.exitCode})
            {/if}
          </div>
          <div class="text-secondary-600 dark:text-secondary-400">
            Started: {new Date(job.startTime).toLocaleTimeString()}
            {#if job.endTime}
              <br />Ended: {new Date(job.endTime).toLocaleTimeString()}
            {/if}
          </div>
        </div>
        <button
          onclick={handleDismiss}
          aria-label="Delete Job"
          class="cursor-pointer p-1 text-secondary-600 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400 transition-all duration-200 hover:scale-120 ml-2"
          title="Delete"
        >
          <Icon iconName="delete" size={20} />
        </button>
      </div>

      <!-- Desktop layout -->
      <div class="hidden sm:block">
        <div class="flex justify-between items-center">
          <div class="text-secondary-600 dark:text-secondary-400">
            Status: {job.status}
            {#if job.exitCode !== undefined}
              (Exit code: {job.exitCode})
            {/if}
          </div>
          <div class="text-secondary-600 dark:text-secondary-400">
            Started: {new Date(job.startTime).toLocaleTimeString()}
            {#if job.endTime}
              | Ended: {new Date(job.endTime).toLocaleTimeString()}
            {/if}
          </div>
        </div>
        <div class="flex justify-end mt-2">
          <button
            onclick={handleDismiss}
            aria-label="Delete Job"
            class="cursor-pointer py-1 sm:py-2 text-secondary-600 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400 transition-all duration-200 hover:scale-105"
            title="Delete"
          >
            <Icon iconName="delete" size={32} />
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
