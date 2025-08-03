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
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { ConfigEditor, Icon } from '$lib/components';
  import { Info, PageLayout, UploadModal, Button } from '$lib/components/ui';
  import { type ConfigSaveSuccessResult, isConfigSaveSuccess } from '$lib/types/form-results';
  import { clientLogger as logger } from '$lib/client/logger';

  const { data } = $props();

  let theme = $state<'light' | 'dark'>('light');
  let _isSubmitting = $state(false);
  // eslint-disable-next-line svelte/prefer-writable-derived
  let jsonContent = $state(data.success ? data.content : '{}');

  // React to data changes from invalidation
  const loadMessage = $derived(data.message ?? '');
  const loadError = $derived(data.success ? '' : (data.error ?? 'Failed to load configuration'));

  // Update jsonContent when data changes (after invalidation)
  // Otherwise a page refresh is required
  $effect(() => {
    jsonContent = data.success ? data.content : '{}';
  });

  let configForm: HTMLFormElement | undefined = $state();
  let showUploadModal = $state(false);

  async function saveJsonFile(content: string) {
    if (!configForm) {
      return { message: 'Form not available' };
    }

    const contentInput = configForm.querySelector('input[name="content"]') as HTMLInputElement;
    if (contentInput) {
      contentInput.value = content;
    }

    configForm.requestSubmit();

    return { message: 'Submitting...' };
  }

  function checkTheme() {
    theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  onMount(() => {
    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  });

  function handleUploadClick() {
    showUploadModal = true;
  }

  function handleUploadClose() {
    showUploadModal = false;
  }

  async function refreshConfigContent() {
    try {
      logger.info('Attempting manual config refresh from server');
      const response = await fetch('/config');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data?.content) {
        jsonContent = result.data.content;
        logger.info('Manual config refresh successful');
      } else {
        logger.warn('Manual config refresh failed - invalid response', result);
      }
    } catch (error) {
      logger.error('Manual config refresh failed:', error);
    }
  }

  async function handleUploadSuccess(file: File) {
    try {
      const beforeContent = jsonContent;
      const beforePreview = beforeContent.substring(0, 100);

      logger.info('Config upload completed, starting refresh process', {
        filename: file.name,
        beforeContentPreview: beforePreview,
      });

      // ensure complete refresh
      await invalidateAll();

      // Give the system a moment to process the invalidation
      // Preventing race condition
      setTimeout(() => {
        const afterContent = jsonContent;
        const afterPreview = afterContent.substring(0, 100);

        logger.info('Checking content after invalidation', {
          afterContentPreview: afterPreview,
          contentChanged: beforeContent !== afterContent,
        });

        if (beforeContent !== afterContent) {
          logger.info('Config content updated successfully via invalidation');
        } else {
          logger.warn('Config content unchanged after invalidation - triggering manual refresh');
          refreshConfigContent();
        }
      }, 200);

      logger.info('Config uploaded successfully', { filename: file.name });
    } catch (error) {
      logger.error('Error during config upload success handling:', error);
    }
  }
</script>

<PageLayout title="Configuration" description="Manage your config file">
  {#snippet icon()}
    <Icon iconName="json" size={32} />
  {/snippet}

  <div class="flex justify-between items-center mb-6">
    <div></div>
    <Button variant="outline-primary" size="sm" onclick={handleUploadClick}>
      <Icon iconName="plus" size={16} class="mr-2" />
      Upload Config
    </Button>
  </div>

  {#if loadError}
    <Info variant="warning" size="lg">
      {loadError}
    </Info>
  {:else}
    {#if loadMessage}
      <Info variant="warning" size="lg" class="my-8">
        {loadMessage}
      </Info>
    {/if}

    <form
      bind:this={configForm}
      method="POST"
      use:enhance={() => {
        _isSubmitting = true;
        return async ({ result }) => {
          _isSubmitting = false;

          if (result.type === 'success' && result.data) {
            if (isConfigSaveSuccess(result.data)) {
              const data: ConfigSaveSuccessResult = result.data;
              // If paths were transformed, update editor
              if (data.transformed && data.content) {
                jsonContent = data.content;
              }
            }
          }
        };
      }}
    >
      <input type="hidden" name="content" value={jsonContent} />
      <ConfigEditor bind:value={jsonContent} {theme} onSave={saveJsonFile} height="75vh" />
    </form>
  {/if}
</PageLayout>

<UploadModal
  show={showUploadModal}
  type="config"
  onClose={handleUploadClose}
  onUploadSuccess={handleUploadSuccess}
/>
