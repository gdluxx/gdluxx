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
  import { PageLayout, Button, Modal } from '$lib/components/ui';
  import { SiteConfigForm } from '$lib/components/settings';
  import { Icon } from '$lib/components';
  import { Info } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast.js';
  import type { PageData } from './$types';
  import type { SiteConfig } from '$lib/server/siteConfigManager';

  const { data } = $props<{ data: PageData }>();
  const { categories: _categories } = data;

  let configs = $state<SiteConfig[]>(data.configs || []);
  const supportedSites = data.supportedSites || [];
  let showAddModal = $state(false);
  let editingConfig = $state<SiteConfig | null>(null);
  let isRefreshingSites = $state(false);

  let sortMode = $state<'alphabetical' | 'cli-options' | 'none'>('none');
  let isAlphabeticalAscending = $state(true);
  let isCLIOptionsAscending = $state(false); // Start with descending (highest first)

  async function handleSaveConfig(configData: Partial<SiteConfig>) {
    try {
      const method = editingConfig ? 'PUT' : 'POST';
      const url = editingConfig ? `/api/site-configs/${editingConfig.id}` : '/api/site-configs';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      if (response.ok) {
        const result = await response.json();

        if (editingConfig) {
          const index = configs.findIndex(c => c.id === editingConfig?.id);
          if (index >= 0) {
            configs[index] = result.data.config;
          }
        } else {
          configs.push(result.data.config);
        }

        configs = [...configs];
        toastStore.success(
          'Success',
          editingConfig
            ? 'Configuration updated successfully'
            : 'Configuration created successfully'
        );
        closeModal();
      } else {
        const errorResult = await response.json();
        toastStore.error('Save Failed', errorResult.error ?? 'Failed to save configuration');
      }
    } catch (err) {
      toastStore.error(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    }
  }

  async function handleDeleteConfig(configId: number) {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/site-configs/${configId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        configs = configs.filter(c => c.id !== configId);
        toastStore.success('Success', 'Configuration deleted successfully');
      } else {
        const errorResult = await response.json();
        toastStore.error('Delete Failed', errorResult.error ?? 'Failed to delete configuration');
      }
    } catch (err) {
      toastStore.error(
        'Delete Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    }
  }

  async function refreshSupportedSites() {
    isRefreshingSites = true;
    try {
      const response = await fetch('/api/supported-sites', { method: 'POST' });
      if (response.ok) {
        // Reload the page
        window.location.reload();
      } else {
        const errorResult = await response.json();
        toastStore.error('Refresh Failed', errorResult.error ?? 'Failed to refresh sites');
      }
    } catch (err) {
      toastStore.error(
        'Refresh Failed',
        err instanceof Error ? err.message : 'Failed to refresh sites'
      );
    } finally {
      isRefreshingSites = false;
    }
  }

  function closeModal() {
    showAddModal = false;
    editingConfig = null;
  }

  function openAddModal() {
    editingConfig = null;
    showAddModal = true;
  }

  function openEditModal(config: SiteConfig) {
    editingConfig = config;
    showAddModal = true;
  }

  function sortByAlpha() {
    if (sortMode === 'alphabetical') {
      isAlphabeticalAscending = !isAlphabeticalAscending;
    } else {
      sortMode = 'alphabetical';
      isAlphabeticalAscending = true;
    }

    configs = [...configs].sort((a, b) => {
      const comparison = a.display_name.localeCompare(b.display_name);
      return isAlphabeticalAscending ? comparison : -comparison;
    });
  }

  function sortByCLIOptions() {
    if (sortMode === 'cli-options') {
      isCLIOptionsAscending = !isCLIOptionsAscending;
    } else {
      sortMode = 'cli-options';
      isCLIOptionsAscending = false; // Start with descending (highest first)
    }

    configs = [...configs].sort((a, b) => {
      const cliDiff = isCLIOptionsAscending
        ? a.cli_options.length - b.cli_options.length // Ascending: low to high
        : b.cli_options.length - a.cli_options.length; // Descending: high to low
      if (cliDiff !== 0) {
        return cliDiff;
      }
      return a.display_name.localeCompare(b.display_name);
    });
  }
</script>

<PageLayout title="Site Rules" description="Site rules configuration">
  {#snippet icon()}
    <Icon iconName="site-rules" size={32} />
  {/snippet}

  {#if configs.length === 0}
    <Info variant="info" class="mb-4">
      Use the 'Refresh Sites' button to download the latest list of sites supported by <i
        >gallery-dl</i
      >. Or, you can custom configure the rules as you see fit.
    </Info>
  {/if}

  <div
    class="bg-primary-50 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
  >
    <!-- Header -->
    <div class="cursor-default border-b border-secondary-200 px-4 py-4 dark:border-secondary-700">
      <div class="flex items-center justify-between mb-3">
        <p class="font-semibold text-secondary-900 dark:text-secondary-100">
          Configure site rules using <i>gallery-dl</i>'s CLI options.
        </p>
      </div>

      <!-- Site Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <!-- config count card -->
        <div
          class="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold text-secondary-900 dark:text-secondary-100">Rules</h3>
          <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
            {configs.length}
          </p>
        </div>
        <!-- Supported sites card -->
        <div
          class="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
            Supported Sites
          </h3>
          <p class="text-3xl font-bold text-green-600 dark:text-green-400">
            {supportedSites.length}
          </p>
        </div>
      </div>
      <!-- buttons -->
      <div
        class="bg-white dark:bg-secondary-800/50 rounded-sm border border-secondary-200 dark:border-secondary-700 p-3"
      >
        <div class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <Button
              onclick={refreshSupportedSites}
              disabled={isRefreshingSites}
              variant="outline-primary"
              size="sm"
            >
              {#if isRefreshingSites}
                <Icon iconName="loading" size={16} class="animate-spin mr-2" />
                Refreshing...
              {:else}
                <Icon iconName="magnifying-glass" size={16} class="mr-2" />
                Refresh Sites
              {/if}
            </Button>
            <Button onclick={openAddModal} disabled={isRefreshingSites} variant="primary" size="sm">
              <Icon iconName="plus" size={16} class="mr-2" />
              Add Rule
            </Button>
          </div>

          <div class="flex items-center gap-3">
            <Button
              onclick={sortByAlpha}
              disabled={configs.length === 0}
              aria-label="Sort alphabetically"
              variant={sortMode === 'alphabetical' ? 'primary' : 'outline-primary'}
              size="sm"
              title={`Sort alphabetically ${sortMode === 'alphabetical' && !isAlphabeticalAscending ? '(Z-A)' : '(A-Z)'}`}
            >
              <Icon
                iconName={sortMode === 'alphabetical'
                  ? isAlphabeticalAscending
                    ? 'alpha-asc'
                    : 'alpha-desc'
                  : 'alpha-var'}
                size={24}
              />
            </Button>
            <Button
              onclick={sortByCLIOptions}
              disabled={configs.length === 0}
              aria-label="Sort by CLI options count"
              variant={sortMode === 'cli-options' ? 'primary' : 'outline-primary'}
              size="sm"
              title={`Sort by CLI options count ${sortMode === 'cli-options' && isCLIOptionsAscending ? '(0-9)' : '(9-0)'}`}
            >
              <Icon
                iconName={sortMode === 'cli-options'
                  ? isCLIOptionsAscending
                    ? 'num-asc'
                    : 'num-desc'
                  : 'num-var'}
                size={24}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Config list -->
    <ul class="divide-y divide-secondary-200 dark:divide-secondary-700">
      {#each configs as config (config.id)}
        <li class="flex w-full items-center justify-between p-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-lg font-medium text-secondary-900 dark:text-secondary-100">
                {config.display_name}
              </h3>
              {#if config.is_default}
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20"
                >
                  Default
                </span>
              {/if}
              {#if !config.enabled}
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20"
                >
                  Disabled
                </span>
              {/if}
            </div>
            <p class="text-sm text-secondary-600 dark:text-secondary-400">
              Pattern: <code class="bg-secondary-100 dark:bg-secondary-700 px-1 rounded"
                >{config.site_pattern}</code
              >
            </p>
            <p class="text-sm text-secondary-600 dark:text-secondary-400">
              CLI Options: {config.cli_options.length}
            </p>
          </div>
          <!-- Buttons -->
          <div class="flex gap-2">
            <Button onclick={() => openEditModal(config)} variant="outline-primary" size="sm">
              <Icon iconName="edit" size={20} class="mr-1" />
              Edit
            </Button>
            <Button
              onclick={() => config.id && handleDeleteConfig(config.id)}
              variant="outline-danger"
              size="sm"
            >
              <Icon iconName="delete" size={20} class="mr-1" />
              Delete
            </Button>
          </div>
        </li>
      {/each}

      {#if configs.length === 0}
        <div class="cursor-default text-center py-12 text-secondary-500 dark:text-secondary-400">
          <Icon
            iconName="site-rules"
            size={48}
            class="mx-auto mb-4 text-secondary-400 dark:text-secondary-500"
          />
          <p class="text-lg font-medium">No site rules yet</p>
          <p class="text-sm">Add your first rule to get started with site-specific CLI options.</p>
          <Button onclick={openAddModal} variant="primary" class="mt-4">
            <Icon iconName="plus" size={16} class="mr-2" />
            Add Rule
          </Button>
        </div>
      {/if}
    </ul>
  </div>

  <!-- Modal -->
  <Modal show={showAddModal} onClose={closeModal} size="xl">
    <div class="p-6">
      <h2 class="cursor-default text-xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
        {editingConfig ? 'Edit' : 'Add'} Site Rule
      </h2>
      <SiteConfigForm
        config={editingConfig}
        {supportedSites}
        onSave={handleSaveConfig}
        onCancel={closeModal}
      />
    </div>
  </Modal>
</PageLayout>
