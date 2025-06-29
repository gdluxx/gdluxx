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
  import { versionStore, type StoreActionResult, type VersionStoreState } from '$lib/stores/version';
  import { toastStore } from '$lib/stores/toast';
  import { logger } from '$lib/shared/logger';
  import { Button, Info } from '$lib/components/ui';

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

  let updateAvailable = $state(false);

  let versionState = $state<VersionStoreState>();

  $effect(() => {
    return versionStore.subscribe(state => {
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
      logger.info(`[EFFECT DEBUG] Manually set updateAvailable (state): ${updateAvailable}`);
    });
  });

  async function handleCheckForUpdates() {
    const startTime = Date.now();
    const minWaitTime = 3000;

    const spinnerHtml = `
			<div class="flex items-center gap-2">
				<div class="h-4 w-4 bg-current animate-spin"
				 style="mask: url('/icons/loading-two-tone-loop.svg') no-repeat center; mask-size: contain;"
        >
        </div>
				<span>Checking for updates...</span>
			</div>
		`;

    const checkingToastId = toastStore.info('Update Check', spinnerHtml, 15000, true);

    const result: StoreActionResult = await versionStore.checkForUpdates();

    const elapsedTime = Date.now() - startTime;
    const remainingWaitTime = Math.max(0, minWaitTime - elapsedTime);

    if (remainingWaitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingWaitTime));
    }

    toastStore.removeToast(checkingToastId);

    if (result.message) {
      if (result.success) {
        toastStore.info(
          'Update Check',
          result.message,
          (result.type ?? 'info') === 'info' ? 3000 : 5000,
          false
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

  $effect(() => {
    if (!versionState) {
      return;
    }

    const current = versionState.current;
    const latest = versionState.latestAvailable;

    logger.info(`[EFFECT DEBUG] RAW current: >${current}< (Type: ${typeof current})`);
    logger.info(`[EFFECT DEBUG] RAW latest: >${latest}< (Type: ${typeof latest})`);

    if (current !== null && current !== undefined && latest !== null && latest !== undefined) {
      const areDifferent = current !== latest;
      logger.info(`[EFFECT DEBUG] Comparison (current !== latest): ${areDifferent}`);
    }
    logger.info(`[EFFECT DEBUG] Derived updateAvailable value: ${updateAvailable}`);
  });
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

<div
  class="cursor-default bg-primary-50 dark:border-primary-400 p-4 rounded-sm border border-primary-600 dark:bg-primary-800"
>
  <div class="flex justify-between">
    <span class="font-medium text-secondary-700 dark:text-secondary-300">Current Version:</span>
    <span class="text-secondary-900 dark:text-secondary-100">
      {versionState?.current ?? 'Not Installed or Unknown'}
    </span>
  </div>

  <div class="flex justify-between">
    <span class="font-medium text-secondary-700 dark:text-secondary-300">Last Checked:</span>
    <span class="text-secondary-900 dark:text-secondary-100">
      {formatTimestamp(versionState?.lastChecked ?? null)}
    </span>
  </div>

  {#if versionState?.latestAvailable}
    <div class="flex justify-between">
      <span class="font-medium text-secondary-700 dark:text-secondary-300">Latest Available:</span>
      <span class="text-secondary-900 dark:text-secondary-100">
        {versionState.latestAvailable}
      </span>
    </div>
  {/if}
</div>

<div class="flex flex-col sm:flex-row m-4 gap-3 sm:gap-6">
  <Button
    onclick={handleCheckForUpdates}
    disabled={versionState?.loading ?? versionState?.updateInProgress ?? updateAvailable ?? false}
    loading={versionState?.loading ?? versionState?.updateInProgress ?? false}
    class="mt-2 w-full"
    variant="primary"
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
    variant="secondary"
  >
    {#if versionState?.updateInProgress}
      <!-- The button loses size if there's no text -->
      <span>Updating gallery-dl</span>
    {:else}
      Update gallery-dl
    {/if}
  </Button>
</div>

{#if updateAvailable}
  <div class="mt-8 mx-4">
    <Info variant="info" title="Update available!">A newer version is ready to install.</Info>
  </div>
{/if}
