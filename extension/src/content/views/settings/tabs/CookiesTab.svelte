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
  import { onMount } from 'svelte';
  import browser from 'webextension-polyfill';
  import { Button, Info } from '#components/ui';
  import type { Settings } from '#utils/settings';
  import { formatTimestamp } from '#utils/formatters';
  import { toastStore } from '#stores/toast';
  import {
    checkCookiePermission,
    deleteCookieBackup,
    fetchCookieBackup,
    syncCookiesForDomain,
    type CookieBackupPayload,
    type CookiePermissionPayload,
  } from '#utils/messaging';
  import { formatOriginPattern } from '#src/shared/originPattern';
  import {
    cookieSyncBlockedMessage,
    getServerCompat,
    isBlocked,
    SERVER_COMPAT_STORAGE_KEY,
    type ServerCompat,
  } from '#src/shared/serverCompat';

  interface Props {
    settings: Settings;
    isConfigured: boolean;
  }

  const { settings, isConfigured }: Props = $props();

  let backupMeta = $state<CookieBackupPayload | null>(null);
  let metaLoading = $state(false);
  let syncing = $state(false);
  let domainDeleteBusyDomain = $state<string | null>(null);
  let clearAllBusy = $state(false);
  let permission = $state<CookiePermissionPayload | null>(null);
  let serverCompat = $state<ServerCompat | null>(null);

  const currentDomain = $derived(typeof window !== 'undefined' ? window.location.hostname : '');
  const currentOriginPattern = $derived(
    typeof window !== 'undefined' ? formatOriginPattern(window.location.href) : null,
  );
  const permissionBlocked = $derived(permission !== null && !permission.granted);
  const capabilityBlocked = $derived(isBlocked(serverCompat, 'cookies.sync'));
  const capabilityBlockedMessage = $derived(cookieSyncBlockedMessage(serverCompat));
  const domains = $derived(backupMeta?.domains ?? []);
  const currentDomainSynced = $derived(
    domains.find((entry) => entry.domain === currentDomain) ?? null,
  );

  function pluralize(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }
  function formatExpiry(value: number | null): string {
    if (value === null) return 'No upcoming expiry';
    return new Date(value * 1000).toLocaleString();
  }

  async function refreshBackupMeta(showToast = false): Promise<void> {
    if (!isConfigured) {
      backupMeta = null;
      return;
    }
    metaLoading = true;
    try {
      const res = await fetchCookieBackup(settings.serverUrl, settings.apiKey);
      if (res.success && res.data) {
        backupMeta = res.data;
        if (showToast && res.message) toastStore.info(res.message);
      } else {
        backupMeta = null;
        if (showToast) toastStore.error(res.error ?? 'Failed to load synced cookies');
      }
    } finally {
      metaLoading = false;
    }
  }

  async function refreshPermission(): Promise<void> {
    if (!currentOriginPattern) {
      permission = { granted: false, reason: 'origin' };
      return;
    }
    const res = await checkCookiePermission(currentOriginPattern);
    permission = res.success && res.data ? res.data : null;
  }
  async function refreshServerCompat(): Promise<void> {
    try {
      serverCompat = await getServerCompat();
    } catch (error) {
      console.error('Failed to load server compatibility record', error);
    }
  }

  async function handleSync(): Promise<void> {
    if (syncing) return;
    if (!isConfigured) {
      toastStore.error('Configure your gdluxx server URL and API key first.');
      return;
    }
    if (capabilityBlocked) {
      toastStore.error(capabilityBlockedMessage);
      return;
    }
    if (!currentDomain || !currentOriginPattern) {
      toastStore.error("Unable to determine this site's address.");
      return;
    }
    syncing = true;
    try {
      const res = await syncCookiesForDomain(
        settings.serverUrl,
        settings.apiKey,
        currentDomain,
        currentOriginPattern,
      );
      if (res.success && res.data) {
        backupMeta = res.data;
        permission = { granted: true };
        toastStore.success(res.message ?? `Synced cookies for ${currentDomain}.`);
      } else {
        toastStore.error(res.error ?? 'Failed to sync cookies.');
        // A failure may well be a revoked grant, re-read so the hint appears.
        await refreshPermission();
      }
    } finally {
      syncing = false;
    }
  }

  async function handleDeleteDomain(domain: string): Promise<void> {
    if (domainDeleteBusyDomain) return;
    if (!confirm(`Remove synced cookies for ${domain}?`)) return;
    domainDeleteBusyDomain = domain;
    try {
      const res = await deleteCookieBackup(settings.serverUrl, settings.apiKey, domain);
      if (res.success && res.data) {
        if (res.data.deleted) {
          toastStore.success(res.message ?? `Removed cookies for ${domain}.`);
          await refreshBackupMeta();
        } else {
          toastStore.info('No synced cookies to delete for this domain.');
        }
      } else {
        toastStore.error(res.error ?? 'Failed to delete cookies.');
      }
    } finally {
      domainDeleteBusyDomain = null;
    }
  }

  async function handleClearAll(): Promise<void> {
    if (clearAllBusy) return;
    if (!confirm('Remove all synced cookies from gdluxx?')) return;
    clearAllBusy = true;
    try {
      const res = await deleteCookieBackup(settings.serverUrl, settings.apiKey);
      if (res.success && res.data) {
        if (res.data.deleted) {
          backupMeta = null;
          toastStore.success('Removed all synced cookies.');
        } else {
          toastStore.info('No synced cookies to delete.');
        }
      } else {
        toastStore.error(res.error ?? 'Failed to delete cookies.');
      }
    } finally {
      clearAllBusy = false;
    }
  }

  onMount(() => {
    refreshPermission();
    void refreshServerCompat();
    if (isConfigured) {
      refreshBackupMeta();
    }

    const handleStorageChange: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== 'local') return;
      if (SERVER_COMPAT_STORAGE_KEY in changes) {
        void refreshServerCompat();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  });
