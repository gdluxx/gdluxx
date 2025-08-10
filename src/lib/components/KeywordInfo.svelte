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
  import { Button, Info, CopyTooltip } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import { keywordInfoStore } from '$lib/stores/keyword-info.svelte';

  let urlInput = $state('');

  const _placeholderIndex = $state(0);

  const tooltip = $state({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

  function handleListKeywords(event: Event) {
    event.preventDefault();
    if (!urlInput.trim()) {
      return;
    }
    keywordInfoStore.executeCommand(urlInput.trim(), 'list-keywords');
  }

  function handleExtractorInfo(event: Event) {
    event.preventDefault();
    if (!urlInput.trim()) {
      return;
    }
    keywordInfoStore.executeCommand(urlInput.trim(), 'extractor-info');
  }

  function clearOutput() {
    keywordInfoStore.clearOutput();
    urlInput = '';
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
  }

  async function copyToClipboard(text: string | null, event: MouseEvent) {
    if (!text) {
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
        } catch (clipboardError) {
          console.warn('Clipboard API failed, falling back to execCommand:', clipboardError);
          fallbackCopy(text);
        }
      } else {
        fallbackCopy(text);
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
      }, 2000);
    }
  }

  const isValidUrl = $derived(() => {
    const trimmed = urlInput.trim();
    return trimmed.length > 0 && /^https?:\/\/.+/.test(trimmed);
  });

  const buttonsDisabled = $derived(keywordInfoStore.state.isLoading || !isValidUrl);

  const getErrorVariant = $derived(() => {
    if (!keywordInfoStore.state.error) {
      return 'danger';
    }

    const error = keywordInfoStore.state.error.toLowerCase();

    if (error.includes('fetch') || error.includes('network') || error.includes('connection')) {
      return 'warning';
    }

    if (error.includes('timeout')) {
      return 'warning';
    }

    if (error.includes('url') || error.includes('invalid') || error.includes('unsupported')) {
      return 'danger';
    }

    if (error.includes('binary') || error.includes('command') || error.includes('spawn')) {
      return 'danger';
    }

    return 'danger';
  });

  const getErrorMessage = $derived(() => {
    if (!keywordInfoStore.state.error) {
      return '';
    }

    const error = keywordInfoStore.state.error.toLowerCase();

    if (error.includes('timeout')) {
      return `Request timed out. The URL might be slow to respond or temporarily unavailable. Please try again.`;
    }

    if (error.includes('network') || error.includes('fetch')) {
      return `Network error occurred. Please check your connection and try again.`;
    }

    if (error.includes('unsupported') || error.includes('no extractor')) {
      return `This URL is not supported by gallery-dl. Please check the supported sites list and try a different URL.`;
    }

    if (error.includes('binary') || error.includes('command not found')) {
      return `Gallery-dl binary is not available. Please check the system configuration.`;
    }

    return keywordInfoStore.state.error;
  });
</script>

<div
  class="bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
