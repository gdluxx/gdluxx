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
  import { Button, Info } from '#components/ui';
  import type { ExtractionProfileStore } from '#stores/extractionProfileStore.svelte';
  import type { GalleryDisplayConfig } from '#src/content/types';
  import type { Settings } from '#utils/settings';
  import { formatTimestamp, describeExtractionProfile } from '#utils/formatters';

  interface Props {
    extractionStore: ExtractionProfileStore;
    settings: Settings;
    isConfigured: boolean;
  }

  let { extractionStore, settings, isConfigured }: Props = $props();

  let galleryDraft = $state<GalleryDisplayConfig>({ ...extractionStore.galleryDefaults });
  let savingGallery = $state(false);

  function syncTextareaValue(node: HTMLTextAreaElement, value: string | null | undefined) {
    const apply = (next: string | null | undefined) => {
      const normalized = next ?? '';
      if (node.value !== normalized) node.value = normalized;
    };
    apply(value);
    return {
      update(next: string | null | undefined) {
        apply(next);
      },
    };
  }

  async function handleSaveGalleryDefaults(): Promise<void> {
    savingGallery = true;
    try {
      await extractionStore.saveGalleryDefaults(galleryDraft);
    } finally {
      savingGallery = false;
    }
  }
</script>

<div class="mx-2 my-4 max-w-[640px]">
  <!-- Manage profiles card -->
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Manage extraction profiles</div>

      <!-- Local actions -->
      <div class="mb-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onclick={() => extractionStore.refreshAllProfiles()}
        >
          Refresh
        </Button>
        <Button
          variant="secondary"
          onclick={() => extractionStore.exportProfiles()}
          disabled={extractionStore.isExporting || extractionStore.allProfiles.length === 0}
        >
          {#if extractionStore.isExporting}
            <span class="loading loading-sm loading-spinner"></span>
            Exporting...
          {:else}
            Export
          {/if}
        </Button>
        <Button
          variant="secondary"
          onclick={() => extractionStore.importProfiles()}
          disabled={extractionStore.isImporting || !extractionStore.importText.trim()}
        >
          {#if extractionStore.isImporting}
            <span class="loading loading-sm loading-spinner"></span>
            Importing...
          {:else}
            Import
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={() => extractionStore.clearProfiles()}
          disabled={extractionStore.isClearing || extractionStore.allProfiles.length === 0}
        >
          {#if extractionStore.isClearing}
            <span class="loading loading-sm loading-spinner"></span>
            Clearing...
          {:else}
            Clear All
          {/if}
        </Button>
      </div>

      <!-- Remote backup actions -->
      <div class="mb-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onclick={() => extractionStore.backupToRemote(settings.serverUrl, settings.apiKey)}
          disabled={!isConfigured || extractionStore.backupLoading}
        >
          {#if extractionStore.backupLoading}
            <span class="loading loading-sm loading-spinner"></span>
            Saving...
          {:else}
            Save to gdluxx
          {/if}
        </Button>
        <Button
          variant="secondary"
          onclick={() => extractionStore.restoreFromRemote(settings.serverUrl, settings.apiKey)}
          disabled={!isConfigured || extractionStore.backupLoading}
        >
          {#if extractionStore.backupLoading}
            <span class="loading loading-sm loading-spinner"></span>
            Restoring...
          {:else}
            Restore from gdluxx
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={() => extractionStore.fetchBackupMeta(settings.serverUrl, settings.apiKey, true)}
          disabled={!isConfigured || extractionStore.backupLoading}
        >
          {#if extractionStore.backupLoading}
            <span class="loading loading-sm loading-spinner"></span>
            Checking...
          {:else}
            Check remote status
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={() => extractionStore.deleteRemoteBackup(settings.serverUrl, settings.apiKey)}
          disabled={!isConfigured || extractionStore.backupLoading}
        >
          Clear remote backup
        </Button>
      </div>

      <!-- Remote backup status -->
      <div class="mb-3">
        {#if extractionStore.remoteBackupMeta && extractionStore.remoteBackupMeta.hasBackup}
          <Info>
            <p class="text-sm">
              Last backup: {extractionStore.remoteBackupMeta.updatedAt
                ? formatTimestamp(extractionStore.remoteBackupMeta.updatedAt)
                : '—'}
              {#if extractionStore.remoteBackupMeta.syncedBy}
                · Saved by {extractionStore.remoteBackupMeta.syncedBy}
              {/if}
            </p>
            <p class="text-base-content/60 text-xs">
              {extractionStore.remoteBackupMeta.profileCount} profile{extractionStore
                .remoteBackupMeta.profileCount === 1
                ? ''
                : 's'} stored on gdluxx.
            </p>
          </Info>
        {:else if extractionStore.remoteBackupMeta}
          <Info
            soft
            title="No remote backup found for this API key yet."
          >
            Use "Save to gdluxx" to create a backup while keeping local storage primary.
          </Info>
        {:else}
          <Info>
            <p class="text-sm">
              {isConfigured
                ? 'Remote backup status is unavailable. Try checking again.'
                : 'Configure your gdluxx connection to enable remote backups.'}
            </p>
          </Info>
        {/if}
      </div>

      <!-- Import JSON -->
      <div class="mb-3">
        <label
          class="mx-2 mb-1 block text-sm font-semibold"
          for="import-extraction-json"
        >
          Import JSON
        </label>
        <textarea
          class="textarea-bordered textarea focus:ring-primary/20 focus:textarea-primary h-24 w-full resize-y transition-all focus:ring-2"
          style="resize: vertical; min-height: 6rem;"
          use:syncTextareaValue={extractionStore.importText}
          oninput={(event) =>
            extractionStore.setImportText((event.target as HTMLTextAreaElement).value)}
          id="import-extraction-json"
          placeholder=""
        ></textarea>
        {#if extractionStore.importError}
          <p class="text-error mx-2 mt-1 text-xs">{extractionStore.importError}</p>
        {:else}
          <small class="text-base-content/50 mx-2 mt-1 block text-xs">
            Profiles merge with existing entries. Rules limited to 20 per profile.
          </small>
        {/if}
      </div>
    </div>
  </div>

  <!-- Profile list -->
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Saved profiles</div>
      <div class="mb-3 flex items-center gap-2">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
          placeholder="Search by host, scope, or name"
          value={extractionStore.profileSearch}
          oninput={(event) =>
            extractionStore.setProfileSearch((event.target as HTMLInputElement).value)}
        />
        {#if extractionStore.profileSearch}
          <Button
            variant="ghost"
            onclick={() => extractionStore.setProfileSearch('')}
          >
            Clear
          </Button>
        {/if}
      </div>

      {#if extractionStore.filteredProfiles.length === 0}
        <p class="text-base-content/50 text-sm">
          {extractionStore.allProfiles.length === 0
            ? 'No extraction profiles saved yet.'
            : 'No profiles match your search.'}
        </p>
      {:else}
        <div class="space-y-3">
          {#each extractionStore.filteredProfiles as profile (profile.id)}
            <div class="border-base-300 bg-base-200 rounded-sm border p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="text-sm font-semibold">{describeExtractionProfile(profile)}</div>
                  <div class="text-base-content/70 text-xs">
                    {profile.scope === 'path' && profile.path
                      ? `Path • ${profile.host}${profile.path}`
                      : profile.scope === 'origin' && profile.origin
                        ? `Origin • ${profile.origin}`
                        : `Host • ${profile.host}`}
                    · {profile.extraction.mode} mode · {profile.rules.length}
                    {profile.rules.length === 1 ? 'rule' : 'rules'}
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onclick={() => extractionStore.applyProfile(profile.id)}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    onclick={() => extractionStore.deleteProfileById(profile.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div class="text-base-content/70 mt-2 grid gap-1 text-xs">
                <div>
                  Updated: {formatTimestamp(profile.updatedAt)}
                  {#if profile.lastUsed}
                    · Last used: {formatTimestamp(profile.lastUsed)}
                  {/if}
                </div>
              </div>
              <label class="text-base-content/70 mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span>Name</span>
                <input
                  class="input-bordered input input-xs focus:ring-primary/20 focus:input-primary transition-all focus:ring-2"
                  value={extractionStore.profileNameDrafts[profile.id] ?? ''}
                  oninput={(event) =>
                    extractionStore.updateNameDraft(
                      profile.id,
                      (event.target as HTMLInputElement).value,
                    )}
                  onblur={(event) =>
                    extractionStore.renameProfile(
                      profile.id,
                      (event.target as HTMLInputElement).value,
                    )}
                  onkeydown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Optional label"
                />
              </label>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Gallery display defaults -->
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body gap-4">
      <div class="card-title">Gallery display defaults</div>
      <p class="text-base-content/70 text-sm">
        Global defaults for the floating gallery. Can be overridden per saved profile.
      </p>

      <div>
        <span class="text-base-content/70 mb-1 block text-xs">
          Thumbnail sizes (px) — small · default · large
        </span>
        <div class="flex gap-2">
          {#each galleryDraft.thumbSizes as _, i (i)}
            <input
              type="number"
              class="input input-bordered input-sm w-24"
              min="50"
              max="600"
              value={galleryDraft.thumbSizes[i]}
              oninput={(e) => {
                const sizes: [number, number, number] = [...galleryDraft.thumbSizes];
                sizes[i] = Number((e.target as HTMLInputElement).value);
                galleryDraft = { ...galleryDraft, thumbSizes: sizes };
              }}
            />
          {/each}
        </div>
      </div>

      <div class="flex gap-2">
        <label class="flex-1">
          <span class="text-base-content/70 mb-1 block text-xs">Grid gap (px)</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            min="0"
            max="40"
            value={galleryDraft.gap}
            oninput={(e) =>
              (galleryDraft = {
                ...galleryDraft,
                gap: Number((e.target as HTMLInputElement).value),
              })}
          />
        </label>
        <label class="flex-1">
          <span class="text-base-content/70 mb-1 block text-xs">Modal border (px)</span>
          <input
            type="number"
            class="input input-bordered input-sm w-full"
            min="0"
            max="100"
            value={galleryDraft.border}
            oninput={(e) =>
              (galleryDraft = {
                ...galleryDraft,
                border: Number((e.target as HTMLInputElement).value),
              })}
          />
        </label>
        <label class="flex-1">
          <span class="text-base-content/70 mb-1 block text-xs">Button corner</span>
          <select
            class="select select-bordered select-sm w-full"
            value={galleryDraft.buttonCorner}
            onchange={(e) => {
              galleryDraft = {
                ...galleryDraft,
                buttonCorner: (e.target as HTMLSelectElement)
                  .value as typeof galleryDraft.buttonCorner,
              };
            }}
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
          </select>
        </label>
      </div>

      <div class="flex justify-end">
        <Button
          variant="primary"
          onclick={handleSaveGalleryDefaults}
          disabled={savingGallery}
        >
          {#if savingGallery}
            <span class="loading loading-sm loading-spinner"></span>
            Saving...
          {:else}
            Save defaults
          {/if}
        </Button>
      </div>
    </div>
  </div>
</div>
