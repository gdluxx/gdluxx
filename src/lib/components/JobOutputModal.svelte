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
          class="cursor-pointer p-1 sm:p-2 text-secondary-600 hover:text-secondary-800 dark:text-secondary-400 dark:hover:text-secondary-200 transition-all duration-200 hover:scale-120 flex-shrink-0"
          title="Copy Job URL"
        >
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M6 11c0-2.828 0-4.243.879-5.121C7.757 5 9.172 5 12 5h3c2.828 0 4.243 0 5.121.879C21 6.757 21 8.172 21 11v5c0 2.828 0 4.243-.879 5.121C19.243 22 17.828 22 15 22h-3c-2.828 0-4.243 0-5.121-.879C6 20.243 6 18.828 6 16z"
              />
              <path
                d="M6 19a3 3 0 0 1-3-3v-6c0-3.771 0-5.657 1.172-6.828S7.229 2 11 2h4a3 3 0 0 1 3 3"
                opacity="0.5"
              />
            </g>
          </svg>
        </button>
        <CopyTooltip x={tooltip.x} y={tooltip.y} visible={tooltip.visible} text={tooltip.text} />
      </div>
      <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button
          onclick={handleMinimize}
          aria-label="Show Job List"
          class="cursor-pointer p-1 sm:p-2 text-secondary-600 hover:text-secondary-800 dark:text-secondary-400 dark:hover:text-secondary-200 transition-all duration-200 hover:scale-120"
          title="Show Job List"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 48 48"
            class="w-5 h-5"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="6"
              d="m8 8l32 32M8 40L40 8"
            />
          </svg>
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
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
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
            class="cursor-pointer py-1 sm:py-2 text-secondary-600 hover:text-red-600 dark:text-secondary-400 dark:hover:text-red-400 transition-all duration-200 hover:scale-120"
            title="Delete"
          >
            <svg
              class="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
