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
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Button, ConfirmModal, Info } from '$lib/components/ui';
  import type { CookieDomainMetadata, CookiesPageData } from '$lib/cookieBackups/types';
  import { toastStore } from '$lib/stores/toast';

  interface InitialData extends Partial<CookiesPageData> {
    success: boolean;
    error?: string;
  }

  const { initialData }: { initialData: InitialData } = $props();

  const apiKeys = $derived(initialData.apiKeys ?? []);
  const cookieBackups = $derived(initialData.cookieBackups ?? {});

  let selectedKeyId = $state<string | null>(null);
  let domainDeleteTarget = $state<string | null>(null);
  let domainDeleteBusy = $state(false);
  let wholeDeleteOpen = $state(false);
  let wholeDeleteBusy = $state(false);

  const effectiveKeyId = $derived(
    selectedKeyId && apiKeys.some((k) => k.id === selectedKeyId)
      ? selectedKeyId
      : (apiKeys[0]?.id ?? null),
  );

  const selectedView = $derived(effectiveKeyId ? cookieBackups[effectiveKeyId] : undefined);
  const domains = $derived<CookieDomainMetadata[]>(selectedView?.domains ?? []);

  function pluralize(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  function formatTimestamp(value: number | null | undefined): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }

  function formatExpiry(value: number | null): string {
    if (value === null) {
      return 'No upcoming expiry';
    }
    return new Date(value * 1000).toLocaleString();
  }

  async function confirmDeleteDomain(): Promise<void> {
    if (!effectiveKeyId || !domainDeleteTarget) {
      return;
    }
    domainDeleteBusy = true;
    try {
      const response = await fetch(
        `/api/settings/cookies/${encodeURIComponent(effectiveKeyId)}?domain=${encodeURIComponent(domainDeleteTarget)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        toastStore.error('Delete failed', payload?.error ?? `Server error: ${response.status}`);
        return;
      }
      toastStore.success('Cookies deleted', `Removed synced cookies for ${domainDeleteTarget}.`);
      domainDeleteTarget = null;
      await invalidateAll();
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      domainDeleteBusy = false;
    }
  }

  async function confirmDeleteWholeBackup(): Promise<void> {
    if (!effectiveKeyId) {
      return;
    }
    wholeDeleteBusy = true;
    try {
      const response = await fetch(`/api/settings/cookies/${encodeURIComponent(effectiveKeyId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        toastStore.error('Delete failed', payload?.error ?? `Server error: ${response.status}`);
        return;
      }
      toastStore.success('Cookie backup deleted');
      wholeDeleteOpen = false;
      await invalidateAll();
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      wholeDeleteBusy = false;
    }
  }
</script>

{#if !initialData.success && initialData.error}
  <Info variant="error">
    <p class="text-sm">{initialData.error}</p>
  </Info>
{:else if apiKeys.length === 0}
  <Info
    variant="info"
    title="No API keys yet."
  >
    <p class="text-sm">
      Create an API key in <a
        class="text-link hover:underline"
        href={resolve('/settings/apikey')}>API Keys</a
      > to enable cookie syncing from the browser extension.
    </p>
  </Info>
{:else}
  <div class="space-y-6">
    <div class="content-panel">
      <h2>API Key</h2>
      <label
        class="mb-1 block text-sm font-medium text-muted-foreground"
        for="cookies-api-key"
      >
        Select an API key to view its synced cookies.
      </label>
      <select
        id="cookies-api-key"
        class="form-select max-w-md"
        value={effectiveKeyId}
        onchange={(event) => (selectedKeyId = (event.currentTarget as HTMLSelectElement).value)}
      >
        {#each apiKeys as key (key.id)}
          <option value={key.id}>{key.name}</option>
        {/each}
      </select>
    </div>

    <section class="data-list">
      <header class="data-list-header flex items-center justify-between gap-2">
        <h2 class="!mb-0">Synced Cookies ({domains.length})</h2>
        {#if selectedView?.hasBackup}
          <Button
            variant="outline-danger"
            size="sm"
            disabled={wholeDeleteBusy}
            onclick={() => (wholeDeleteOpen = true)}
          >
            Delete all
          </Button>
        {/if}
      </header>

      {#if selectedView?.hasBackup}
        <div
          class="flex items-center justify-between gap-2 px-4 py-2 text-xs text-muted-foreground"
        >
          <span>
            {pluralize(selectedView.domainCount, 'domain')} · {pluralize(
              selectedView.cookieCount,
              'cookie',
            )} · last sync
            {formatTimestamp(selectedView.updatedAt)}
            {#if selectedView.syncedBy}
              · by {selectedView.syncedBy}
            {/if}
          </span>
        </div>
      {/if}

      {#if domains.length === 0}
        <div class="p-4">
          <Info
            variant="info"
            title="No cookies synced for this API key."
          >
            <p class="text-sm">
              Use "Sync cookies for current site" in the extension's overlay Cookies tab to sync
              browser cookies for authenticated downloads. Cookie values are never sent back here —
              only counts and staleness are shown.
            </p>
          </Info>
        </div>
      {:else}
        {#each domains as entry (entry.domain)}
          <article class="data-list-item">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div class="text-sm font-semibold text-accent-foreground">{entry.domain}</div>
                <div class="text-xs text-muted-foreground">
                  {pluralize(entry.cookieCount, 'cookie')}
                  {#if entry.expiredCount > 0}
                    · {pluralize(entry.expiredCount, 'expired cookie')}
                  {/if}
                </div>
              </div>
              <Button
                variant="outline-danger"
                size="sm"
                onclick={() => (domainDeleteTarget = entry.domain)}
              >
                Delete
              </Button>
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              Earliest expiry: {formatExpiry(entry.earliestExpiry)} · Updated: {formatTimestamp(
                entry.updatedAt,
              )}
              {#if entry.syncedBy}
                · Synced by {entry.syncedBy}
              {/if}
            </div>
          </article>
        {/each}
      {/if}
    </section>
  </div>

  <ConfirmModal
    show={domainDeleteTarget !== null}
    title="Delete synced cookies?"
    message={`This removes the synced cookies for "${domainDeleteTarget ?? ''}" from gdluxx. Downloads for this site will no longer use them until the extension syncs again.`}
    confirmText={domainDeleteBusy ? 'Deleting…' : 'Delete'}
    confirmVariant="danger"
    onCancel={() => (domainDeleteTarget = null)}
    onConfirm={confirmDeleteDomain}
  />

  <ConfirmModal
    show={wholeDeleteOpen}
    title="Delete all synced cookies?"
    message="This removes every synced domain's cookies for this API key from gdluxx."
    confirmText={wholeDeleteBusy ? 'Deleting…' : 'Delete all'}
    confirmVariant="danger"
    onCancel={() => (wholeDeleteOpen = false)}
    onConfirm={confirmDeleteWholeBackup}
  />
{/if}
