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
  import { Button, ConfirmModal, Info } from '$lib/components/ui';
  import SelectorProfileEditor from './SelectorProfileEditor.svelte';
  import SubProfileEditor from './SubProfileEditor.svelte';
  import ExtensionProfilesImportModal from './ExtensionProfilesImportModal.svelte';
  import type {
    ExtensionProfilesPageData,
    SelectorProfile,
    SubProfile,
  } from '$lib/extensionProfiles/types';
  import { Icon } from '$lib/components';
  import { toastStore } from '$lib/stores/toast';

  interface InitialData extends Partial<ExtensionProfilesPageData> {
    success: boolean;
    error?: string;
  }

  const { initialData }: { initialData: InitialData } = $props();

  const apiKeys = $derived(initialData.apiKeys ?? []);
  const selectorBackups = $derived(initialData.selectorBackups ?? {});
  const subBackups = $derived(initialData.subBackups ?? {});

  let selectedKeyId = $state<string | null>(null);
  let activeTab = $state<'selectors' | 'subs'>('selectors');

  let selectorEditorOpen = $state(false);
  let selectorEditorTarget = $state<SelectorProfile | null>(null);
  let selectorDeleteId = $state<string | null>(null);
  let subEditorOpen = $state(false);
  let subEditorTarget = $state<SubProfile | null>(null);
  let subDeleteId = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let busy = $state(false);
  let exportBusy = $state(false);
  let importOpen = $state(false);

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

  const selectorProfiles = $derived<SelectorProfile[]>(
    selectedSelectorView ? Object.values(selectedSelectorView.bundle.profiles) : [],
  );
  const subProfiles = $derived<SubProfile[]>(
    selectedSubView ? Object.values(selectedSubView.bundle.profiles) : [],
  );

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

  function formatTimestamp(value: number | null | undefined): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }

  function describeScope(profile: SelectorProfile | SubProfile): string {
    if (profile.scope === 'path') {
      return `Path • ${profile.host}${profile.path ?? ''}`;
    }
    if (profile.scope === 'origin' && profile.origin) {
      return `Origin • ${profile.origin}`;
    }
    return `Host • ${profile.host}`;
  }

  function openCreateSelector(): void {
    actionError = null;
    selectorEditorTarget = null;
    selectorEditorOpen = true;
  }

  function openEditSelector(profile: SelectorProfile): void {
    actionError = null;
    selectorEditorTarget = profile;
    selectorEditorOpen = true;
  }

  function closeSelectorEditor(): void {
    selectorEditorOpen = false;
    selectorEditorTarget = null;
  }

  async function onSelectorSaved(): Promise<void> {
    selectorEditorOpen = false;
    selectorEditorTarget = null;
    await invalidateAll();
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

  function openCreateSub(): void {
    actionError = null;
    subEditorTarget = null;
    subEditorOpen = true;
  }

  function openEditSub(profile: SubProfile): void {
    actionError = null;
    subEditorTarget = profile;
    subEditorOpen = true;
  }

  function closeSubEditor(): void {
    subEditorOpen = false;
    subEditorTarget = null;
  }

  async function onSubSaved(): Promise<void> {
    subEditorOpen = false;
    subEditorTarget = null;
    await invalidateAll();
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
        href="/settings/apikey">Key Manager</a
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
        Select an API key to view its synced extension profiles.
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
          variant="default"
          disabled={!selectedKeyId || exportBusy}
          onclick={handleExport}
        >
          {exportBusy ? 'Exporting…' : 'Export profiles'}
        </Button>
        <Button
          variant="default"
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

    <div
      role="tablist"
      class="inline-flex w-fit gap-1 rounded-sm bg-surface-sunken p-1"
    >
      <button
        role="tab"
        type="button"
        aria-selected={activeTab === 'selectors'}
        class="cursor-pointer rounded-sm px-3 py-1.5 text-sm font-medium transition-colors {activeTab ===
        'selectors'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => (activeTab = 'selectors')}
      >
        Selectors
        <span
          class="ml-2 inline-flex items-center justify-center rounded-full bg-surface-active px-2 py-0.5 text-xs"
        >
          {selectorProfiles.length}
        </span>
      </button>
      <button
        role="tab"
        type="button"
        aria-selected={activeTab === 'subs'}
        class="cursor-pointer rounded-sm px-3 py-1.5 text-sm font-medium transition-colors {activeTab ===
        'subs'
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => (activeTab = 'subs')}
      >
        Substitutions
        <span
          class="ml-2 inline-flex items-center justify-center rounded-full bg-surface-active px-2 py-0.5 text-xs"
        >
          {subProfiles.length}
        </span>
      </button>
    </div>

    {#if activeTab === 'selectors'}
      <section class="data-list">
        <header class="data-list-header flex items-center justify-between">
          <h2 class="!mb-0">Selectors ({selectorProfiles.length})</h2>
          <Button
            variant="primary"
            onclick={openCreateSelector}>New selector profile</Button
          >
        </header>

        {#if actionError}
          <div class="p-4">
            <Info variant="error">
              <p class="text-sm">{actionError}</p>
            </Info>
          </div>
        {/if}

        {#if selectorProfiles.length === 0}
          <div class="p-4">
            <Info
              variant="info"
              title="No selector profiles for this API key."
            >
              <p class="text-sm">
                Selector profiles created in the browser extension or via the "New selector profile"
                button above will appear here.
              </p>
            </Info>
          </div>
        {:else}
          {#each selectorProfiles as profile (profile.id)}
            <article class="data-list-item">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="text-sm font-semibold text-accent-foreground">
                    {profile.name ?? profile.id}
                  </div>
                  <div class="text-xs text-muted-foreground">{describeScope(profile)}</div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button
                    onclick={() => openEditSelector(profile)}
                    variant="outline-primary"
                    size="sm"
                  >
                    <Icon
                      iconName="edit"
                      size={20}
                      class="mr-1"
                    />
                  </Button>
                  <Button
                    onclick={() => (selectorDeleteId = profile.id)}
                    variant="outline-danger"
                    size="sm"
                  >
                    <Icon
                      iconName="delete"
                      size={20}
                      class="mr-1"
                    />
                  </Button>
                </div>
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
        {/if}
      </section>
    {:else}
      <section class="data-list">
        <header class="data-list-header flex items-center justify-between">
          <h2 class="!mb-0">Substitutions ({subProfiles.length})</h2>
          <Button
            variant="primary"
            onclick={openCreateSub}>New substitution profile</Button
          >
        </header>

        {#if actionError}
          <div class="p-4">
            <Info variant="error">
              <p class="text-sm">{actionError}</p>
            </Info>
          </div>
        {/if}

        {#if subProfiles.length === 0}
          <div class="p-4">
            <Info
              variant="info"
              title="No substitution profiles for this API key."
            >
              <p class="text-sm">
                Substitution profiles created in the browser extension or via the "New substitution
                profile" button above will appear here.
              </p>
            </Info>
          </div>
        {:else}
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
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="default"
                    onclick={() => openEditSub(profile)}>Edit</Button
                  >
                  <Button
                    variant="outline-danger"
                    onclick={() => (subDeleteId = profile.id)}
                  >
                    Delete
                  </Button>
                </div>
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
                      class={rule.enabled ? '' : 'text-muted-foreground line-through opacity-70'}
                    >
                      /{rule.pattern}/{rule.flags} → {rule.replacement || '—'}
                    </span>
                  </li>
                {/each}
              </ul>
            </article>
          {/each}
        {/if}
      </section>
    {/if}

    {#if selectedKeyId}
      <details class="content-panel text-sm">
        <summary class="cursor-pointer font-semibold">Sync details</summary>
        <div class="mt-2 grid gap-1 text-xs">
          <div>
            <span class="font-semibold">Selectors:</span>
            {#if selectedSelectorView?.hasBackup}
              {selectedSelectorView.profileCount} profile(s) · last sync
              {formatTimestamp(selectedSelectorView.updatedAt)}
              {#if selectedSelectorView.syncedBy}
                · by {selectedSelectorView.syncedBy}
              {/if}
            {:else}
              no remote backup
            {/if}
          </div>
          <div>
            <span class="font-semibold">Substitutions:</span>
            {#if selectedSubView?.hasBackup}
              {selectedSubView.profileCount} profile(s) · last sync
              {formatTimestamp(selectedSubView.updatedAt)}
              {#if selectedSubView.syncedBy}
                · by {selectedSubView.syncedBy}
              {/if}
            {:else}
              no remote backup
            {/if}
          </div>
        </div>
      </details>
    {/if}
  </div>

  {#if selectedKeyId}
    <SelectorProfileEditor
      show={selectorEditorOpen}
      apiKeyId={selectedKeyId}
      profile={selectorEditorTarget}
      onClose={closeSelectorEditor}
      onSaved={onSelectorSaved}
    />
    <SubProfileEditor
      show={subEditorOpen}
      apiKeyId={selectedKeyId}
      profile={subEditorTarget}
      onClose={closeSubEditor}
      onSaved={onSubSaved}
    />
  {/if}

  <ConfirmModal
    show={selectorDeleteId !== null}
    title="Delete selector profile?"
    message="This removes the profile from the gdluxx server. The browser extension will overwrite this on its next sync if it still has the profile locally."
    confirmText={busy ? 'Deleting…' : 'Delete'}
    confirmVariant="danger"
    onCancel={() => (selectorDeleteId = null)}
    onConfirm={confirmDeleteSelector}
  />

  <ConfirmModal
    show={subDeleteId !== null}
    title="Delete substitution profile?"
    message="This removes the profile from the gdluxx server. The browser extension will overwrite this on its next sync if it still has the profile locally."
    confirmText={busy ? 'Deleting…' : 'Delete'}
    confirmVariant="danger"
    onCancel={() => (subDeleteId = null)}
    onConfirm={confirmDeleteSub}
  />
{/if}