</script>

<div class="mx-2 my-4 max-w-[640px]">
  <!-- Sync current site -->
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Sync cookies</div>
      <p class="text-base-content/70 text-sm">
        Capture cookies for the current site and sync them to gdluxx so gallery-dl jobs for this
        domain can use your authenticated session. Cookie values are never shown here or read back
        from the server — gdluxx stores them write-only.
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onclick={handleSync}
          disabled={!isConfigured ||
            syncing ||
            !currentDomain ||
            permissionBlocked ||
            capabilityBlocked}
        >
          {#if syncing}
            <span class="loading loading-sm loading-spinner"></span>
            Syncing...
          {:else}
            Sync cookies for {currentDomain || 'current site'}
          {/if}
        </Button>
        <Button
          variant="ghost"
          onclick={() => refreshBackupMeta(true)}
          disabled={!isConfigured || metaLoading}
        >
          {#if metaLoading}
            <span class="loading loading-sm loading-spinner"></span>
            Checking...
          {:else}
            Refresh
          {/if}
        </Button>
      </div>

      <div class="mt-3">
        {#if !isConfigured}
          <Info soft>Configure your gdluxx connection to enable cookie syncing.</Info>
        {:else if capabilityBlocked}
          <Info soft>{capabilityBlockedMessage}</Info>
        {:else if permissionBlocked}
          <Info soft>
            {#if permission?.reason === 'cookies'}
              Cookie access isn't enabled yet. Open the gdluxx popup and choose
              <strong>Enable cookie sync</strong>, then reopen this tab.
            {:else if permission?.reason === 'origin'}
              gdluxx doesn't have permission for {currentDomain || 'this site'}. Enable it from the
              gdluxx popup, then reopen this tab.
            {:else}
              Could not verify cookie permissions{permission?.detail
                ? `: ${permission.detail}`
                : ''}.
            {/if}
          </Info>
        {:else if currentDomainSynced}
          <Info>
            <p class="text-sm">
              {currentDomain}: {pluralize(currentDomainSynced.cookieCount, 'cookie')} synced
              {#if currentDomainSynced.expiredCount > 0}
                ({pluralize(currentDomainSynced.expiredCount, 'expired cookie')})
              {/if}
              · last synced {formatTimestamp(currentDomainSynced.updatedAt)}
              {#if currentDomainSynced.syncedBy}
                · by {currentDomainSynced.syncedBy}
              {/if}
            </p>
          </Info>
        {:else}
          <Info soft>No cookies synced yet for {currentDomain || 'this site'}.</Info>
        {/if}
      </div>
    </div>
  </div>

  <!-- Synced domains -->
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-between gap-2">
        <div class="card-title">Synced domains ({domains.length})</div>
        {#if domains.length > 0}
          <Button
            variant="ghost"
            onclick={handleClearAll}
            disabled={clearAllBusy}
          >
            {clearAllBusy ? 'Clearing...' : 'Clear all'}
          </Button>
        {/if}
      </div>

      {#if domains.length === 0}
        <p class="text-base-content/50 text-sm">
          No cookies have been synced from this browser yet.
        </p>
      {:else}
        <div class="space-y-3">
          {#each domains as entry (entry.domain)}
            <div class="border-base-300 bg-base-200 rounded-sm border p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="text-sm font-semibold">{entry.domain}</div>
                  <div class="text-base-content/70 text-xs">
                    {pluralize(entry.cookieCount, 'cookie')}
                    {#if entry.expiredCount > 0}
                      · {pluralize(entry.expiredCount, 'expired')}
                    {/if}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onclick={() => handleDeleteDomain(entry.domain)}
                  disabled={domainDeleteBusyDomain === entry.domain}
                >
                  {domainDeleteBusyDomain === entry.domain ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
              <div class="text-base-content/70 mt-2 grid gap-1 text-xs">
                <div>Earliest expiry: {formatExpiry(entry.earliestExpiry)}</div>
                <div>
                  Updated: {formatTimestamp(entry.updatedAt)}
                  {#if entry.syncedBy}
                    · Synced by {entry.syncedBy}
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
