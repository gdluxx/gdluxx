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
  import type { ApiKey, NewApiKeyResponse, CreateApiKeyRequest } from '$lib/types/apiKey';
  import { InfoIcon, SuccessIcon } from '$lib/components/icons';
  import { Button, Info, ConfirmModal } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import { API_KEY_VALIDATION, validateApiKeyInput } from '$lib/shared/apiKeyValidation';

  let apiKeys = $state<ApiKey[]>([]);
  let newKeyName = $state('');
  let expirationDate = $state('');
  let neverExpires = $state(true);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let justCreatedKey = $state<{ key: string; name: string } | null>(null);
  let keyToDelete = $state<string | null>(null);
  const clipboard = navigator.clipboard;

  function isExpired(expiresAt: string | null | undefined): boolean {
    if (!expiresAt) {
      return false;
    }
    return new Date(expiresAt) <= new Date();
  }

  function getExpirationStatus(expiresAt: string | null | undefined): {
    text: string;
    color: string;
  } {
    if (!expiresAt) {
      return { text: 'Never expires', color: 'text-success-600' };
    }

    const expDate = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', color: 'text-error-600' };
    } else if (diffDays <= 7) {
      return {
        text: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
        color: 'text-warning-600',
      };
    } else {
      return { text: `Expires on ${expDate.toLocaleDateString()}`, color: 'text-secondary-600' };
    }
  }

  function handleDismiss(): void {
    newKeyName = '';
    expirationDate = '';
    neverExpires = true;
  }

  async function loadApiKeys() {
    try {
      const response = await fetch('/api/keys');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      apiKeys = Array.isArray(data) ? data : [];
    } catch (err) {
      error = err instanceof Error ? err.message : API_KEY_VALIDATION.SERVER.LOAD_FAILED;
      console.error('Error loading API keys:', err);
    } finally {
      isLoading = false;
    }
  }

  function validateInput(): string | null {
    return validateApiKeyInput(
      newKeyName,
      !neverExpires && expirationDate ? expirationDate : undefined
    );
  }

  async function createApiKey() {
    error = null;

    const validationError = validateInput();
    if (validationError) {
      error = validationError;
      return;
    }

    try {
      const requestBody: CreateApiKeyRequest = {
        name: newKeyName.trim(),
        expiresAt: !neverExpires && expirationDate ? expirationDate : undefined,
      };

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `HTTP error! status: ${response.status}`);
      }

      const result: NewApiKeyResponse = await response.json();
      if (result.apiKey && result.plainKey) {
        apiKeys = [...apiKeys, result.apiKey];

        justCreatedKey = {
          key: result.plainKey,
          name: result.apiKey.name,
        };

        newKeyName = '';
        expirationDate = '';
        neverExpires = true;
        error = null;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : API_KEY_VALIDATION.SERVER.CREATION_FAILED;
      console.error('Error creating API key:', err);
    }
  }

  async function copyApiKey(key: string, keyName: string) {
    try {
      await navigator.clipboard.writeText(key);
      copyFeedback = `API key "${keyName}" copied to clipboard`;
      setTimeout(() => {
        copyFeedback = null;
      }, 3000);
    } catch (err) {
      console.error('Failed to copy API key:', err);
      error = 'Failed to copy API key to clipboard';
    }
  }

  async function deleteApiKey(keyId: string) {
    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      apiKeys = apiKeys.filter(key => key.id !== keyId);
      error = null;

      copyFeedback = result.message ?? 'API key deleted successfully';
      setTimeout(() => {
        copyFeedback = null;
      }, 3000);
    } catch (err) {
      error = err instanceof Error ? err.message : API_KEY_VALIDATION.SERVER.DELETE_FAILED;
      console.error('Error deleting API key:', err);
    }
  }

  function dismissNewKey() {
    justCreatedKey = null;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      createApiKey();
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
      await deleteApiKey(keyToDelete);
      keyToDelete = null;
    }
  }

  onMount(() => {
    loadApiKeys();
  });
</script>

