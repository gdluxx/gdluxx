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
  import type { CatalogOption, CatalogSite, JsonValue } from '$lib/types/catalog';
  import { buildSnippet } from '$lib/utils/catalogSnippet';
  import { copyToClipboard } from '$lib/utils/clipboard';
  import { Button, ConfirmModal } from '$lib/components/ui';
  import { clientLogger as logger } from '$lib/client/logger';
  import { toastStore } from '$lib/stores/toast';

  interface Props {
    option: CatalogOption;
    site?: CatalogSite;
  }

  const { option, site }: Props = $props();

  const snippet = $derived(buildSnippet(option));
  const defaultProse = $derived(option.def && !option.def.p ? option.def.x : undefined);
  const defaultMatrix = $derived(
    option.def && !option.def.p && option.def.m && option.def.m.length > 0
      ? option.def.m
      : undefined,
  );

  const hasNoteSection = $derived([option.note, option.nterms?.length].some(Boolean));
  const isPlaceholderValue = $derived(snippet.value === '…');

  let copyLabel = $state('Copy');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  async function handleCopy() {
    try {
      await copyToClipboard(snippet.json);
      copyLabel = 'Copied';
    } catch (error) {
      logger.error('Failed to copy catalog snippet:', error);
      copyLabel = 'Copy failed';
    } finally {
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyLabel = 'Copy';
      }, 1400);
    }
  }

  interface ConfigMergeData {
    merged: boolean;
    exists?: boolean;
    currentValue?: JsonValue;
    action?: 'created' | 'replaced';
  }

  interface ConfigMergeEnvelope {
    success: boolean;
    data?: ConfigMergeData;
    error?: string;
  }

  let addLabel = $state('Add to config');
  let addTimer: ReturnType<typeof setTimeout> | undefined;
  let isAdding = $state(false);
  let showOverwriteModal = $state(false);
  let overwriteCurrentValue = $state<JsonValue | undefined>(undefined);

  const overwriteCurrentValueDisplay = $derived.by(() => {
    if (overwriteCurrentValue === undefined) {
      return '';
    }
    const json = JSON.stringify(overwriteCurrentValue, null, 2);
    const MAX_CHARS = 1000;
    return json.length > MAX_CHARS ? `${json.slice(0, MAX_CHARS)}\n… (truncated)` : json;
  });

  function resetAddLabelAfterDelay() {
    clearTimeout(addTimer);
    addTimer = setTimeout(() => {
      addLabel = 'Add to config';
    }, 1400);
  }

  async function postConfigMerge(overwrite: boolean): Promise<ConfigMergeData> {
    const response = await fetch('/api/config/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: snippet.path, value: snippet.value, overwrite }),
    });

    const result: ConfigMergeEnvelope = await response.json();
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error ?? `HTTP ${response.status}`);
    }

    return result.data;
  }

  function announceSuccess(action: ConfigMergeData['action']) {
    addLabel = 'Added ✓';
    const placeholderNote = isPlaceholderValue
      ? ' The merged value is a placeholder ("…") -- edit it in the config editor.'
      : '';
    toastStore.success(
      action === 'replaced' ? 'Config value replaced' : 'Added to config',
      `Reload the config editor if it's open in another tab.${placeholderNote}`,
    );
    resetAddLabelAfterDelay();
  }

  function announceFailure(error: unknown) {
    logger.error('Failed to add catalog option to config:', error);
    addLabel = 'Add failed';
    toastStore.error(
      'Add to config failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    resetAddLabelAfterDelay();
  }

  async function handleAddToConfig() {
    if (isAdding) {
      return;
    }
    isAdding = true;
    try {
      const data = await postConfigMerge(false);
      if (data.exists) {
        overwriteCurrentValue = data.currentValue;
        showOverwriteModal = true;
        return;
      }
      announceSuccess(data.action);
    } catch (error) {
      announceFailure(error);
    } finally {
      isAdding = false;
    }
  }

  async function confirmOverwrite() {
    showOverwriteModal = false;
    isAdding = true;
    try {
      const data = await postConfigMerge(true);
      announceSuccess(data.action);
    } catch (error) {
      announceFailure(error);
    } finally {
      isAdding = false;
      overwriteCurrentValue = undefined;
    }
  }

  function cancelOverwrite() {
    showOverwriteModal = false;
    overwriteCurrentValue = undefined;
  }
</script>

<div class="max-w-[70ch] space-y-4 pt-1 text-sm text-foreground">
  {#if site}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-primary hover:underline"
      >
        {site.name}
      </a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
      {#if site.auth}
        <span class="rounded-xs bg-surface-selected px-1.5 py-0.5 text-foreground">
          Auth: {site.auth}
        </span>
      {/if}
      {#if site.caps.length > 0}
        <span class="truncate">{site.caps.join(' · ')}</span>
      {/if}
    </div>
  {/if}

  {#if option.d}
    <p class="text-sm text-foreground">{option.d}</p>
  {/if}

  {#if option.dterms && option.dterms.length > 0}
    <dl class="space-y-2">
      {#each option.dterms as term (term.t)}
        <div>
          <dt class="font-mono text-sm font-medium">{term.t}</dt>
          {#if term.d}
            <dd class="mt-0.5 text-sm text-foreground">{term.d}</dd>
          {/if}
        </div>
      {/each}
    </dl>
  {/if}

  {#if option.names && option.names.length > 1}
    <p class="text-xs text-muted-foreground">
      Documented together:
      {#each option.names as name, i (name)}
        {i > 0 ? ' · ' : ' '}<code class="font-mono">{name}</code>
      {/each}
    </p>
  {/if}

  {#if defaultProse}
    <div>
      <h4 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Default
      </h4>
      <p class="mt-1 text-sm">{defaultProse}</p>
    </div>
  {/if}

  {#if defaultMatrix}
    <div>
      <h4 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Default by site
      </h4>
      <div class="mt-1 overflow-x-auto rounded-sm border border-strong">
        <table class="w-full text-left text-xs">
          <thead class="bg-surface-elevated text-muted-foreground">
            <tr>
              <th class="px-2 py-1 font-medium">Value</th>
              <th class="px-2 py-1 font-medium">Sites</th>
            </tr>
          </thead>
          <tbody>
            {#each defaultMatrix as row (row.v)}
              <tr class="border-t border-strong">
                <td class="px-2 py-1 font-mono">{row.v}</td>
                <td class="px-2 py-1 text-muted-foreground">
                  {row.sites.length > 0 ? row.sites.join(', ') : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if option.vals}
    {#each Object.entries(option.vals) as [label, terms] (label)}
      <div>
        <h4 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </h4>
        <dl class="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
          {#each terms as term (term.t)}
            <div class="flex flex-wrap items-baseline gap-x-2">
              <dt
                class="rounded-xs bg-surface-selected px-1.5 py-0.5 font-mono text-xs text-foreground"
              >
                {term.t}
              </dt>
              {#if term.d}
                <dd class="text-xs text-foreground">{term.d}</dd>
              {/if}
            </div>
          {/each}
        </dl>
      </div>
    {/each}
  {/if}

  {#if hasNoteSection}
    <div>
      <h4 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Note</h4>
      {#if option.note}
        <p class="mt-1 text-sm text-foreground/80">{option.note}</p>
      {/if}
      {#if option.nterms && option.nterms.length > 0}
        <dl class="mt-1 space-y-1.5">
          {#each option.nterms as term (term.t)}
            <div>
              <dt class="text-sm font-medium">{term.t}</dt>
              {#if term.d}
                <dd class="text-sm text-foreground">{term.d}</dd>
              {/if}
            </div>
          {/each}
        </dl>
      {/if}
    </div>
  {/if}

  {#if option.ex && option.ex.length > 0}
    <div>
      <h4 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Example
      </h4>
      <div class="mt-1 space-y-2">
        {#each option.ex as example, i (i)}
          <pre
            class="overflow-x-auto rounded-sm border border-strong bg-surface-elevated p-3 font-mono text-xs">{example}</pre>
        {/each}
      </div>
    </div>
  {/if}

  <div>
    <h4 class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      Add to config.json
    </h4>
    <div class="relative mt-1">
      <pre
        class="overflow-x-auto rounded-sm border border-strong bg-surface-elevated p-3 pr-40 font-mono text-xs">{snippet.json}</pre>
      <div class="absolute top-2 right-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline-primary"
          onclick={handleCopy}
          aria-live="polite"
        >
          {copyLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline-primary"
          onclick={handleAddToConfig}
          disabled={isAdding}
          loading={isAdding}
          aria-live="polite"
        >
          {addLabel}
        </Button>
      </div>
    </div>
    {#if snippet.note}
      <p class="mt-2 text-xs text-muted-foreground">{snippet.note}</p>
    {/if}
  </div>
</div>

<ConfirmModal
  show={showOverwriteModal}
  title="Overwrite existing config value?"
  confirmText="Overwrite"
  cancelText="Cancel"
  confirmVariant="warning"
  onConfirm={confirmOverwrite}
  onCancel={cancelOverwrite}
>
  <p class="text-sm text-foreground">
    <code class="font-mono text-foreground">{snippet.path.join('.')}</code> is already set in your config.json:
  </p>
  <pre
    class="mt-2 max-h-64 overflow-auto rounded-sm border border-strong bg-surface-elevated p-3 font-mono text-xs text-foreground">{overwriteCurrentValueDisplay}</pre>
  <p class="mt-2 text-sm text-muted-foreground">
    Overwrite it with the value shown in the snippet above?
  </p>
</ConfirmModal>
