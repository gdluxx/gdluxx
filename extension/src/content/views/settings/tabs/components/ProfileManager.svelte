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
  import type { SavedSelectorProfile } from '#src/content/lib/storageProfiles';
  import type { RemoteBackupMeta } from '#src/content/types';

  interface ProfileManagerProps {
    isConfigured: boolean;
    isSavingSettings: boolean;
    isTestingConnection: boolean;
    isSavingRemoteBackup: boolean;
    isRestoringRemoteBackup: boolean;
    isLoadingRemoteBackup: boolean;
    isDeletingRemoteBackup: boolean;
    isExportingProfiles: boolean;
    isImportingProfiles: boolean;
    isClearingProfiles: boolean;
    allProfiles: SavedSelectorProfile[];
    filteredProfiles: SavedSelectorProfile[];
    profileNameDrafts: Record<string, string>;
    profileSearch: string;
    importProfilesText: string;
    importProfilesError: string | null;
    remoteBackupMeta: RemoteBackupMeta | null;
    formatTimestamp: (value?: number) => string;
    describeProfile: (profile: SavedSelectorProfile) => string;
    onRefreshProfiles: () => void | Promise<void>;
    onExportProfiles: () => void | Promise<void>;
    onImportProfiles: () => void | Promise<void>;
    onClearProfiles: () => void | Promise<void>;
    onBackupProfiles: () => void | Promise<void>;
    onRestoreProfiles: () => void | Promise<void>;
    onRefreshRemoteStatus: () => void | Promise<void>;
    onDeleteRemoteBackup: () => void | Promise<void>;
    onApplyProfile: (id: string) => void | Promise<void>;
    onDeleteProfile: (id: string) => void | Promise<void>;
    onRenameProfile: (id: string, name: string) => void | Promise<void>;
    onImportTextChange: (value: string) => void;
    onProfileSearchChange: (value: string) => void;
    onProfileDraftChange: (id: string, value: string) => void;
  }

  const {
    isConfigured,
    isSavingSettings,
    isTestingConnection,
    isSavingRemoteBackup,
    isRestoringRemoteBackup,
    isLoadingRemoteBackup,
    isDeletingRemoteBackup,
    isExportingProfiles,
    isImportingProfiles,
    isClearingProfiles,
    allProfiles,
    filteredProfiles,
    profileNameDrafts,
    profileSearch,
    importProfilesText,
    importProfilesError,
    remoteBackupMeta,
    formatTimestamp,
    describeProfile,
    onRefreshProfiles,
    onExportProfiles,
    onImportProfiles,
    onClearProfiles,
    onBackupProfiles,
    onRestoreProfiles,
    onRefreshRemoteStatus,
    onDeleteRemoteBackup,
    onApplyProfile,
    onDeleteProfile,
    onRenameProfile,
    onImportTextChange,
    onProfileSearchChange,
    onProfileDraftChange,
  }: ProfileManagerProps = $props();
</script>

