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
  import {
    PageLayout,
    Button,
    Chip,
    Modal,
    ConfirmModal,
    Toggle,
    Spinner,
    EmptyState,
  } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import { SiteRules } from '$lib/components/site-rules';
  import { Info } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData } from './$types';
  import type { SiteConfig, SupportedSite } from '$lib/server/siteConfigManager';

  const { data } = $props<{ data: PageData }>();
  const _categories = $derived(data.categories);

  let configs = $state<SiteConfig[]>([]);
  let supportedSites = $state<typeof data.supportedSites>([]);
  let showAddModal = $state(false);
  let editingConfig = $state<SiteConfig | null>(null);
  let isRefreshingSites = $state(false);
  let showDeleteConfirm = $state(false);
  let configToDelete = $state<SiteConfig | null>(null);

  let sortMode = $state<'alphabetical' | 'cli-options' | 'none'>('none');
  let isAlphabeticalAscending = $state(true);
  let isCLIOptionsAscending = $state(false);

  let showSupportedSitesModal = $state(false);
  let supportedSitesSearch = $state('');

  $effect(() => {
    configs = data.configs || [];
    supportedSites = data.supportedSites || [];
  });

  const alphaSortLabel = $derived(
    sortMode === 'alphabetical' && !isAlphabeticalAscending ? 'Z–A' : 'A–Z',
  );

  const cliSortActive = $derived(sortMode === 'cli-options');
  const cliSortDirectionLabel = $derived(cliSortActive ? (isCLIOptionsAscending ? '↑' : '↓') : '');
  const cliSortTitle = $derived(
    `Sort by CLI options count ${cliSortActive && isCLIOptionsAscending ? '(low to high)' : '(high to low)'}`,
  );

  const filteredSupportedSites = $derived.by(() => {
    const query = supportedSitesSearch.trim().toLowerCase();
    if (!query) {
      return supportedSites;
    }
    return supportedSites.filter((site: SupportedSite) => {
      return (
        site.name.toLowerCase().includes(query) ||
        site.url.toLowerCase().includes(query) ||
        (site.category ?? '').toLowerCase().includes(query)
      );
    });
  });

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

  function openSupportedSitesModal() {
    showSupportedSitesModal = true;
  }

  function closeSupportedSitesModal() {
    showSupportedSitesModal = false;
    supportedSitesSearch = '';
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
  description="Automatically apply CLI options to URLs matching a site pattern"
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

  <div class="cursor-default">
    <!-- Header -->
    <div class="data-list-header">
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-semibold text-accent-foreground">
          Configure Site rules using <i>gallery-dl</i>'s CLI options.
        </p>
      </div>

      <!-- Site Stats -->
      <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <!-- config count card -->
        <div class="data-list-stats flex items-center justify-between gap-2 p-3">
          <h3 class="text-sm font-medium text-muted-foreground">Rules</h3>
          <p class="text-xl font-bold text-success">
            {configs.length}
          </p>
        </div>
        <!-- Supported sites card -->
        <button
          type="button"
          onclick={openSupportedSitesModal}
          class="data-list-stats flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-haspopup="dialog"
          title="View and search supported sites"
        >
          <h3 class="text-sm font-medium text-muted-foreground">Supported Sites</h3>
          <p class="text-xl font-bold text-success">
            {supportedSites.length}
          </p>
        </button>
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
                <Spinner
                  size={16}
                  class="mr-2"
                />
                Refreshing...
              {:else}
                <Icon
                  iconName="reload"
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

          <div class="flex items-center gap-2">
            <Button
              onclick={sortByAlpha}
              disabled={configs.length === 0}
              aria-label={`Sort alphabetically (${alphaSortLabel})`}
              variant={sortMode === 'alphabetical' ? 'primary' : 'outline-primary'}
              size="sm"
              title={`Sort alphabetically (${alphaSortLabel})`}
            >
              <Icon
                iconName={sortMode === 'alphabetical'
                  ? isAlphabeticalAscending
                    ? 'alpha-asc'
                    : 'alpha-desc'
                  : 'alpha-var'}
                size={18}
                class="mr-1.5"
              />
              <span class="text-xs font-semibold">{alphaSortLabel}</span>
            </Button>
            <Button
              onclick={sortByCLIOptions}
              disabled={configs.length === 0}
              aria-label={cliSortTitle}
              variant={sortMode === 'cli-options' ? 'primary' : 'outline-primary'}
              size="sm"
              title={cliSortTitle}
            >
              <Icon
                iconName={sortMode === 'cli-options'
                  ? isCLIOptionsAscending
                    ? 'num-asc'
                    : 'num-desc'
                  : 'num-var'}
                size={18}
                class="mr-1.5"
              />
              <span class="text-xs font-semibold"
                >Options{cliSortDirectionLabel ? ` ${cliSortDirectionLabel}` : ''}</span
              >
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Config list -->
    <div>
      {#each configs as config, index (config.id)}
        <div
          class="flex items-center justify-between gap-4 px-2 py-3 transition-colors hover:bg-surface-hover"
          class:border-b-strong={index < configs.length - 1}
        >
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
        <EmptyState
          icon="site-rules"
          title="No site rules yet"
          description="Add your first rule to get started with site-specific CLI options."
          class="py-12"
        >
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
        </EmptyState>
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

  <!-- Supported Sites search modal -->
  <Modal
    show={showSupportedSitesModal}
    onClose={closeSupportedSitesModal}
    size="lg"
  >
    <div class="content-panel">
      <h2 class="mb-4 cursor-default text-xl font-bold text-primary">Supported Sites</h2>
      <input
        type="text"
        bind:value={supportedSitesSearch}
        placeholder="Search by name, URL, or category..."
        aria-label="Search supported sites"
        class="form-input mb-3"
      />
      <p class="mb-2 cursor-default text-sm text-muted-foreground">
        Showing {filteredSupportedSites.length} of {supportedSites.length} sites
      </p>
      <div class="max-h-96 overflow-y-auto pr-1">
        {#each filteredSupportedSites as site, index (site.id ?? site.url)}
          <div
            class="px-1 py-2 hover:bg-surface-hover"
            class:border-b-strong={index < filteredSupportedSites.length - 1}
          >
            <p class="text-sm font-medium text-foreground">{site.name}</p>
            <p class="text-xs text-muted-foreground">
              {site.url}
              {#if site.category}
                <span
                  class="ml-2 inline-flex items-center rounded-full bg-surface-selected px-2 py-0.5 text-info"
                >
                  {site.category}
                </span>
              {/if}
            </p>
          </div>
        {/each}
        {#if filteredSupportedSites.length === 0}
          <p class="cursor-default py-8 text-center text-sm text-muted-foreground">
            No supported sites match your search.
          </p>
        {/if}
      </div>
    </div>
  </Modal>
</PageLayout>
