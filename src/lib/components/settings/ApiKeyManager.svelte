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
  import { enhance } from '$app/forms';
  import { clientLogger as logger } from '$lib/client/logger';
  import { Button, Info, ConfirmModal, Toggle, EmptyState, Chip, Field } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import { API_KEY_VALIDATION, validateApiKeyInput, type ApiKey } from '$lib/apikey';
  import { formatRelativeTime } from '$lib/utils/relativeTime';
  import {
    type ApiKeyCreateSuccessResult,
    type ApiKeyDeleteSuccessResult,
    type FormFailureResult,
    isApiKeyCreateSuccess,
    isApiKeyDeleteSuccess,
    isFormFailure,
  } from '$lib/types/form-results';

  interface InitialData {
    success: boolean;
    apiKeys?: ApiKey[];
    error?: string;
  }

  const { initialData }: { initialData: InitialData } = $props();

  const DEFAULT_EXPIRY_DAYS = 90;

  type SortKey = 'createdAt' | 'lastUsedAt';
  type SortDir = 'asc' | 'desc';
  type ExpirationVariant = 'danger' | 'warning' | 'outline-info' | 'outline-primary';

  let apiKeys = $state<ApiKey[]>([]);
  let newKeyName = $state('');
  let expirationDate = $state('');
  let neverExpires = $state(false);
  let creating = $state(false);
  let deleting = $state(false);
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let justCreatedKey = $state<{ key: string; name: string } | null>(null);
  let keyToDelete = $state<string | null>(null);
  let searchQuery = $state('');
  let sortKey = $state<SortKey>('createdAt');
  let sortDir = $state<SortDir>('desc');
  const clipboard = navigator.clipboard;

  $effect(() => {
    apiKeys = initialData.success ? (initialData.apiKeys ?? []) : [];
    error = initialData.success ? null : (initialData.error ?? null);
  });

  const searchedKeys = $derived(
    apiKeys.filter((key) => key.name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
  );

  const sortedKeys = $derived(
    [...searchedKeys].sort((a, b) => {
      const aValue = sortKey === 'createdAt' ? a.createdAt : a.lastUsedAt;
      const bValue = sortKey === 'createdAt' ? b.createdAt : b.lastUsedAt;
      const aTime = aValue ? new Date(aValue).getTime() : Number.NEGATIVE_INFINITY;
      const bTime = bValue ? new Date(bValue).getTime() : Number.NEGATIVE_INFINITY;
      if (aTime === bTime) {
        return 0;
      }
      return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
    }),
  );

  // Local-time (not UTC) "YYYY-MM-DDTHH:mm" formatter
  function toLocalDatetimeInputValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }

  function computeDefaultExpiresAt(): string {
    const msPerDay = 24 * 60 * 60 * 1000;
    return toLocalDatetimeInputValue(new Date(Date.now() + DEFAULT_EXPIRY_DAYS * msPerDay));
  }

  function computeMinExpiresAt(): string {
    return toLocalDatetimeInputValue(new Date(Date.now() + 60000));
  }

  function resetCreateForm(): void {
    newKeyName = '';
    neverExpires = false;
    expirationDate = computeDefaultExpiresAt();
  }

  resetCreateForm();

  function isExpired(expiresAt: string | null | undefined): boolean {
    if (!expiresAt) {
      return false;
    }
    return new Date(expiresAt) <= new Date();
  }

  function getExpirationChip(expiresAt: string | null | undefined): {
    label: string;
    variant: ExpirationVariant;
  } {
    if (!expiresAt) {
      return { label: 'Never expires', variant: 'outline-info' };
    }

    const expDate = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Expired', variant: 'danger' };
    } else if (diffDays <= 7) {
      return {
        label: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
        variant: 'warning',
      };
    } else {
      return { label: `Expires ${expDate.toLocaleDateString()}`, variant: 'outline-primary' };
    }
  }

  function formatLastUsed(lastUsedAt: string | null): string {
    return lastUsedAt ? formatRelativeTime(lastUsedAt) : 'Never used';
  }

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'desc';
    }
  }

  function ariaSortFor(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) {
      return 'none';
    }
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }

  function sortLabelFor(key: SortKey): string {
    if (sortKey !== key) {
      return 'not sorted';
    }
    return sortDir === 'asc' ? 'ascending' : 'descending';
  }

  function clearSearch(): void {
    searchQuery = '';
  }

  function handleDismiss(): void {
    resetCreateForm();
  }

  function validateInput(): string | null {
    return validateApiKeyInput(
      newKeyName,
      !neverExpires && expirationDate ? expirationDate : undefined,
    );
  }

  async function copyApiKey(key: string, keyName: string) {
    try {
      await navigator.clipboard.writeText(key);
      copyFeedback = `API key "${keyName}" copied to clipboard`;
      setTimeout(() => {
        copyFeedback = null;
      }, 3000);
    } catch (err) {
      logger.error('Failed to copy API key:', err);
      error = 'Failed to copy API key to clipboard';
    }
  }

  function dismissNewKey() {
    justCreatedKey = null;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const target = event.currentTarget as HTMLElement;
      const form = target?.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  }

  function confirmDelete(keyId: string) {
    keyToDelete = keyId;
  }

  function cancelDelete() {
    keyToDelete = null;
  }

  async function handleConfirmDelete() {
    if (keyToDelete) {
      const deleteForm = document.getElementById('delete-form') as HTMLFormElement;
      if (deleteForm) {
        deleteForm.requestSubmit();
      }
      keyToDelete = null;
    }
  }
