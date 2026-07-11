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
  import {
    versionStore,
    type StoreActionResult,
    type VersionStoreState,
  } from '$lib/version/versionStore';
  import { toastStore } from '$lib/stores/toast';
  import { Button, Info } from '$lib/components/ui';
  import { `formatRelativeTime` } from '$lib/utils/relativeTime';

  onMount(async () => {
    const result: StoreActionResult = await versionStore.loadStatus();

    if (!result.success) {
      toastStore.error('Load Failed', result.message);
    }
  });

  function formatTimestamp(timestamp: number | null): string {
    if (!timestamp) {
      return 'N/A';
    }
    return new Date(timestamp).toLocaleString();
  }

  function formatCheckedRelative(timestamp: number | null): string {
    if (!timestamp) {
      return 'N/A';
    }
    return formatRelativeTime(timestamp);
  }

  let updateAvailable = $state(false);

  let versionState = $state<VersionStoreState>();

  $effect(() => {
    return versionStore.subscribe((state: VersionStoreState) => {
      versionState = state;

      const current = state.current;
      const latest = state.latestAvailable;
      let result = false;

      if (!current && latest) {
        result = true;
      } else if (current && latest) {
        const areVersionsEqual = current === latest;
        result = !areVersionsEqual;
      }
      updateAvailable = result;
    });
  });

  async function handleCheckForUpdates() {
    toastStore.info('Update Check', 'Checking for updates...', 3000, true);

    const result: StoreActionResult = await versionStore.checkForUpdates();

    if (result.message) {
      if (result.success) {
        toastStore.info(
          'Update Check',
          result.message,
          (result.type ?? 'info') === 'info' ? 3000 : 5000,
          false,
        );
      } else {
        toastStore.error('Error', result.message, 5000, false);
      }
    }
  }

  async function handlePerformUpdate() {
    const result: StoreActionResult = await versionStore.performUpdate();
    if (result.message) {
      if (result.success) {
        toastStore.success('Update Process', result.message, result.type === 'info' ? 4000 : 6000);
      } else {
        toastStore.error('Update Error', result.message, 6000);
      }
    }
  }
</script>

{#if versionState?.error && !versionState?.loading && !versionState?.updateInProgress}
  <Info
    variant="warning"
    size="default"
    title="Last Operation Error"
    dismissible
    class="my-4"
  >
    {versionState.error}
  </Info>
{/if}

{#if versionState?.binaryExists === false && !versionState?.loading && !versionState?.updateInProgress}
  <Info
    variant="warning"
    size="default"
    title="Binary Not Found"
    class="my-4"
  >
    The gallery-dl binary is missing from the filesystem. Use "Update gallery-dl" below to download
    and install it.
  </Info>
{/if}

<section class="content-panel space-y-1.5">
  <div class="flex flex-wrap items-baseline gap-x-2">
    <span class="font-medium text-foreground">Current Version:</span>
    <span class="text-foreground">
      {versionState?.current ?? 'Not Installed or Unknown'}
    </span>
  </div>

  <div class="flex flex-wrap items-baseline gap-x-2">
    <span class="font-medium text-foreground">Last Checked:</span>
    <span
      class="text-foreground"
      title={versionState?.lastChecked ? formatTimestamp(versionState.lastChecked) : undefined}
    >
      {formatCheckedRelative(versionState?.lastChecked ?? null)}
    </span>
  </div>

  {#if versionState?.latestAvailable}
    <div class="flex flex-wrap items-baseline gap-x-2">
      <span class="font-medium text-foreground">Latest Available:</span>
      <span class="text-foreground">
        {versionState.latestAvailable}
      </span>
    </div>
  {/if}

  {#if versionState?.source}
    <div class="flex flex-wrap items-baseline gap-x-2">
      <span class="font-medium text-foreground">Source:</span>
      <span class="text-foreground">
        <a
          href={versionState.source.provider === 'codeberg'
            ? `https://codeberg.org/${versionState.source.user}/${versionState.source.repo}`
            : `https://github.com/${versionState.source.user}/${versionState.source.repo}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-link hover:underline"
        >
          {versionState.source.provider === 'codeberg'
            ? 'codeberg.org'
            : 'github.com'}/{versionState.source.user}/{versionState.source.repo}
        </a>
        {#if versionState.source.isArm64}
          <span class="bg-muted ml-2 rounded px-1.5 py-0.5 text-xs text-muted-foreground">
            ARM64
          </span>
        {/if}
      </span>
    </div>
  {/if}
</section>

<section class="m-4 flex flex-col gap-3 sm:flex-row sm:gap-6">
  <Button
    onclick={handleCheckForUpdates}
    disabled={versionState?.loading ?? versionState?.updateInProgress ?? updateAvailable ?? false}
    loading={versionState?.loading ?? versionState?.updateInProgress ?? false}
    class="mt-2 w-full"
    variant="outline-primary"
  >
    {#if versionState?.loading ?? versionState?.updateInProgress}
      <!-- The button loses size if there's no text -->
      <span>Checking for Updates</span>
    {:else}
      Check for Updates
    {/if}
  </Button>

  <Button
    onclick={handlePerformUpdate}
    disabled={!updateAvailable ||
      (versionState?.loading ?? versionState?.updateInProgress ?? false)}
    loading={versionState?.updateInProgress}
    class="mt-2 w-full"
    variant="outline-info"
  >
    {#if versionState?.updateInProgress}
      <!-- The button loses size if there's no text -->
      <span class="text-foreground">Updating gallery-dl</span>
    {:else}
      Update gallery-dl
    {/if}
  </Button>
</section>

{#if updateAvailable}
  <div class="mx-4 mt-8">
    <Info
      variant="info"
      title="Update available!">A newer version is ready to install.</Info
    >
  </div>
{:else if versionState?.current && versionState?.latestAvailable}
  <div class="mx-4 mt-8 flex items-center gap-2 text-sm font-medium text-success">
    <span aria-hidden="true">✓</span>
    <span>You're running the latest version</span>
  </div>
{/if}
