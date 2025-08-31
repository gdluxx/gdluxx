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
  <div
    class="flex items-center justify-center py-12"
    role="status"
    aria-live="polite"
  >
    <div
      class="h-8 w-8 animate-spin rounded-full border-b-2"
      aria-hidden="true"
    ></div>
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

      <div class="-success my-4 rounded-sm p-3">
        <div class="flex items-center justify-between">
          <code class="mr-4 flex-1 font-mono text-lg break-all text-foreground">
            {createdKey.key}
          </code>
          {#if clipboard !== undefined}
            <button
              onclick={() => copyApiKey(createdKey.key, createdKey.name)}
              class="cursor-pointer rounded p-2 text-success transition-colors focus:ring-1 focus:ring-success focus:outline-none"
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
            <label
              for="keyName"
              class="mb-2 ml-2 block text-xs font-medium text-accent-foreground"
            >
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
                      <div class="ml-2 flex w-full items-center sm:justify-end">
                        <input
                          type="datetime-local"
                          name="expiresAt"
                          bind:value={expirationDate}
                          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                          class="form-input h-10"
                          aria-describedby="expirationHelp"
                        />
                        <p
                          id="expirationHelp"
                          class="mt-1 ml-2 text-xs text-muted-foreground"
                        >
                          Set expiration date
                        </p>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Generate Button -->
                <div class="mr-2 flex flex-col justify-end">
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
        <Icon
          iconName="key"
          size={50}
          class="text-foreground"
        />
        <h3 class="my-2 text-lg font-medium text-foreground">No API Keys</h3>
        <p class="text-foreground">Create your first API key to get started.</p>
      </div>
    {:else}
      <div>
        {#each apiKeys as apiKey (apiKey.id)}
          <article class="data-list-item">
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <h3 class="mb-2 text-lg font-medium text-foreground">
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
                    class="form-input cursor-default pl-10"
                    disabled
                    readonly
                  />
                  <Icon
                    iconName="lock"
                    size={16}
                    class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 transform text-muted-foreground"
                  />
                </div>

                <div class="mt-3 flex flex-row justify-between space-y-1">
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
                class="ml-4 cursor-pointer rounded-sm p-1 text-error transition-colors hover:bg-error/75 hover:text-foreground focus:outline-none"
                class:opacity-75={isExpired(apiKey.expiresAt)}
                aria-label={`Delete API key for ${apiKey.name}`}
              >
                <Icon
                  iconName="delete"
                  size={20}
                />
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
    title="Delete API Key?"
    confirmText="Delete"
    cancelText="Cancel"
    confirmVariant="danger"
    onConfirm={handleConfirmDelete}
    onCancel={cancelDelete}
  >
    <p class="mb-4 text-foreground">
      This will permanently delete API key
      <span class="text-xl font-bold text-warning">{keyName}</span>.
    </p>
    <Info variant="error">This is a destructive action that cannot be reversed.</Info>
  </ConfirmModal>
{/if}
