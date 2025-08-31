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
  import { SuccessIcon } from '$lib/components/icons';
  import { Button, Info, ConfirmModal, Toggle } from '$lib/components/ui';
  import { Icon } from '$lib/components/index';
  import {
    API_KEY_VALIDATION,
    validateApiKeyInput,
    type ApiKey,
  } from '../../../routes/settings/apikey/lib';
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

  let apiKeys = $state<ApiKey[]>(initialData.success ? (initialData.apiKeys ?? []) : []);
  let newKeyName = $state('');
  let expirationDate = $state('');
  let neverExpires = $state(true);
  let isLoading = $state(false);
  let error = $state<string | null>(initialData.success ? null : (initialData.error ?? null));
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
      return { text: 'Never expires', color: 'text-foreground' };
    }

    const expDate = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', color: 'text-error' };
    } else if (diffDays <= 7) {
      return {
        text: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
        color: 'text-warning',
      };
    } else {
      return { text: `Expires on ${expDate.toLocaleDateString()}`, color: 'text-foreground' };
    }
  }

  function handleDismiss(): void {
    newKeyName = '';
    expirationDate = '';
    neverExpires = true;
  }

  function validateInput(): string | null {
    return validateApiKeyInput(
      newKeyName,
      !neverExpires && expirationDate ? expirationDate : undefined
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
      console.error('Failed to copy API key:', err);
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

{#if isLoading}
  <div class="flex items-center justify-center py-12" role="status" aria-live="polite">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2" aria-hidden="true"></div>
    <span class="ml-3 text-foreground">Loading API keys...</span>
  </div>
{:else}
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
        <SuccessIcon />
      {/snippet}
      <strong>Important:</strong> This is the only time you'll be able to see your API key. Make
      sure to copy it now and store it securely.

      <div class="-success rounded-sm p-3 my-4">
        <div class="flex items-center justify-between">
          <code class="text-lg font-mono text-foreground break-all flex-1 mr-4">
            {createdKey.key}
          </code>
          {#if clipboard !== undefined}
            <button
              onclick={() => copyApiKey(createdKey.key, createdKey.name)}
              class="cursor-pointer p-2 text-success focus:outline-none focus:ring-1 focus:ring-success rounded transition-colors"
              aria-label={`Copy API key for ${createdKey.name} to clipboard`}
            >
              <Icon iconName="copy-clipboard" size={20} />
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

          isLoading = true;
          error = null;
          copyFeedback = null;

          return async ({ result }) => {
            isLoading = false;

            if (result.type === 'success' && result.data) {
              if (isApiKeyCreateSuccess(result.data)) {
                const data: ApiKeyCreateSuccessResult = result.data;

                if (data.success && data.apiKey && data.plainKey) {
                  apiKeys = [...apiKeys, data.apiKey];
                  justCreatedKey = {
                    key: data.plainKey,
                    name: data.apiKey.name,
                  };
                  newKeyName = '';
                  expirationDate = '';
                  neverExpires = true;
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
            <label for="keyName" class="ml-2 block text-xs font-medium text-accent-foreground mb-2">
              Create New API Key
            </label>
            <div class="space-y-4">
              <!-- API Key Name -->
              <div>
                <input
                  id="keyName"
                  name="name"
                  type="text"
                  bind:value={newKeyName}
                  onkeydown={handleKeyDown}
                  placeholder="Enter a descriptive name..."
                  maxlength={API_KEY_VALIDATION.NAME.MAX_LENGTH}
                  class="form-input"
                  aria-describedby="keyNameHelp"
                />
              </div>
              <div class="flex flex-col sm:flex-row sm:justify-between gap-4 w-full">
                <!-- Expiration -->
                <div class="flex flex-col">
                  <div
                    class="flex space-y-3 justify-start sm:items-center flex-col sm:flex-row items-start"
                  >
                    <label class="flex items-center ml-2">
                      <Toggle
                        name="neverExpires"
                        bind:checked={neverExpires}
                        variant="primary"
                        size="sm"
                      ></Toggle>
                      <span class="text-sm text-muted-foreground ml-2"> Never expires? </span>
                    </label>

                    {#if !neverExpires}
                      <div class="flex items-center sm:justify-end ml-2 w-full">
                        <input
                          type="datetime-local"
                          name="expiresAt"
                          bind:value={expirationDate}
                          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                          class="form-input h-10"
                          aria-describedby="expirationHelp"
                        />
                        <p id="expirationHelp" class="mt-1 ml-2 text-xs text-muted-foreground">
                          Set expiration date
                        </p>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Generate Button -->
                <div class="flex justify-end flex-col mr-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newKeyName.trim() || isLoading}
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

    <!-- API Keys list -->
    {#if apiKeys.length === 0}
      <div class="cursor-default p-8 text-center">
        <Icon iconName="key" size={50} class="text-foreground" />
        <h3 class="text-lg font-medium text-foreground my-2">No API Keys</h3>
        <p class="text-foreground">Create your first API key to get started.</p>
      </div>
    {:else}
      <div>
        {#each apiKeys as apiKey (apiKey.id)}
          <article class="data-list-item">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-medium text-foreground mb-2">
                  {apiKey.name}
                </h3>

<!--                <div -->
<!--                  class="bg-surface-selected rounded-sm border-strong p-3 mb-3 flex items-center justify-between" -->
<!--                > -->
<!--                  <div class="flex items-center flex-1"> -->
<!--                    <Icon iconName="lock" size={16} class="text-foreground mr-2" /> -->
<!--                    <span class="text-sm text-muted-foreground select-none"> -->
<!--                      API key is securely stored -->
<!--                    </span> -->
<!--                  </div> -->
<!--                </div> -->
                <div class="relative">
                  <input
                    type="text"
                    placeholder="API key is securely stored"
                    class="form-input pl-10 cursor-default"
                    disabled
                    readonly
                  />
                  <Icon
                    iconName="lock"
                    size={16}
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>

                <div class="space-y-1 flex flex-row justify-between mt-3">
                  <p class="text-sm text-accent-foreground">
                    <time datetime={apiKey.createdAt}>
                      Created: {new Date(apiKey.createdAt).toLocaleString()}
                    </time>
                  </p>
                  {#if apiKey.expiresAt}
                    {@const status = getExpirationStatus(apiKey.expiresAt)}
                    <p
                      class="text-sm text-accent-foreground {status.color}"
                      class:font-medium={isExpired(apiKey.expiresAt)}
                    >
                      Expires: {status.text}
                    </p>
                  {:else}
                    <p class="text-sm text-accent-foreground">Expires: Never</p>
                  {/if}
                </div>
              </div>

              <button
                type="button"
                onclick={() => confirmDelete(apiKey.id)}
                class="cursor-pointer ml-4 p-1 text-error hover:bg-error/75 hover:text-foreground rounded-sm focus:outline-none transition-colors"
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

<!-- Hidden delete form -->
<form
  id="delete-form"
  method="POST"
  action="?/delete"
  style:display="none"
  use:enhance={() => {
    isLoading = true;
    error = null;
    copyFeedback = null;

    return async ({ result }) => {
      isLoading = false;

      if (result.type === 'success' && result.data) {
        if (isApiKeyDeleteSuccess(result.data)) {
          const data: ApiKeyDeleteSuccessResult = result.data;

          if (data.success && data.deletedKeyId) {
            apiKeys = apiKeys.filter(key => key.id !== data.deletedKeyId);
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
  <input type="hidden" name="keyId" value={keyToDelete} />
</form>

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
    <p class="text-foreground mb-4">
      This will permanently delete API key
      <span class="text-xl font-bold text-warning">{keyName}</span>.
    </p>
    <Info variant="error">This is a destructive action that cannot be reversed.</Info>
  </ConfirmModal>
{/if}
