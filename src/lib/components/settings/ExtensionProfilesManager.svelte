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
  import ExtensionProfilesImportModal from './ExtensionProfilesImportModal.svelte';
  import ExtractionProfileEditor from './ExtractionProfileEditor.svelte';
  import type {
    ExtractionBackupView,
    ExtractionProfile,
    ExtensionProfilesPageData,
    SelectorProfile,
    SubProfile,
  } from '$lib/extensionProfiles/types';
  import { toastStore } from '$lib/stores/toast';

  interface InitialData extends Partial<ExtensionProfilesPageData> {
    success: boolean;
    error?: string;
  }

  const { initialData }: { initialData: InitialData } = $props();

  const apiKeys = $derived(initialData.apiKeys ?? []);
  const selectorBackups = $derived(initialData.selectorBackups ?? {});
  const subBackups = $derived(initialData.subBackups ?? {});
  const extractionBackups = $derived(initialData.extractionBackups ?? {});

  let selectedKeyId = $state<string | null>(null);
  let selectorDeleteId = $state<string | null>(null);
  let subDeleteId = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let busy = $state(false);
  let exportBusy = $state(false);
  let importOpen = $state(false);
  let extractionDeleteBusy = $state(false);
  let extractionEditorOpen = $state(false);
  let extractionEditorProfile = $state<ExtractionProfile | null>(null);
  let extractionProfileDeleteId = $state<string | null>(null);
  let extractionProfileDeleteBusy = $state(false);

  $effect(() => {
    if (apiKeys.length === 0) {
      selectedKeyId = null;
      return;
    }
    if (!selectedKeyId || !apiKeys.some((k) => k.id === selectedKeyId)) {
      selectedKeyId = apiKeys[0].id;
    }
  });

  const selectedKeyName = $derived(
    apiKeys.find((k) => k.id === selectedKeyId)?.name ?? 'Unnamed Key',
  );
  const selectedSelectorView = $derived(selectedKeyId ? selectorBackups[selectedKeyId] : undefined);
  const selectedSubView = $derived(selectedKeyId ? subBackups[selectedKeyId] : undefined);
  const selectedExtractionView = $derived<ExtractionBackupView | undefined>(
    selectedKeyId
      ? (extractionBackups[selectedKeyId] as ExtractionBackupView | undefined)
      : undefined,
  );

  const selectorProfiles = $derived<SelectorProfile[]>(
    selectedSelectorView ? Object.values(selectedSelectorView.bundle.profiles) : [],
  );
  const subProfiles = $derived<SubProfile[]>(
    selectedSubView ? Object.values(selectedSubView.bundle.profiles) : [],
  );
  const extractionProfiles = $derived<ExtractionProfile[]>(
    selectedExtractionView ? Object.values(selectedExtractionView.bundle.profiles) : [],
  );
  const hasLegacyData = $derived(selectorProfiles.length > 0 || subProfiles.length > 0);

  async function handleExport(): Promise<void> {
    if (!selectedKeyId) {
      return;
    }
    exportBusy = true;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/export`,
      );
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        toastStore.error('Export failed', err?.error ?? `Server error: ${response.status}`);
        return;
      }
      const blob = await response.blob();
      const cd = response.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `gdluxx-extension-profiles-${Date.now()}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toastStore.success('Export complete');
    } finally {
      exportBusy = false;
    }
  }

  function pluralize(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  function formatTimestamp(value: number | null | undefined): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }

  function describeScope(profile: SelectorProfile | SubProfile | ExtractionProfile): string {
    if (profile.scope === 'path') {
      return `Path • ${profile.host}${profile.path ?? ''}`;
    }
    if (profile.scope === 'origin' && profile.origin) {
      return `Origin • ${profile.origin}`;
    }
    return `Host • ${profile.host}`;
  }

  async function confirmDeleteSelector(): Promise<void> {
    if (!selectedKeyId || !selectorDeleteId) {
      return;
    }
    busy = true;
    actionError = null;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/selectors/${encodeURIComponent(selectorDeleteId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        actionError = payload?.error ?? `Server error: ${response.status}`;
        return;
      }
      selectorDeleteId = null;
      await invalidateAll();
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      busy = false;
    }
  }

  async function confirmDeleteSub(): Promise<void> {
    if (!selectedKeyId || !subDeleteId) {
      return;
    }
    busy = true;
    actionError = null;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/subs/${encodeURIComponent(subDeleteId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        actionError = payload?.error ?? `Server error: ${response.status}`;
        return;
      }
      subDeleteId = null;
      await invalidateAll();
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      busy = false;
    }
  }

  async function confirmDeleteExtractionBackup(): Promise<void> {
    if (!selectedKeyId) {
      return;
    }
    extractionDeleteBusy = true;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/extraction`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        toastStore.error('Delete failed', payload?.error ?? `Server error: ${response.status}`);
        return;
      }
      toastStore.success('Extraction backup deleted');
      await invalidateAll();
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      extractionDeleteBusy = false;
    }
  }

  function openExtractionEditor(profile: ExtractionProfile | null): void {
    extractionEditorProfile = profile;
    extractionEditorOpen = true;
  }

  async function confirmDeleteExtractionProfile(): Promise<void> {
    if (!selectedKeyId || !extractionProfileDeleteId) {
      return;
    }
    extractionProfileDeleteBusy = true;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/extraction/${encodeURIComponent(extractionProfileDeleteId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        toastStore.error('Delete failed', payload?.error ?? `Server error: ${response.status}`);
        return;
      }
      extractionProfileDeleteId = null;
      await invalidateAll();
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      extractionProfileDeleteBusy = false;
    }
  }

  function describeExtractionMode(profile: ExtractionProfile): string {
    if (profile.extraction.mode === 'range') {
      return 'Range';
    }
    const via = profile.extraction.container.via;
    if (via === 'body') {
      return 'Targeted · body';
    }
    if (via === 'selector') {
      return 'Targeted · selector';
    }
    return 'Targeted · string markers';
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
      > to enable extension profile syncing.
    </p>
  </Info>
{:else}
  <div class="space-y-6">
    <div class="content-panel">
      <h2>API Key</h2>
      <label
        class="mb-1 block text-sm font-medium text-muted-foreground"
        for="extension-profiles-api-key"
      >
        Select an API key to view its synced extraction profile backup.
      </label>
      <select
        id="extension-profiles-api-key"
        class="form-select max-w-md"
        bind:value={selectedKeyId}
      >
        {#each apiKeys as key (key.id)}
          <option value={key.id}>{key.name}</option>
        {/each}
      </select>

      <div class="mt-3 flex gap-2">
        <Button
          variant="outline-primary"
          disabled={!selectedKeyId || exportBusy}
          onclick={handleExport}
        >
          {exportBusy ? 'Exporting…' : 'Export profiles'}
        </Button>
        <Button
          variant="outline-primary"
          disabled={!selectedKeyId}
          onclick={() => (importOpen = true)}
        >
          Import profiles
        </Button>
      </div>

      {#if importOpen && selectedKeyId}
        <ExtensionProfilesImportModal
          apiKeyId={selectedKeyId}
          apiKeyName={selectedKeyName}
          onClose={() => (importOpen = false)}
          onImported={async () => {
            await invalidateAll();
            importOpen = false;
          }}
        />
      {/if}
    </div>

    <section class="data-list">
      <header class="data-list-header flex items-center justify-between gap-2">
        <h2 class="!mb-0">Extraction Profiles ({extractionProfiles.length})</h2>
        <div class="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedKeyId}
            onclick={() => openExtractionEditor(null)}
          >
            New profile
          </Button>
        </div>
      </header>

      {#if selectedExtractionView?.hasBackup}
        <div
          class="flex items-center justify-between gap-2 px-4 py-2 text-xs text-muted-foreground"
        >
          <span>
            {pluralize(selectedExtractionView.profileCount, 'profile')} · last sync
            {formatTimestamp(selectedExtractionView.updatedAt)}
            {#if selectedExtractionView.syncedBy}
              · by {selectedExtractionView.syncedBy}
            {/if}
          </span>
          <Button
            variant="outline-danger"
            size="sm"
            disabled={extractionDeleteBusy}
            onclick={confirmDeleteExtractionBackup}
          >
            {extractionDeleteBusy ? 'Deleting…' : 'Delete backup'}
          </Button>
        </div>
      {/if}

      {#if extractionProfiles.length === 0}
        <div class="p-4">
          <Info
            variant="info"
            title="No extraction backup for this API key."
          >
            <p class="text-sm">
              Use "Save to gdluxx" in the extension's Extraction Profiles settings to sync your
              profiles, or create one here with "New profile".
            </p>
          </Info>
        </div>
      {:else}
        {#each extractionProfiles as profile (profile.id)}
          <article class="data-list-item">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div class="text-sm font-semibold text-accent-foreground">
                  {profile.name ?? profile.id}
                </div>
                <div class="text-xs text-muted-foreground">
                  {describeScope(profile)} · {describeExtractionMode(profile)}
                  {#if profile.rules.length > 0}
                    · {profile.rules.length}
                    {profile.rules.length === 1 ? 'rule' : 'rules'}
                  {/if}
                </div>
              </div>
              <div class="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onclick={() => openExtractionEditor(profile)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onclick={() => (extractionProfileDeleteId = profile.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              Updated: {formatTimestamp(profile.updatedAt)}
              {#if profile.lastUsed}
                · Last used: {formatTimestamp(profile.lastUsed)}
              {/if}
            </div>
          </article>
        {/each}
      {/if}
    </section>

    {#if hasLegacyData}
      <details class="content-panel text-sm">
        <summary class="cursor-pointer font-semibold">Legacy backups</summary>
        <p class="mt-2 text-xs text-muted-foreground">
          Selector and substitution backups were used by older extension versions. The current
          extension uses extraction profile backups instead.
        </p>

        {#if actionError}
          <div class="mt-3">
            <Info variant="error">
              <p class="text-sm">{actionError}</p>
            </Info>
          </div>
        {/if}

        {#if selectorProfiles.length > 0}
          <section class="mt-4">
            <h3 class="mb-2 text-sm font-semibold">Selectors ({selectorProfiles.length})</h3>
            <div class="mb-2 text-xs text-muted-foreground">
              {pluralize(selectedSelectorView?.profileCount ?? selectorProfiles.length, 'profile')} ·
              last sync {formatTimestamp(selectedSelectorView?.updatedAt)}
              {#if selectedSelectorView?.syncedBy}
                · by {selectedSelectorView.syncedBy}
              {/if}
            </div>
            <div class="grid gap-3">
              {#each selectorProfiles as profile (profile.id)}
                <article class="data-list-item">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="text-sm font-semibold text-accent-foreground">
                        {profile.name ?? profile.id}
                      </div>
                      <div class="text-xs text-muted-foreground">{describeScope(profile)}</div>
                    </div>
                    <Button
                      onclick={() => (selectorDeleteId = profile.id)}
                      variant="outline-danger"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                  <div class="mt-2 grid gap-1 text-xs text-muted-foreground">
                    <div>
                      Start selector:
                      <code class="rounded-sm bg-background px-1 py-0.5">
                        {profile.startSelector || '—'}
                      </code>
                    </div>
                    <div>
                      End selector:
                      <code class="rounded-sm bg-background px-1 py-0.5">
                        {profile.endSelector || '—'}
                      </code>
                    </div>
                    <div>
                      Updated: {formatTimestamp(profile.updatedAt)}
                      {#if profile.lastUsed}
                        · Last used: {formatTimestamp(profile.lastUsed)}
                      {/if}
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          </section>
        {/if}

        {#if subProfiles.length > 0}
          <section class="mt-4">
            <h3 class="mb-2 text-sm font-semibold">Substitutions ({subProfiles.length})</h3>
            <div class="mb-2 text-xs text-muted-foreground">
              {pluralize(selectedSubView?.profileCount ?? subProfiles.length, 'profile')} · last sync
              {formatTimestamp(selectedSubView?.updatedAt)}
              {#if selectedSubView?.syncedBy}
                · by {selectedSubView.syncedBy}
              {/if}
            </div>
            <div class="grid gap-3">
              {#each subProfiles as profile (profile.id)}
                <article class="data-list-item">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div class="text-sm font-semibold">{profile.name ?? profile.id}</div>
                      <div class="text-xs text-muted-foreground">
                        {describeScope(profile)} · {profile.rules.length}
                        {profile.rules.length === 1 ? 'rule' : 'rules'} · Apply to previews:
                        {profile.applyToPreview ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onclick={() => (subDeleteId = profile.id)}
                    >
                      Delete
                    </Button>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground">
                    Updated: {formatTimestamp(profile.updatedAt)}
                    {#if profile.lastUsed}
                      · Last used: {formatTimestamp(profile.lastUsed)}
                    {/if}
                  </div>
                  <ul class="mt-2 rounded-sm bg-background px-2 py-1">
                    {#each profile.rules as rule (rule.id)}
                      <li class="font-mono text-[11px] leading-snug">
                        <span
                          class={rule.enabled
                            ? ''
                            : 'text-muted-foreground line-through opacity-70'}
                        >
                          /{rule.pattern}/{rule.flags} → {rule.replacement || '—'}
                        </span>
                      </li>
                    {/each}
                  </ul>
                </article>
              {/each}
            </div>
          </section>
        {/if}
      </details>
    {/if}
  </div>

  {#if selectedKeyId}
    <ExtractionProfileEditor
      show={extractionEditorOpen}
      apiKeyId={selectedKeyId}
      profile={extractionEditorProfile}
      onClose={() => (extractionEditorOpen = false)}
      onSaved={async () => {
        await invalidateAll();
        extractionEditorOpen = false;
      }}
    />
  {/if}

  <ConfirmModal
    show={extractionProfileDeleteId !== null}
    title="Delete extraction profile?"
    message="This removes the profile from the gdluxx backup. It will not be removed from extensions that already restored it."
    confirmText={extractionProfileDeleteBusy ? 'Deleting…' : 'Delete'}
    confirmVariant="danger"
    onCancel={() => (extractionProfileDeleteId = null)}
    onConfirm={confirmDeleteExtractionProfile}
  />

  <ConfirmModal
    show={selectorDeleteId !== null}
    title="Delete legacy selector profile?"
    message="This removes the legacy selector profile from the gdluxx server. Current extension versions do not use selector backups."
    confirmText={busy ? 'Deleting…' : 'Delete'}
    confirmVariant="danger"
    onCancel={() => (selectorDeleteId = null)}
    onConfirm={confirmDeleteSelector}
  />

  <ConfirmModal
    show={subDeleteId !== null}
    title="Delete legacy substitution profile?"
    message="This removes the legacy substitution profile from the gdluxx server. Current extension versions do not use substitution backups."
    confirmText={busy ? 'Deleting…' : 'Delete'}
    confirmVariant="danger"
    onCancel={() => (subDeleteId = null)}
    onConfirm={confirmDeleteSub}
  />
{/if}