</script>

<!-- API key info box -->
{#if justCreatedKey}
  {@const createdKey = justCreatedKey}
  <Info
    variant="warning"
    title="API Key Created Successfully!"
    dismissible
    onDismiss={dismissNewKey}
    class="my-8"
  >
    {#snippet icon()}
      <Icon
        iconName="success"
        size={20}
      />
    {/snippet}
    <strong>Important:</strong> This is the only time you'll be able to see your API key. Make sure
    to copy it now and store it securely.

    <div class="my-4 rounded-surface bg-success/10 p-3">
      <div class="flex items-center justify-between">
        <code class="mr-4 flex-1 font-mono text-lg break-all text-foreground">
          {createdKey.key}
        </code>
        {#if clipboard !== undefined}
          <button
            onclick={() => copyApiKey(createdKey.key, createdKey.name)}
            class="cursor-pointer rounded-control p-2 text-success transition-colors"
            aria-label={`Copy API key for ${createdKey.name} to clipboard`}
          >
            <Icon
              iconName="copy-clipboard"
              size={20}
            />
          </button>
        {/if}
      </div>
    </div>
    <p class="text-sm text-success">
      Key name: <strong>{createdKey.name}</strong>
    </p>
  </Info>
{/if}

{#if copyFeedback}
  <Info
    variant="success"
    size="sm"
    class="my-8"
  >
    {copyFeedback}
  </Info>
{/if}

{#if error}
  <Info
    variant="warning"
    title="Error"
    dismissible
    onDismiss={handleDismiss}
    class="my-8"
  >
    <div class="whitespace-pre-line">
      {error}
    </div>
  </Info>
{/if}

<section class="data-list">
  <header class="data-list-header">
    <h2>
      Your API Keys ({apiKeys.length})
    </h2>
    <!-- Create API key -->
    <form
      method="POST"
      action="?/create"
      use:enhance={({ cancel }) => {
        const validationError = validateInput();
        if (validationError) {
          error = validationError;
          cancel();
          return;
        }

        creating = true;
        error = null;
        copyFeedback = null;

        return async ({ result }) => {
          creating = false;

          if (result.type === 'success' && result.data) {
            if (isApiKeyCreateSuccess(result.data)) {
              const data: ApiKeyCreateSuccessResult = result.data;

              if (data.success && data.apiKey && data.plainKey) {
                apiKeys = [...apiKeys, data.apiKey];
                justCreatedKey = {
                  key: data.plainKey,
                  name: data.apiKey.name,
                };
                resetCreateForm();
                error = null;
              }
            }
          } else if (result.type === 'failure' && result.data) {
            if (isFormFailure(result.data)) {
              const data: FormFailureResult = result.data;
              error = data.error ?? 'Failed to create API key';
            }
          } else {
            error = 'An unexpected error occurred';
          }
        };
      }}
    >
      <div class="flex gap-4">
        <div class="flex-1">
          <p class="mb-2 ml-2 text-xs font-medium text-accent-foreground">Create New API Key</p>
          <div class="space-y-4">
            <!-- API Key Name -->
            <Field
              label="Key name"
              required
              id="keyName"
              description="Letters, numbers, underscores, and hyphens only."
            >
              {#snippet control({ id, describedBy, invalid, required })}
                <input
                  {id}
                  name="name"
                  type="text"
                  bind:value={newKeyName}
                  onkeydown={handleKeyDown}
                  placeholder="Enter a descriptive name..."
                  maxlength={API_KEY_VALIDATION.NAME.MAX_LENGTH}
                  class="form-input"
                  aria-describedby={describedBy}
                  aria-invalid={invalid ? 'true' : undefined}
                  aria-required={required ? 'true' : undefined}
                />
              {/snippet}
            </Field>
            <div class="flex w-full flex-col gap-4 sm:flex-row sm:justify-between">
              <!-- Expiration -->
              <div class="flex flex-col">
                <div
                  class="flex flex-col items-start justify-start space-y-3 sm:flex-row sm:items-center"
                >
                  <label class="ml-2 flex items-center">
                    <Toggle
                      name="neverExpires"
                      bind:checked={neverExpires}
                      variant="primary"
                      size="sm"
                    ></Toggle>
                    <span class="ml-2 text-sm text-muted-foreground"> Never expires? </span>
                  </label>

                  {#if !neverExpires}
                    <div class="ml-2 w-full sm:w-auto">
                      <Field
                        label="Expires"
                        id="expiresAt"
                        description="Defaults to 90 days from now; adjust as needed."
                      >
                        {#snippet control({ id, describedBy })}
                          <input
                            {id}
                            type="datetime-local"
                            name="expiresAt"
                            bind:value={expirationDate}
                            min={computeMinExpiresAt()}
                            class="form-input h-10"
                            aria-describedby={describedBy}
                          />
                        {/snippet}
                      </Field>
                    </div>
                  {:else}
                    <Info
                      variant="warning"
                      size="sm"
                      class="ml-2"
                    >
                      This key will stay valid until you delete it.
                    </Info>
                  {/if}
                </div>
              </div>

              <!-- Generate Button -->
              <div class="mr-2 flex flex-col justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newKeyName.trim() || creating}
                  loading={creating}
                  variant="primary"
                  aria-label="Generate new API key"
                >
                  Generate Key
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  </header>

  <div class="p-4">
    {#if apiKeys.length > 0}
      <!-- Search -->
      <div class="data-list-controls mb-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="relative w-full sm:max-w-xs">
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search by name..."
              aria-label="Search API keys by name"
              class="form-input pl-9"
            />
            <Icon
              iconName="magnifying-glass"
              size={16}
              class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 transform text-muted-foreground"
            />
          </div>
          {#if searchQuery}
            <Button
              variant="outline-primary"
              size="sm"
              onclick={clearSearch}
            >
              Clear search
            </Button>
          {/if}
          <p class="text-sm text-muted-foreground">
            Showing {sortedKeys.length} of {apiKeys.length} keys
          </p>
        </div>
      </div>
    {/if}

    <!-- API Keys list -->
    {#if apiKeys.length === 0}
      <EmptyState
        icon="key"
        iconSize={50}
        title="No API Keys"
        description="Create your first API key to get started."
        class="p-8"
      />
    {:else if sortedKeys.length === 0}
      <EmptyState
        icon="magnifying-glass"
        iconSize={40}
        title="No matching API keys"
        description={`No keys match "${searchQuery}".`}
        class="p-8"
      >
        <Button
          variant="outline-primary"
          size="sm"
          class="mt-4"
          onclick={clearSearch}
        >
          Clear search
        </Button>
      </EmptyState>
    {:else}
      <div class="overflow-x-auto rounded-surface border-strong">
        <table class="min-w-full">
          <thead class="border-b-strong bg-surface">
            <tr>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                Name
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('createdAt')}
                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                <button
                  type="button"
                  onclick={() => toggleSort('createdAt')}
                  class="inline-flex cursor-pointer items-center gap-1 rounded-control hover:text-primary"
                  aria-label={`Sort by creation time (currently ${sortLabelFor('createdAt')})`}
                >
                  Created
                  <span aria-hidden="true">
                    {#if sortKey === 'createdAt'}{sortDir === 'asc' ? '▲' : '▼'}{/if}
                  </span>
                </button>
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                Expires
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('lastUsedAt')}
                class="px-4 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                <button
                  type="button"
                  onclick={() => toggleSort('lastUsedAt')}
                  class="inline-flex cursor-pointer items-center gap-1 rounded-control hover:text-primary"
                  aria-label={`Sort by last used time (currently ${sortLabelFor('lastUsedAt')})`}
                >
                  Last used
                  <span aria-hidden="true">
                    {#if sortKey === 'lastUsedAt'}{sortDir === 'asc' ? '▲' : '▼'}{/if}
                  </span>
                </button>
              </th>
              <th
                scope="col"
                class="relative px-4 py-3"
              >
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y bg-surface-elevated">
            {#each sortedKeys as apiKey (apiKey.id)}
              {@const chip = getExpirationChip(apiKey.expiresAt)}
              <tr class="transition-colors hover:bg-surface-hover">
                <td class="px-4 py-3 text-sm font-medium whitespace-nowrap text-foreground">
                  {apiKey.name}
                </td>
                <td class="px-4 py-3 text-sm whitespace-nowrap text-accent-foreground">
                  <time
                    datetime={apiKey.createdAt}
                    title={new Date(apiKey.createdAt).toLocaleString()}
                  >
                    {new Date(apiKey.createdAt).toLocaleDateString()}
                  </time>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <Chip
                    size="sm"
                    label={chip.label}
                    variant={chip.variant}
                    class={isExpired(apiKey.expiresAt) ? 'opacity-75' : ''}
                  />
                </td>
                <td class="px-4 py-3 text-sm whitespace-nowrap">
                  {#if apiKey.lastUsedAt}
                    <span
                      class="text-foreground"
                      title={new Date(apiKey.lastUsedAt).toLocaleString()}
                    >
                      {formatLastUsed(apiKey.lastUsedAt)}
                    </span>
                  {:else}
                    <span class="text-muted-foreground italic">Never used</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => confirmDelete(apiKey.id)}
                    disabled={deleting}
                    class="cursor-pointer rounded-control p-1 text-error transition-colors hover:bg-error/75 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    aria-label={`Delete API key for ${apiKey.name}`}
                  >
                    <Icon
                      iconName="delete"
                      size={18}
                    />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>

<!-- Hidden delete form -->
<form
  id="delete-form"
  method="POST"
  action="?/delete"
  style:display="none"
  use:enhance={() => {
    deleting = true;
    error = null;
    copyFeedback = null;

    return async ({ result }) => {
      deleting = false;

      if (result.type === 'success' && result.data) {
        if (isApiKeyDeleteSuccess(result.data)) {
          const data: ApiKeyDeleteSuccessResult = result.data;

          if (data.success && data.deletedKeyId) {
            apiKeys = apiKeys.filter((key) => key.id !== data.deletedKeyId);
            copyFeedback = data.message ?? 'API key deleted successfully';
            setTimeout(() => {
              copyFeedback = null;
            }, 3000);
            error = null;
          }
        }
      } else if (result.type === 'failure' && result.data) {
        if (isFormFailure(result.data)) {
          const data: FormFailureResult = result.data;
          error = data.error ?? 'Failed to delete API key';
        }
      } else {
        error = 'An unexpected error occurred';
      }
    };
  }}
>
  <input
    type="hidden"
    name="keyId"
    value={keyToDelete}
  />
</form>

{#if keyToDelete}
  {@const keyName = apiKeys.find((k) => k.id === keyToDelete)?.name ?? 'Unknown'}
  <ConfirmModal
    show={!!keyToDelete}
    title="Delete API key?"
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={handleConfirmDelete}
    onCancel={cancelDelete}
  >
    <p class="mb-4 text-foreground">
      This will permanently delete API key
      <span class="text-xl font-bold text-warning">{keyName}</span>
      and all data synced with it, including:
    </p>
    <ul class="mb-4 list-disc space-y-1 pl-5 text-sm text-foreground">
      <li>Selector profile backups</li>
      <li>Substitution profile backups</li>
      <li>Extraction profile backups</li>
      <li>Cookie backups, including cached cookie files used by jobs</li>
    </ul>
    <Info variant="error">This is a destructive action that cannot be reversed.</Info>
  </ConfirmModal>
{/if}