{#if isLoading}
  <div class="flex items-center justify-center py-12" role="status" aria-live="polite">
    <div
      class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
      aria-hidden="true"
    ></div>
    <span class="ml-3 text-secondary-600">Loading API keys...</span>
  </div>
{:else}
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
        <SuccessIcon />
      {/snippet}
      <strong>Important:</strong> This is the only time you'll be able to see your API key. Make
      sure to copy it now and store it securely.

      <div class="bg-blue dark:bg-black border border-success-300 rounded-md p-3 my-4">
        <div class="flex items-center justify-between">
          <code
            class="text-lg font-mono text-primary-800 dark:text-primary-200 break-all flex-1 mr-4"
          >
            {createdKey.key}
          </code>
          {#if clipboard !== undefined}
            <button
              onclick={() => copyApiKey(createdKey.key, createdKey.name)}
              class="cursor-pointer p-2 text-success-600 hover:text-success-800 focus:outline-none focus:ring-2 focus:ring-success-500 rounded transition-colors"
              aria-label={`Copy API key for ${createdKey.name} to clipboard`}
            >
              <Icon iconName="copy-clipboard" size={20} />
            </button>
          {/if}
        </div>
      </div>
      <p class="text-sm text-success-700">
        Key name: <strong>{createdKey.name}</strong>
      </p>
    </Info>
  {/if}

  {#if copyFeedback}
    <Info variant="success" size="sm" class="my-8">
      {copyFeedback}
    </Info>
  {/if}

  {#if error}
    <Info variant="warning" title="Error" dismissible onDismiss={handleDismiss} class="my-8">
      <div class="whitespace-pre-line">
        {error}
      </div>
    </Info>
  {/if}

  <!-- Create New API Key -->
  <section
    class="cursor-default bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
  >
    <h2
      class="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4 flex items-center"
    >
      <Icon iconName="plus" size={20} class="mr-2" />
      Create New API Key
    </h2>

    <div class="flex gap-4">
      <div class="flex-1">
        <label
          for="keyName"
          class="ml-2 block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2"
        >
          API Key Name
        </label>
        <div class="space-y-4">
          <!-- API Key Name -->
          <div>
            <input
              id="keyName"
              type="text"
              bind:value={newKeyName}
              onkeydown={handleKeyDown}
              placeholder="Enter a descriptive name..."
              maxlength={API_KEY_VALIDATION.NAME.MAX_LENGTH}
              class="w-full px-3 py-2 border border-secondary-300 bg-secondary-100 dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-secondary-400"
              aria-describedby="keyNameHelp"
            />
            <p id="keyNameHelp" class="mt-1 ml-2 text-xs text-secondary-500">
              Choose a descriptive name to remember this API key
            </p>
          </div>
          <div class="flex flex-col sm:flex-row sm:justify-between gap-4 w-full">
            <!-- Expiration -->
            <div class="flex flex-col">
              <span
                class="ml-2 block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2"
              >
                Expiration
              </span>
              <div
                class="flex space-y-3 justify-start sm:items-center flex-col sm:flex-row items-start"
              >
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={neverExpires}
                    class="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                  />
                  <span class="text-sm text-secondary-700 dark:text-secondary-300">
                    Never expires?
                  </span>
                </label>

                {#if !neverExpires}
                  <div class="flex items-center sm:justify-end ml-2 w-full">
                    <input
                      type="datetime-local"
                      bind:value={expirationDate}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      class="w-full h-10 px-3 py-2 border border-secondary-300 bg-secondary-100 dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-secondary-400"
                      aria-describedby="expirationHelp"
                    />
                    <p id="expirationHelp" class="mt-1 ml-2 text-xs text-secondary-500">
                      Set expiration date
                    </p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Generate Button -->
            <div class="flex justify-end flex-col">
              <Button
                onclick={createApiKey}
                disabled={!newKeyName.trim()}
                variant="info"
                class="h-10"
                aria-label="Generate new API key"
              >
                <Icon iconName="plus" size={20} class="mr-2" />
                Generate Key
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <Info variant="info" size="lg" class="my-8">
    {#snippet icon()}
      <InfoIcon />
    {/snippet}
    API keys are securely hashed and cannot be recovered. Copy them when first created.
  </Info>

  <!-- API Keys list -->
  <section
    class="bg-primary-50 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
  >
    <header
      class="px-6 py-4 bg-primary-50 dark:border-primary-400 rounded-t-lg border-b border-primary-600 dark:bg-primary-800"
    >
      <h2 class="cursor-default text-xl font-semibold text-secondary-900 dark:text-secondary-100">
        Your API Keys ({apiKeys.length})
      </h2>
    </header>

    {#if apiKeys.length === 0}
      <div class="cursor-default p-8 text-center">
        <Icon iconName="key" size={50} class="text-secondary-600 dark:text-primary-100" />
        <h3 class="text-lg font-medium text-secondary-900 dark:text-secondary-100 my-2">
          No API Keys
        </h3>
        <p class="text-secondary-600">Create your first API key to get started.</p>
      </div>
    {:else}
      <div class="divide-y divide-secondary-800 dark:divide-secondary-200">
        {#each apiKeys as apiKey (apiKey.id)}
          <article class="p-6">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                  {apiKey.name}
                </h3>

                <div
                  class="bg-secondary-100 dark:bg-secondary-900 rounded-md p-3 mb-3 flex items-center justify-between"
                >
                  <div class="flex items-center flex-1">
                    <Icon iconName="lock" size={16} class="text-secondary-500 mr-2" />
                    <span class="text-sm text-secondary-600 select-none">
                      API key is securely stored
                    </span>
                  </div>
                </div>

                <div class="space-y-1 flex flex-row justify-between">
                  <p class="text-sm text-secondary-500">
                    <time datetime={apiKey.createdAt}>
                      Created: {new Date(apiKey.createdAt).toLocaleString()}
                    </time>
                  </p>
                  {#if apiKey.expiresAt}
                    {@const status = getExpirationStatus(apiKey.expiresAt)}
                    <p
                      class="text-sm text-secondary-500 {status.color}"
                      class:font-medium={isExpired(apiKey.expiresAt)}
                    >
                      Expires: {status.text}
                    </p>
                  {:else}
                    <p class="text-sm text-secondary-500">Expires: Never</p>
                  {/if}
                </div>
              </div>

              <button
                onclick={() => confirmDelete(apiKey.id)}
                class="cursor-pointer ml-4 p-1 text-error-500 hover:text-error-700 hover:bg-error-900 dark:hover:bg-error-100 rounded-md focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 transition-colors"
                class:opacity-75={isExpired(apiKey.expiresAt)}
                aria-label={`Delete API key for ${apiKey.name}`}
              >
                <Icon iconName="delete" size={20} />
              </button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
{/if}

{#if keyToDelete}
  {@const keyName = apiKeys.find(k => k.id === keyToDelete)?.name ?? 'Unknown'}
  <ConfirmModal
    show={!!keyToDelete}
    title="Delete API Key?"
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={handleConfirmDelete}
    onCancel={cancelDelete}
  >
    <p class="text-secondary-700 dark:text-secondary-300 mb-4">
      This will permanently delete API key
      <span class="text-xl font-bold text-warning-500">{keyName}</span>.
    </p>
    <Info variant="danger">This is a destructive action that cannot be reversed.</Info>
  </ConfirmModal>
{/if}
