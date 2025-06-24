<script lang="ts">
  import { onMount } from 'svelte';
  import type { ApiKey, NewApiKeyResponse } from '$lib/types/apiKey';
  import { InfoIcon, SuccessIcon } from '$lib/components/icons';
  import { Button, Info, ConfirmModal } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import { v4 as uuidv4 } from 'uuid';

  let apiKeys = $state<ApiKey[]>([]);
  let newKeyName = $state('');
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let justCreatedKey = $state<{ key: string; name: string } | null>(null);
  let keyToDelete = $state<string | null>(null);

  function handleDismiss(): void {
    newKeyName = '';
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
      error = err instanceof Error ? err.message : 'Failed to load API keys from server';
      console.error('Error loading API keys:', err);
    } finally {
      isLoading = false;
    }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) {
      error = 'Please enter a name for the API key';
      return;
    }

    if (apiKeys.some(key => key.name === newKeyName.trim())) {
      error = 'An API key with this name already exists';
      return;
    }

    // TODO: Update to use UUID package
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          id: uuidv4(),
          name: newKeyName.trim(),
          createdAt: new Date().toISOString(),
        }),
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
        error = null;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create API key';
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
      error = err instanceof Error ? err.message : 'Failed to delete API key';
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
    <span class="sr-only">Loading your API keys, please wait</span>
  </div>
{:else}
  {#if justCreatedKey}
    {@const createdKey = justCreatedKey}
    <Info
      variant="warning"
      size="lg"
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

      <div class="bg-blue dark:bg-black border border-success-300 rounded-md p-3 mb-4">
        <div class="flex items-center justify-between">
          <code
            class="text-lg font-mono text-primary-800 dark:text-primary-200 break-all flex-1 mr-4"
          >
            {createdKey.key}
          </code>
          <button
            onclick={() => copyApiKey(createdKey.key, createdKey.name)}
            class="cursor-pointer p-2 text-success-600 hover:text-success-800 focus:outline-none focus:ring-2 focus:ring-success-500 rounded transition-colors"
            aria-label={`Copy API key for ${createdKey.name} to clipboard`}
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
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
    <Info variant="warning" title="Error" dismissible onDismiss={handleDismiss}>
      {error}
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
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <input
              id="keyName"
              type="text"
              bind:value={newKeyName}
              onkeydown={handleKeyDown}
              placeholder="Enter a descriptive name..."
              class="w-full px-3 py-2 border border-secondary-300 bg-secondary-100 dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-secondary-400"
              aria-describedby="keyNameHelp"
            />
            <p id="keyNameHelp" class="mt-1 ml-2 text-xs text-secondary-500">
              Choose a descriptive name to remember this API key
            </p>
          </div>
          <div class="sm:self-start">
            <Button
              onclick={createApiKey}
              disabled={!newKeyName.trim()}
              variant="info"
              class="w-full"
              aria-label="Generate new API key"
            >
              <Icon iconName="plus" size={20} class="mr-2" />
              Generate Key
            </Button>
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
                    <svg
                      class="h-4 w-4 text-secondary-500 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span class="text-sm text-secondary-600 select-none">
                      API key is securely stored
                    </span>
                  </div>
                </div>

                <p class="text-sm text-secondary-500">
                  <time datetime={apiKey.createdAt}>
                    Created: {new Date(apiKey.createdAt).toLocaleString()}
                  </time>
                </p>
              </div>

              <button
                onclick={() => confirmDelete(apiKey.id)}
                class="cursor-pointer ml-4 p-2 text-error-500 hover:text-error-700 hover:bg-error-900 dark:hover:bg-error-100 rounded-md focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 transition-colors"
                aria-label={`Delete API key for ${apiKey.name}`}
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
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
