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
  import { ConfigEditor, Icon } from '$lib/components';
  import { Info, PageLayout } from '$lib/components/ui';
  import { type ConfigSaveSuccessResult, isConfigSaveSuccess } from '$lib/types/form-results';

  const { data } = $props();

  let theme = $state<'light' | 'dark'>('light');
  let jsonContent = $state(data.success ? data.content : '{}');
  let loadMessage = $state(data.message ?? '');
  const loadError = $state(data.success ? '' : (data.error ?? 'Failed to load configuration'));
  let _isSubmitting = $state(false);

  let configForm: HTMLFormElement | undefined = $state();

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
</script>

<PageLayout title="Configuration" description="Manage your config file">
  {#snippet icon()}
    <Icon iconName="json" size={32} />
  {/snippet}

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

            if (loadMessage) {
              loadMessage = '';
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
