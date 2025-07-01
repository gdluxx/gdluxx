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
  import { ConfigEditor, Icon } from '$lib/components';
  import { Info, PageLayout } from '$lib/components/ui';

  let theme: 'light' | 'dark' = 'light';
  let jsonContent = '';
  let isLoading = true;
  let loadError = '';
  let loadMessage = '';

  async function loadConfig() {
    try {
      const response = await fetch('/api/files/read');
      const data = await response.json();

      if (data.success) {
        jsonContent = data.content;
        if (data.message) {
          loadMessage = data.message;
        }
      } else {
        //eslint-disable-next-line
        loadError = data.error || 'Failed to load configuration';
      }
    } catch (error) {
      loadError = 'Failed to connect to server';
      console.error('Error loading config:', error);
    } finally {
      isLoading = false;
    }
  }

  async function saveJsonFile(content: string) {
    const response = await fetch('/api/files/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      //eslint-disable-next-line
      throw new Error(errorData.error || `Failed to save: ${response.statusText}`);
    }

    const result = await response.json();

    // If paths were transformed, update editor
    if (result.transformed && result.content) {
      jsonContent = result.content;
    }

    if (loadMessage) {
      loadMessage = '';
    }

    return result;
  }

  function checkTheme() {
    theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  onMount(() => {
    checkTheme();
    loadConfig();

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
</script>

<PageLayout title="Configuration" description="Manage your config file">
  {#snippet icon()}
    <Icon iconName="json" size={32} />
  {/snippet}

  {#if isLoading}
    <div class="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
        aria-hidden="true"
      ></div>
      <span class="ml-3 text-secondary-600">Loading configuration...</span>
    </div>
  {:else if loadError}
    <Info variant="warning" size="lg">
      {loadError}
    </Info>
  {:else}
    {#if loadMessage}
      <Info variant="warning" size="lg" class="my-8">
        {loadMessage}
      </Info>
    {/if}

    <ConfigEditor bind:value={jsonContent} {theme} onSave={saveJsonFile} height="75vh" />
  {/if}
</PageLayout>
