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
  import { PageLayout, Button, Chip, Modal, ConfirmModal, Toggle } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import { SiteRules } from '$lib/components/site-rules';
  import { Info } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast.js';
  import type { PageData } from './$types';
  import type { SiteConfig } from '$lib/server/siteConfigManager';

  const { data } = $props<{ data: PageData }>();
  const { categories: _categories } = data;

  let configs = $state<SiteConfig[]>(data.configs || []);
  let supportedSites = $state(data.supportedSites || []);
  let showAddModal = $state(false);
  let editingConfig = $state<SiteConfig | null>(null);
  let isRefreshingSites = $state(false);
  let showDeleteConfirm = $state(false);
  let configToDelete = $state<SiteConfig | null>(null);

  let sortMode = $state<'alphabetical' | 'cli-options' | 'none'>('none');
  let isAlphabeticalAscending = $state(true);
  let isCLIOptionsAscending = $state(false);

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
          const index = configs.findIndex((c) => c.id === editingConfig?.id);
          if (index >= 0) {
            configs[index] = result.data.config;
          }
        } else {
          configs.push(result.data.config);
        }

        configs = [...configs];
        toastStore.success(
          'Success',
          editingConfig ? 'Site rule updated successfully' : 'Site rule created successfully',
        );
        closeModal();
      } else {
        const errorResult = await response.json();
        toastStore.error('Save Failed', errorResult.error ?? 'Failed to save site rule');
      }
    } catch (err) {
      toastStore.error(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    }
  }

  function openDeleteConfirm(config: SiteConfig) {
    configToDelete = config;
    showDeleteConfirm = true;
  }

  async function confirmDelete() {
    if (!configToDelete?.id) {
      return;
    }

    try {
      const response = await fetch(`/api/site-configs/${configToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        configs = configs.filter((c) => c.id !== configToDelete?.id);
        toastStore.success('Success', 'Site rule deleted successfully');
      } else {
        const errorResult = await response.json();
        toastStore.error('Delete Failed', errorResult.error ?? 'Failed to delete site rule');
      }
    } catch (err) {
      toastStore.error(
        'Delete Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    } finally {
      cancelDelete();
    }
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    configToDelete = null;
  }

  async function handleToggleEnabled(config: SiteConfig) {
    if (!config.id) {
      return;
    }

    try {
      const response = await fetch(`/api/site-configs/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled }),
      });

      if (response.ok) {
        const result = await response.json();
        const index = configs.findIndex((c) => c.id === config.id);
        if (index >= 0) {
          configs[index] = result.data.config;
        }
        configs = [...configs];
        toastStore.success(
          'Success',
          `Site rule ${config.enabled ? 'disabled' : 'enabled'} successfully`,
        );
      } else {
        const errorResult = await response.json();
        toastStore.error('Update Failed', errorResult.error ?? 'Failed to update site rule');
      }
    } catch (err) {
      toastStore.error(
        'Update Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred',
      );
    }
  }

  async function refreshSupportedSites() {
    isRefreshingSites = true;
    try {
      // Step 1: Refresh the site data
      const response = await fetch('/api/supported-sites', { method: 'POST' });
      if (response.ok) {
        // Step 2: Fetch the fresh data
        const freshDataResponse = await fetch('/api/supported-sites', { method: 'GET' });
        if (freshDataResponse.ok) {
          const freshData = await freshDataResponse.json();

          // Step 3: Update reactive variables with fresh data
          supportedSites = freshData.data.sites ?? [];

          // Also update any other data that might have changed
          // configs would stay the same since we only refreshed supported sites

          toastStore.success(
            'Success',
            `Sites refreshed successfully. Found ${supportedSites.length} supported sites.`,
          );
        } else {
          throw new Error('Failed to fetch fresh data');
        }
      } else {
        const errorResult = await response.json();
        toastStore.error('Refresh Failed', errorResult.error ?? 'Failed to refresh sites');
      }
    } catch (err) {
      toastStore.error(
        'Refresh Failed',
        err instanceof Error ? err.message : 'Failed to refresh sites',
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
      isCLIOptionsAscending = false;
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

<PageLayout
  title="Site Rules"
  description="Site rules configuration"
>
  {#snippet icon()}
    <Icon
      iconName="site-rules"
      size={32}
    />
  {/snippet}

  {#if supportedSites.length === 0}
    <Info
      variant="info"
      class="mb-4"
    >
      Use the 'Refresh Sites' button to download the latest list of sites supported by <i
        >gallery-dl</i
      >. Or, you can custom configure the rules as you see fit.
    </Info>
  {/if}

  <div class="data-list">
    <!-- Header -->
    <div class="data-list-header">
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-semibold text-accent-foreground">
          Configure Site rules using <i>gallery-dl</i>'s CLI options.
        </p>
      </div>

      <!-- Site Stats -->
      <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <!-- config count card -->
        <div class="data-list-stats">
          <h3 class="text-lg font-semibold text-primary">Rules</h3>
          <p class="text-3xl font-bold text-success">
            {configs.length}
          </p>
        </div>
        <!-- Supported sites card -->
        <div class="data-list-stats">
          <h3 class="text-lg font-semibold text-primary">Supported Sites</h3>
          <p class="text-3xl font-bold text-success">
            {supportedSites.length}
          </p>
        </div>
      </div>
      <!-- buttons -->
      <div class="data-list-controls">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <Button
              onclick={refreshSupportedSites}
              disabled={isRefreshingSites}
              variant="outline-primary"
              size="sm"
            >
              {#if isRefreshingSites}
                <Icon
                  iconName="loading"
                  size={16}
                  class="mr-2 animate-spin"
                />
                Refreshing...
              {:else}
                <Icon
                  iconName="magnifying-glass"
                  size={16}
                  class="mr-2"
                />
                Refresh Sites
              {/if}
            </Button>
            <Button
              onclick={openAddModal}
              disabled={isRefreshingSites}
              variant="primary"
              size="sm"
            >
              <Icon
                iconName="plus"
                size={16}
                class="mr-2"
              />
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
    <div>
      {#each configs as config (config.id)}
        <div class="data-list-item flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center">
              <h3 class="pr-2 text-lg font-medium text-primary">
                {config.display_name}
              </h3>
              {#if config.is_default}
                <span
                  class="inline-flex items-center rounded-full bg-surface-selected px-2.5 py-0.5 text-xs font-medium text-info"
                >
                  Default
                </span>
              {/if}
              {#if !config.enabled}
                <Chip
                  variant="warning"
                  label="Disabled"
                  size="sm"
                  dismissible={false}
                />
              {/if}
            </div>
            <p class="text-sm text-muted-foreground">
              Pattern: <code
                class="rounded-sm bg-surface-selected px-1 py-0.5 text-muted-foreground"
                >{config.site_pattern}</code
              >
            </p>
            <p class="text-sm text-muted-foreground">
              CLI Options: {config.cli_options.length}
            </p>
          </div>
          <!-- Buttons -->
          <div class="flex items-center gap-3">
            <!-- Enable/Disable  -->
            <Toggle
              variant="primary"
              size="sm"
              id="toggle-{config.id}"
              checked={config.enabled}
              onchange={() => handleToggleEnabled(config)}
            ></Toggle>

            <div class="flex gap-2">
              <Button
                onclick={() => openEditModal(config)}
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
                onclick={() => openDeleteConfirm(config)}
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
        </div>
      {/each}

      {#if configs.length === 0}
        <div class="text-muted cursor-default py-12 text-center text-foreground">
          <Icon
            iconName="site-rules"
            size={48}
            class="text-muted mx-auto mb-4 text-accent-foreground"
          />
          <p class="text-lg font-medium">No site rules yet</p>
          <p class="text-sm">Add your first rule to get started with site-specific CLI options.</p>
          <Button
            onclick={openAddModal}
            variant="primary"
            class="mt-4"
          >
            <Icon
              iconName="plus"
              size={16}
              class="mr-2"
            />
            Add Rule
          </Button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Add/Edit Modal -->
  <Modal
    show={showAddModal}
    onClose={closeModal}
    size="xl"
  >
    <div class="content-panel">
      <h2 class="mb-4 cursor-default text-xl font-bold text-primary">
        {editingConfig ? 'Edit' : 'Add'} Site Rule
      </h2>
      <SiteRules
        config={editingConfig}
        {supportedSites}
        onSave={handleSaveConfig}
        onCancel={closeModal}
      />
    </div>
  </Modal>

  <!-- Delete modal -->
  <ConfirmModal
    show={showDeleteConfirm}
    title="Delete Site Rule?"
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
  >
    {#if configToDelete}
      <p class="mb-4 leading-relaxed text-foreground">
        Are you sure you want to delete the site rule for
        <strong>{configToDelete.display_name}</strong>?
      </p>
      <p class="mb-4 text-sm text-accent-foreground">
        Pattern:
        <code class="rounded bg-surface-elevated px-1">
          {configToDelete.site_pattern}
        </code>
      </p>
      <Info variant="warning">This action cannot be undone.</Info>
    {/if}
  </ConfirmModal>
</PageLayout>
