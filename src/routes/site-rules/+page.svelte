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
  import type { PageData } from './$types';
  import type { SiteConfig } from '$lib/server/siteConfigManager';

  const { data } = $props<{ data: PageData }>();
  const { categories } = data;

  let configs = $state<SiteConfig[]>(data.configs || []);
  const supportedSites = data.supportedSites || [];
  let showAddModal = $state(false);
  let editingConfig = $state<SiteConfig | null>(null);
  let isRefreshingSites = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  $effect(() => {
    if (error || success) {
      setTimeout(() => {
        error = null;
        success = null;
      }, 5000);
    }
  });

  async function handleSaveConfig(configData: Partial<SiteConfig>) {
    try {
      error = null;
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
          const index = configs.findIndex(c => c.id === editingConfig!.id);
          if (index >= 0) {
            configs[index] = result.data.config;
          }
        } else {
          configs.push(result.data.config);
        }

        configs = [...configs];
        success = editingConfig
          ? 'Configuration updated successfully'
          : 'Configuration created successfully';
        closeModal();
      } else {
        const errorResult = await response.json();
        error = errorResult.error || 'Failed to save configuration';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unexpected error occurred';
    }
  }

  async function handleDeleteConfig(configId: number) {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      error = null;
      const response = await fetch(`/api/site-configs/${configId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        configs = configs.filter(c => c.id !== configId);
        success = 'Configuration deleted successfully';
      } else {
        const errorResult = await response.json();
        error = errorResult.error || 'Failed to delete configuration';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unexpected error occurred';
    }
  }

  async function refreshSupportedSites() {
    isRefreshingSites = true;
    try {
      error = null;
      const response = await fetch('/api/supported-sites', { method: 'POST' });
      if (response.ok) {
        // Reload the page
        window.location.reload();
      } else {
        const errorResult = await response.json();
        error = errorResult.error || 'Failed to refresh sites';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to refresh sites';
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
</script>

<PageLayout title="Site Rules" description="Site rules configuration">
  {#snippet icon()}
    <Icon iconName="settings" size={32} />
  {/snippet}

  <!-- Info messages -->
  {#if error}
    <div
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded"
    >
      <div class="flex items-center">
        <Icon iconName="close" size={20} class="mr-2" />
        {error}
      </div>
    </div>
  {/if}

  {#if success}
    <div
      class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded"
    >
      <div class="flex items-center">
        <Icon iconName="circle" size={20} class="mr-2" />
        {success}
      </div>
    </div>
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
          <h3 class="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
            Configurations
          </h3>
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
        <!-- Categories card -->
        <div
          class="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
            Categories
          </h3>
          <p class="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {categories?.length || 0}
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
              <Button
                onclick={openAddModal}
                variant="primary"
                size="sm"
              >
                <Icon iconName="plus" size={16} class="mr-2" />
                Add Rule
              </Button>
            </div>

            <div class="flex items-center gap-3">
              <Button
                aria-label="1label"
                variant="outline-primary"
                size="sm"
                title="1title"
              >
                <Icon iconName="sort" size={20} />
              </Button>
              <Button
                aria-label="2label"
                variant="outline-primary"
                size="sm"
                title="2title"
              >
                <Icon iconName="date" class="w-5 h-5" />
              </Button>
              <Button
                aria-label="3label"
                variant="outline-primary"
                size="sm"
                title="3title"
              >
                <Icon iconName="download-arrow" class="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

    </div>

    <!-- Config list -->
    <ul class="divide-y divide-secondary-200 dark:divide-secondary-700">
      {#each configs as config}
        <li
          class="flex w-full items-center justify-between p-4"
        >
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
            <Button onclick={() => openEditModal(config)} variant="outline-primary">
              <Icon iconName="settings" size={16} class="mr-1" />
              Edit
            </Button>
            <Button
              onclick={() => config.id && handleDeleteConfig(config.id)}
              variant="outline-danger"
            >
              <Icon iconName="delete" size={16} class="mr-1" />
              Delete
            </Button>
          </div>
        </li>
      {/each}

      {#if configs.length === 0}
        <div class="text-center py-12 text-secondary-500 dark:text-secondary-400">
          <Icon
            iconName="settings"
            size={48}
            class="mx-auto mb-4 text-secondary-400 dark:text-secondary-500"
          />
          <p class="text-lg font-medium">No site configurations yet</p>
          <p class="text-sm">
            Add your first configuration to get started with site-specific CLI options.
          </p>
          <Button onclick={openAddModal} variant="primary" class="mt-4">
            <Icon iconName="plus" size={16} class="mr-2" />
            Add Configuration
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