<div class="mx-2 my-4 max-w-[640px]">
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Manage saved profiles</div>
      <div class="mb-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onclick={onRefreshProfiles}
        >
          Refresh
        </Button>
        <Button
          variant="secondary"
          onclick={onExportProfiles}
          disabled={isExportingProfiles || allProfiles.length === 0}
        >
          Export
        </Button>
        <Button
          variant="secondary"
          onclick={onImportProfiles}
          disabled={isImportingProfiles || !importProfilesText.trim()}
        >
          Import
        </Button>
        <Button
          variant="ghost"
          onclick={onClearProfiles}
          disabled={isClearingProfiles || allProfiles.length === 0}
        >
          Clear All
        </Button>
      </div>
      <div class="mb-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onclick={onBackupProfiles}
          disabled={!isConfigured ||
            isSavingRemoteBackup ||
            isSavingSettings ||
            isTestingConnection}
        >
          {#if isSavingRemoteBackup}
            <span class="loading loading-sm loading-spinner"></span>
            Saving...
          {:else}
            Save to gdluxx
          {/if}
        </Button>
        <Button
          variant="secondary"
          onclick={onRestoreProfiles}
          disabled={!isConfigured || isRestoringRemoteBackup || isLoadingRemoteBackup}
        >
          {#if isRestoringRemoteBackup || isLoadingRemoteBackup}
            <span class="loading loading-sm loading-spinner"></span>
            Restoring...
          {:else}
            Restore from gdluxx
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={onRefreshRemoteStatus}
          disabled={!isConfigured || isLoadingRemoteBackup}
        >
          {#if isLoadingRemoteBackup}
            <span class="loading loading-sm loading-spinner"></span>
            Checking...
          {:else}
            Check remote status
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={onDeleteRemoteBackup}
          disabled={!isConfigured || isDeletingRemoteBackup}
        >
          {#if isDeletingRemoteBackup}
            <span class="loading loading-sm loading-spinner"></span>
            Removing...
          {:else}
            Clear remote backup
          {/if}
        </Button>
      </div>
      <div class="mb-3">
        {#if remoteBackupMeta && remoteBackupMeta.hasBackup}
          <Info>
            <p class="text-sm">
              Last backup: {remoteBackupMeta.updatedAt
                ? formatTimestamp(remoteBackupMeta.updatedAt)
                : '—'}
              {#if remoteBackupMeta.syncedBy}
                · Saved by {remoteBackupMeta.syncedBy}
              {/if}
            </p>
            <p class="text-base-content/60 text-xs">
              {remoteBackupMeta.profileCount} profile{remoteBackupMeta.profileCount === 1
                ? ''
                : 's'}
              stored on gdluxx.
            </p>
          </Info>
        {:else if remoteBackupMeta}
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
      <div class="mb-3">
        <label
          class="mx-2 mb-1 block text-sm font-semibold"
          for="import-profiles-json"
        >
          Import JSON
        </label>
        <textarea
          class="textarea-bordered textarea focus:ring-primary/20 focus:textarea-primary h-24 w-full resize-y transition-all focus:ring-2"
          style="resize: vertical; min-height: 6rem;"
          value={importProfilesText}
          oninput={(event) => onImportTextChange((event.target as HTMLTextAreaElement).value)}
          id="import-profiles-json"
          placeholder=""
        ></textarea>
        {#if importProfilesError}
          <p class="text-error mx-2 mt-1 text-xs">{importProfilesError}</p>
        {:else}
          <small class="text-base-content/50 mx-2 mt-1 block text-xs">
            Profiles merge with existing entries. Name field optional.
          </small>
        {/if}
      </div>
    </div>
  </div>

  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Saved selectors</div>
      <div class="mb-3 flex items-center gap-2">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
          placeholder="Search by host, scope, or selector"
          value={profileSearch}
          oninput={(event) => onProfileSearchChange((event.target as HTMLInputElement).value)}
        />
        {#if profileSearch}
          <Button
            variant="ghost"
            onclick={() => onProfileSearchChange('')}
          >
            Clear
          </Button>
        {/if}
      </div>
      {#if filteredProfiles.length === 0}
        <p class="text-base-content/50 text-sm">
          {allProfiles.length === 0 ? 'No saved ranges yet.' : 'No profiles match your search.'}
        </p>
      {:else}
        <div class="space-y-3">
          {#each filteredProfiles as profile (profile.id)}
            <div class="border-base-300 bg-base-200 rounded-sm border p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="text-sm font-semibold">{describeProfile(profile)}</div>
                  <div class="text-base-content/70 text-xs">
                    {profile.scope === 'path'
                      ? `Path • ${profile.host}${profile.path ?? ''}`
                      : profile.scope === 'origin' && profile.origin
                        ? `Origin • ${profile.origin}`
                        : `Host • ${profile.host}`}
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onclick={() => onApplyProfile(profile.id)}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    onclick={() => onDeleteProfile(profile.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div class="text-base-content/70 mt-2 grid gap-1 text-xs">
                <div>
                  Start selector:
                  <code class="bg-base-100 rounded px-1 py-0.5">
                    {profile.startSelector || '—'}
                  </code>
                </div>
                <div>
                  End selector:
                  <code class="bg-base-100 rounded px-1 py-0.5">
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
              <label class="text-base-content/70 mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span>Name</span>
                <input
                  class="input-bordered input input-xs focus:ring-primary/20 focus:input-primary transition-all focus:ring-2"
                  value={profileNameDrafts[profile.id] ?? ''}
                  oninput={(event) =>
                    onProfileDraftChange(profile.id, (event.target as HTMLInputElement).value)}
                  onblur={(event) =>
                    onRenameProfile(profile.id, (event.target as HTMLInputElement).value)}
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
</div>
