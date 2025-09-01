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

  let urlInput = $state(keywordInfoStore.state.currentUrl || '');

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

<div class="content-panel">
  <form
    class="space-y-6"
    onsubmit={handleExtractorInfo}
  >
    <!-- URL Input -->
    <div class="m-4">
      <label
        for="keywordUrlsInput"
        class="mb-2 block px-2 text-sm font-medium text-primary"
      >
        URL <span class="text-xs text-muted-foreground">
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
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (urlInput.trim() && !buttonsDisabled) {
                handleExtractorInfo(e);
              }
            }
          }}
          class="form-input"
        />

        <!-- URL validation indicator -->
        {#if urlInput.trim()}
          <div class="absolute top-1/2 right-3 -translate-y-1/2 transform">
            {#if isValidUrl()}
              <Icon
                iconName="circle"
                size={12}
                class="text-success"
              />
            {:else}
              <Icon
                iconName="circle"
                size={12}
                class="text-error"
              />
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Buttons -->
    <div class="m-4 flex flex-col justify-end gap-2 sm:flex-row">
      <Button
        onclick={() => keywordInfoStore.clearAllCachedData()}
        disabled={buttonsDisabled}
        size="sm"
        variant="outline-danger"
        class="order-2 w-full sm:order-1 sm:w-auto"
      >
        Clear Data
      </Button>
      <Button
        onclick={handleListKeywords}
        disabled={buttonsDisabled}
        size="sm"
        variant="primary"
        class="order-2 w-full sm:order-1 sm:w-auto"
      >
        {#if keywordInfoStore.state.isLoading && keywordInfoStore.state.lastCommand === 'list-keywords'}
          <Icon
            iconName="loading"
            size={16}
            class="mr-2 animate-spin"
          />
        {/if}
        List Keywords
      </Button>

      <Button
        type="submit"
        disabled={buttonsDisabled}
        size="sm"
        variant="primary"
        class="order-1 w-full sm:order-2 sm:w-auto"
      >
        {#if keywordInfoStore.state.isLoading && keywordInfoStore.state.lastCommand === 'extractor-info'}
          <Icon
            iconName="loading"
            size={16}
            class="mr-2 animate-spin"
          />
        {/if}
        Extractor Info
      </Button>
    </div>

    <!-- Error -->
    {#if keywordInfoStore.state.error}
      <div class="mx-4 cursor-default">
        <Info
          variant={getErrorVariant()}
          dismissible
        >
          {getErrorMessage()}
        </Info>
      </div>
    {/if}

    <!-- Output -->
    {#if keywordInfoStore.hasOutput || keywordInfoStore.state.isLoading}
      <div class="mx-4 cursor-default space-y-4">
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
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-primary"> Output </span>
            <div class="flex gap-2">
              {#if keywordInfoStore.currentOutput()}
                <Button
                  onclick={(e) => copyToClipboard(keywordInfoStore.currentOutput(), e)}
                  variant="outline-primary"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <Icon
                    iconName="copy-clipboard"
                    size={14}
                  />
                  Copy
                </Button>
              {/if}
              {#if keywordInfoStore.hasOutput}
                <Button
                  onclick={clearOutput}
                  variant="outline-warning"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <Icon
                    iconName="close"
                    size={14}
                  />
                  Clear
                </Button>
              {/if}
            </div>
          </div>

          <div
            class="mt-4 max-h-[calc(100vh-550px)] w-full cursor-default overflow-auto rounded-sm border bg-surface px-4 py-3 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground"
          >
            {#if keywordInfoStore.state.isLoading}
              <div class="flex items-center justify-center py-8">
                <Icon
                  iconName="loading"
                  size={24}
                  class="mr-2 animate-spin"
                />
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
              <span class="text-muted-foreground italic"> No output to display </span>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </form>

  <!-- Copy -->
  <CopyTooltip
    x={tooltip.x}
    y={tooltip.y}
    visible={tooltip.visible}
    text={tooltip.text}
  />
</div>