>
  <form class="space-y-6" onsubmit={handleExtractorInfo}>
    <!-- URL Input -->
    <div class="m-4">
      <label
        for="keywordUrlsInput"
        class="mb-2 block px-2 text-sm font-medium text-primary-900 dark:text-primary-100"
      >
        URL <span class="text-xs dark:text-secondary-600 text-secondary-500">
          (enter a supported URL -
          <a
            href="https://github.com/mikf/gallery-dl?tab=readme-ov-file#supported-sites"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:no-underline"
          >
            see supported sites
          </a>)
        </span>
      </label>
      <div class="relative">
        <input
          id="keywordUrlsInput"
          name="url"
          bind:value={urlInput}
          placeholder="https://imgur.com/gallery/OvxRX"
          autocomplete="off"
          onkeydown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (urlInput.trim() && !buttonsDisabled) {
                handleExtractorInfo(e);
              }
            }
          }}
          class="h-10 w-full rounded-sm border dark:border-secondary-300 dark:bg-secondary-900 px-4 py-3 text-base dark:text-primary-100
         dark:placeholder-secondary-500 transition-colors duration-200
         dark:focus:border-primary-500 focus:ring-3 dark:focus:ring-primary-500/20 focus:outline-hidden
         border-secondary-700 bg-secondary-100 text-primary-900
         placeholder-secondary-500 focus:border-primary-400 focus:ring-primary-400/20 pr-10"
        />

        <!-- URL validation indicator -->
        {#if urlInput.trim()}
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
            {#if isValidUrl()}
              <Icon iconName="circle" size={12} class="text-green-500" />
            {:else}
              <Icon iconName="circle" size={12} class="text-red-500" />
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Buttons -->
    <div class="flex flex-col sm:flex-row justify-end m-4 gap-2">
      <Button
        onclick={() => keywordInfoStore.clearAllCachedData()}
        disabled={buttonsDisabled}
        size="sm"
        class="w-full sm:w-auto order-2 sm:order-1"
      >
        Clear Data
      </Button>
      <Button
        onclick={handleListKeywords}
        disabled={buttonsDisabled}
        size="sm"
        class="w-full sm:w-auto order-2 sm:order-1"
      >
        {#if keywordInfoStore.state.isLoading && keywordInfoStore.state.lastCommand === 'list-keywords'}
          <Icon iconName="loading" size={16} class="animate-spin mr-2" />
        {/if}
        List Keywords
      </Button>

      <Button
        type="submit"
        disabled={buttonsDisabled}
        size="sm"
        variant="primary"
        class="w-full sm:w-auto order-1 sm:order-2"
      >
        {#if keywordInfoStore.state.isLoading && keywordInfoStore.state.lastCommand === 'extractor-info'}
          <Icon iconName="loading" size={16} class="animate-spin mr-2" />
        {/if}
        Extractor Info
      </Button>
    </div>

    <!-- Error -->
    {#if keywordInfoStore.state.error}
      <div class="cursor-default mx-4">
        <Info variant={getErrorVariant()} dismissible>
          {getErrorMessage()}
        </Info>
      </div>
    {/if}

    <!-- Output -->
    {#if keywordInfoStore.hasOutput || keywordInfoStore.state.isLoading}
      <div class="cursor-default mx-4 space-y-4">
        <!-- Context Info -->
        {#if keywordInfoStore.state.currentUrl && keywordInfoStore.state.lastCommand}
          <Info variant="info">
            <strong>
              {keywordInfoStore.state.lastCommand === 'list-keywords'
                ? 'List Keywords'
                : 'Extractor Info'}:
            </strong>
            <code class="text-sm">{keywordInfoStore.state.currentUrl}</code>
          </Info>
        {/if}

        <!-- Output display -->
        <div class="relative">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-primary-900 dark:text-primary-100"> Output </span>
            <div class="flex gap-2">
              {#if keywordInfoStore.currentOutput()}
                <Button
                  onclick={e => copyToClipboard(keywordInfoStore.currentOutput(), e)}
                  variant="outline-secondary"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <Icon iconName="copy-clipboard" size={14} />
                  Copy
                </Button>
              {/if}
              {#if keywordInfoStore.hasOutput}
                <Button
                  onclick={clearOutput}
                  variant="outline-secondary"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <Icon iconName="close" size={14} />
                  Clear
                </Button>
              {/if}
            </div>
          </div>

          <div
            class="cursor-default mt-4 w-full rounded-sm border dark:border-secondary-300
              dark:bg-secondary-900 px-4 py-3 text-sm dark:text-primary-100 border-secondary-700
              bg-secondary-100 text-primary-900 whitespace-pre-wrap break-words max-h-96 overflow-auto
              font-mono leading-relaxed"
          >
            {#if keywordInfoStore.state.isLoading}
              <div class="flex items-center justify-center py-8">
                <Icon iconName="loading" size={24} class="animate-spin mr-2" />
                <span class="text-base">
                  Executing {keywordInfoStore.state.lastCommand === 'list-keywords'
                    ? 'List Keywords'
                    : 'Extractor Info'}...
                </span>
              </div>
            {:else if keywordInfoStore.currentOutput()}
              <!-- prettier-ignore -->
              {keywordInfoStore.currentOutput()}
            {:else}
              <span class="text-secondary-500 dark:text-secondary-400 italic">
                No output to display
              </span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </form>

  <!-- Copy -->
  <CopyTooltip x={tooltip.x} y={tooltip.y} visible={tooltip.visible} text={tooltip.text} />
</div>
