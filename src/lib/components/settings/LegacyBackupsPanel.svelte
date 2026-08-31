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
  import { Button, ConfirmModal } from '$lib/components/ui';
  import type {
    SelectorBackupView,
    SelectorProfile,
    SubBackupView,
    SubProfile,
  } from '$lib/extensionProfiles/types';
  import { toastStore } from '$lib/stores/toast';

  interface Props {
    selectorProfiles: SelectorProfile[];
    subProfiles: SubProfile[];
    selectedSelectorView: SelectorBackupView | undefined;
    selectedSubView: SubBackupView | undefined;
    selectedKeyId: string | null;
  }

  const {
    selectorProfiles,
    subProfiles,
    selectedSelectorView,
    selectedSubView,
    selectedKeyId,
  }: Props = $props();

  let selectorDeleteId = $state<string | null>(null);
  let subDeleteId = $state<string | null>(null);
  let selectorDeleteBusy = $state(false);
  let subDeleteBusy = $state(false);

  function pluralize(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
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

  async function confirmDeleteSelector(): Promise<void> {
    if (!selectedKeyId || !selectorDeleteId) {
      return;
    }
    selectorDeleteBusy = true;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/selectors/${encodeURIComponent(selectorDeleteId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        toastStore.error('Delete failed', payload?.error ?? `Server error: ${response.status}`);
        return;
      }
      toastStore.success('Selector profile deleted');
      selectorDeleteId = null;
      await invalidateAll();
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      selectorDeleteBusy = false;
    }
  }

  async function confirmDeleteSub(): Promise<void> {
    if (!selectedKeyId || !subDeleteId) {
      return;
    }
    subDeleteBusy = true;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(selectedKeyId)}/subs/${encodeURIComponent(subDeleteId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        toastStore.error('Delete failed', payload?.error ?? `Server error: ${response.status}`);
        return;
      }
      toastStore.success('Substitution profile deleted');
      subDeleteId = null;
      await invalidateAll();
    } catch (err) {
      toastStore.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      subDeleteBusy = false;
    }
  }
</script>

<details class="content-panel text-sm">
  <summary class="cursor-pointer font-semibold">Legacy backups</summary>
  <p class="mt-2 text-xs text-muted-foreground">
    Selector and substitution backups were used by older extension versions. The current extension
    uses extraction profile backups instead.
  </p>

  {#if selectorProfiles.length > 0}
    <section class="mt-4">
      <h3 class="mb-2 text-sm font-semibold">Selectors ({selectorProfiles.length})</h3>
      <div class="mb-2 text-xs text-muted-foreground">
        {pluralize(selectedSelectorView?.profileCount ?? selectorProfiles.length, 'profile')} · last sync
        {formatTimestamp(selectedSelectorView?.updatedAt)}
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
                <code class="rounded-surface bg-background px-1 py-0.5">
                  {profile.startSelector || '—'}
                </code>
              </div>
              <div>
                End selector:
                <code class="rounded-surface bg-background px-1 py-0.5">
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
            <ul class="mt-2 rounded-surface bg-background px-2 py-1">
              {#each profile.rules as rule (rule.id)}
                <li class="font-mono text-[11px] leading-snug">
                  <span class={rule.enabled ? '' : 'text-muted-foreground line-through opacity-70'}>
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

<ConfirmModal
  show={selectorDeleteId !== null}
  title="Delete legacy selector profile?"
  message="This removes the legacy selector profile from the gdluxx server. Current extension versions do not use selector backups."
  confirmText={selectorDeleteBusy ? 'Deleting…' : 'Delete'}
  confirmVariant="danger"
  onCancel={() => (selectorDeleteId = null)}
  onConfirm={confirmDeleteSelector}
/>

<ConfirmModal
  show={subDeleteId !== null}
  title="Delete legacy substitution profile?"
  message="This removes the legacy substitution profile from the gdluxx server. Current extension versions do not use substitution backups."
  confirmText={subDeleteBusy ? 'Deleting…' : 'Delete'}
  confirmVariant="danger"
  onCancel={() => (subDeleteId = null)}
  onConfirm={confirmDeleteSub}
/>
