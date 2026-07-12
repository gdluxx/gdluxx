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
  import { copyToClipboard } from '$lib/utils/clipboard';

  type Mode = 'list-keywords' | 'extractor-info';

  let urlInput = $state(keywordInfoStore.state.currentUrl || '');
  let mode = $state<Mode>(keywordInfoStore.state.lastCommand ?? 'list-keywords');

  const tooltip = $state({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

  function selectMode(next: Mode) {
    mode = next;
    keywordInfoStore.selectCommand(next);
  }

  function runCommand(event: Event) {
    event.preventDefault();
    const url = urlInput.trim();
    if (!url || buttonsDisabled) {
      return;
    }
    keywordInfoStore.executeCommand(url, mode);
  }

  function clearOutput() {
    keywordInfoStore.clearOutput();
    urlInput = '';
  }

  function getEventCoords(event: MouseEvent | KeyboardEvent): { x: number; y: number } {
    if ('clientX' in event && event.clientX !== 0) {
      return { x: event.clientX, y: event.clientY };
    }
    const el = event.currentTarget as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: 0, y: 0 };
  }

  async function handleCopy(text: string | null, event: MouseEvent | KeyboardEvent) {
    if (!text) {
      return;
    }

    const { x, y } = getEventCoords(event);

    try {
      await copyToClipboard(text);

      tooltip.text = 'Copied!';
      tooltip.x = x;
      tooltip.y = y;
      tooltip.visible = true;

      setTimeout(() => {
        tooltip.visible = false;
      }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
      tooltip.text = 'Copy failed';
      tooltip.x = x;
      tooltip.y = y;
      tooltip.visible = true;

      setTimeout(() => {
        tooltip.visible = false;
      }, 2000);
    }
  }

  function copyKeyword(name: string, event: MouseEvent | KeyboardEvent) {
    handleCopy(`{${name}}`, event);
  }

  function handleKeywordKeydown(name: string, event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      copyKeyword(name, event);
    }
  }

  const isValidUrl = $derived(() => {
    const trimmed = urlInput.trim();
    return trimmed.length > 0 && /^https?:\/\/.+/.test(trimmed);
  });

  const buttonsDisabled = $derived(keywordInfoStore.state.isLoading || !isValidUrl());

  const modeLabel = (m: Mode | null): string =>
    m === 'list-keywords' ? 'List Keywords' : 'Extractor Info';

  const errorVariant = $derived(() => {
    const error = keywordInfoStore.state.error?.toLowerCase() ?? '';
    return error.includes('timeout') || error.includes('network') ? 'warning' : 'error';
  });
</script>

<div class="content-panel">
  <form
    class="space-y-6"
    onsubmit={runCommand}
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
              runCommand(e);
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

    <!-- Mode + actions -->
    <div class="m-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <!-- Segmented control: choose which command to run -->
      <div
        role="group"
        aria-label="Select command"
        class="inline-flex w-full overflow-hidden rounded-sm border border-primary sm:w-auto"
      >
        <button
          type="button"
          aria-pressed={mode === 'list-keywords'}
          onclick={() => selectMode('list-keywords')}
          class="flex-1 cursor-pointer px-4 py-1.5 text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none {mode ===
          'list-keywords'
            ? 'bg-primary text-on-primary'
            : 'bg-transparent text-primary hover:bg-primary/10'}"
        >
          List Keywords
        </button>
        <button
          type="button"
          aria-pressed={mode === 'extractor-info'}
          onclick={() => selectMode('extractor-info')}
          class="flex-1 cursor-pointer border-l border-primary px-4 py-1.5 text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none {mode ===
          'extractor-info'
            ? 'bg-primary text-on-primary'
            : 'bg-transparent text-primary hover:bg-primary/10'}"
        >
          Extractor Info
        </button>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row">
        <Button
          onclick={() => keywordInfoStore.clearAllCachedData()}
          disabled={buttonsDisabled}
          size="sm"
          variant="outline-primary"
          class="order-2 w-full sm:order-1 sm:w-auto"
        >
          Clear Data
        </Button>
        <Button
          type="submit"
          disabled={buttonsDisabled}
          size="sm"
          variant="primary"
          class="order-1 w-full sm:order-2 sm:w-auto"
        >
          {#if keywordInfoStore.state.isLoading}
            <Icon
              iconName="loading"
              size={16}
              class="mr-2 animate-spin"
            />
          {/if}
          Run {modeLabel(mode)}
        </Button>
      </div>
    </div>

    <!-- Error -->
    {#if keywordInfoStore.state.error}
      <div class="mx-4 cursor-default">
        <Info variant={errorVariant()}>
          {keywordInfoStore.state.error}
        </Info>
      </div>
    {/if}

    <!-- Output -->
    {#if keywordInfoStore.hasOutput || keywordInfoStore.state.isLoading}
      <div class="mx-4 cursor-default space-y-4">
        <!-- Context Info -->
        {#if keywordInfoStore.state.currentUrl && keywordInfoStore.state.lastCommand}
          <Info variant="info">
            <strong>{modeLabel(keywordInfoStore.state.lastCommand)}:</strong>
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
                  onclick={(e) => handleCopy(keywordInfoStore.currentOutput(), e)}
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
                  variant="outline-primary"
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

          {#if keywordInfoStore.state.isLoading}
            <div
              class="mt-4 flex items-center justify-center rounded-sm border bg-surface px-4 py-8 text-foreground"
            >
              <Icon
                iconName="loading"
                size={24}
                class="mr-2 animate-spin"
              />
              <span class="text-base"
                >Executing {modeLabel(keywordInfoStore.state.lastCommand)}...</span
              >
            </div>
          {:else if keywordInfoStore.currentSections()}
            <!-- Structured list-keywords view: keyword -> example table -->
            <div
              class="mt-4 max-h-[calc(100vh-550px)] w-full overflow-auto rounded-sm border bg-surface"
            >
              {#each keywordInfoStore.currentSections() ?? [] as section (section.title)}
                <div class="border-b last:border-b-0">
                  <div
                    class="sticky top-0 z-10 bg-surface-elevated px-4 py-2 text-sm font-semibold text-primary"
                  >
                    {section.title}
                  </div>
                  <table class="w-full table-fixed border-collapse text-sm">
                    <thead>
                      <tr class="border-b text-left text-muted-foreground">
                        <th class="w-2/5 px-4 py-1.5 font-medium">Keyword</th>
                        <th class="px-4 py-1.5 font-medium">Example value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each section.keywords as keyword (keyword.name)}
                        <tr
                          role="button"
                          tabindex="0"
                          onclick={(e) => copyKeyword(keyword.name, e)}
                          onkeydown={(e) => handleKeywordKeydown(keyword.name, e)}
                          title={`Copy {${keyword.name}}`}
                          class="cursor-pointer border-b last:border-b-0 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                        >
                          <td class="px-4 py-1.5 align-top font-mono text-primary">
                            <span class="block truncate">{`{${keyword.name}}`}</span>
                          </td>
                          <td class="px-4 py-1.5 align-top text-foreground">
                            <span
                              class="block truncate"
                              title={keyword.example}
                            >
                              {keyword.example || '—'}
                            </span>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/each}
            </div>
          {:else if keywordInfoStore.currentOutput()}
            <div
              class="mt-4 max-h-[calc(100vh-550px)] w-full cursor-default overflow-auto rounded-sm border bg-surface px-4 py-3 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground"
            >
              <!-- prettier-ignore -->
              {keywordInfoStore.currentOutput()}
            </div>
          {:else}
            <div
              class="mt-4 w-full rounded-sm border bg-surface px-4 py-3 font-mono text-sm text-foreground"
            >
              <span class="text-muted-foreground italic"> No output to display </span>
            </div>
          {/if}
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
