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
  import { hasJsonLintErrors } from '$lib/stores/lint';
  import { type BatchJobStartResult, jobStore } from '$lib/stores/jobs';
  import { logger } from '$lib/shared/logger';
  import { Button, Info } from '$lib/components/ui';

  let commandUrlsInput = $state('');
  const useUserConfigPath = $state(false);
  let isLoading = $state(false);
  let formError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  onMount(() => {
    checkConfigFileForErrors();
  });

  async function checkConfigFileForErrors() {
    try {
      const response = await fetch('/api/files/read');
      const data = await response.json();

      if (data.success) {
        try {
          JSON.parse(data.content);
          hasJsonLintErrors.set(false);
        } catch (parseError) {
          logger.error('Config file parsing error:', parseError);
          hasJsonLintErrors.set(true);
        }
      } else {
        logger.error('Failed to read config:', data.error);
      }
    } catch (fetchError) {
      logger.error('Failed to fetch config:', fetchError);
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    successMessage = null;
    formError = null;

    const urlsToProcess = commandUrlsInput
      .split(/[\s\n]+/) // Split by any whitespace; space, tab, newline etc.
      .map(url => url.trim())
      .filter(url => url !== ''); // Remove empty strings

    if (urlsToProcess.length === 0) {
      formError = 'Please enter at least one URL.';
      return;
    }

    isLoading = true;

    const batchStartResult: BatchJobStartResult = await jobStore.startJob(
      urlsToProcess,
      useUserConfigPath
    );

    isLoading = false;
    let localStartedCount = 0;
    const localErrorMessages: string[] = [];

    if (batchStartResult.results && batchStartResult.results.length > 0) {
      batchStartResult.results.forEach(result => {
        if (result.success && result.jobId) {
          localStartedCount++;
        } else {
          localErrorMessages.push(
            `Error for "${result.url}": ${result.error ?? result.message ?? 'Unknown error'}`
          );
        }
      });
    } else if (!batchStartResult.overallSuccess) {
      formError =
        batchStartResult.results?.[0]?.error ??
        batchStartResult.error ??
        'Failed to process job request. Check server logs.';
    }

    if (localErrorMessages.length > 0) {
      formError = `Processed ${urlsToProcess.length} URL(s).\n`;
      if (localStartedCount > 0) {
        formError += `${localStartedCount} job(s) started.\n`;
      }
      formError += `${localErrorMessages.length} failed:\n- ${localErrorMessages.join('\n- ')}`;
    }

    if (localStartedCount > 0) {
      successMessage = `${localStartedCount} job(s) accepted for processing.`;
      if (localErrorMessages.length === 0) {
        commandUrlsInput = '';
        // useUserConfigPath = false; // TODO: Future use
      }
      setTimeout(() => (successMessage = null), 5000);
    }

    if (localStartedCount === 0 && localErrorMessages.length === 0 && urlsToProcess.length > 0) {
      if (!batchStartResult.overallSuccess) {
        formError ??= 'Job submission failed. Please check server logs or try again.';
      } else {
        formError ??= 'No valid URLs found to process, or all URLs were invalid before submission.';
      }
    }
  }

  function clearUrlsInput() {
    commandUrlsInput = '';
    formError = null;
    successMessage = null;
  }
</script>

<div
  class="bg-primary-50 p-4 dark:border-primary-400 rounded-sm border border-primary-600 dark:bg-primary-800"
>
  <form onsubmit={handleSubmit} class="space-y-6">
    <div class="m-4">
      <label
        for="commandUrlsInput"
        class="mb-2 block px-2 text-sm font-medium text-primary-900 dark:text-primary-100"
      >
        URL(s) <span class="text-xs dark:text-secondary-600 text-secondary-500">
          (one per line or space-separated)
        </span>
      </label>
      <div class="relative">
        <textarea
          id="commandUrlsInput"
          name="commandUrlsInput"
          bind:value={commandUrlsInput}
          placeholder="https://example.com/gallery1&#10;https://example.com/image.jpg https://othersite.com/album"
          autocomplete="off"
          rows="5"
          class="w-full rounded-sm border dark:border-secondary-300 dark:bg-secondary-900 px-4 py-3 text-base dark:text-primary-100
         dark:placeholder-secondary-500 transition-colors duration-200
         dark:focus:border-primary-500 focus:ring-3 dark:focus:ring-primary-500/20 focus:outline-hidden
         border-secondary-700 bg-secondary-100 text-primary-900
         placeholder-secondary-500 focus:border-primary-400 focus:ring-primary-400/20 pr-9"
        ></textarea>
      </div>
    </div>

    <div class="flex justify-end m-4 gap-6">
      <Button
        onclick={clearUrlsInput}
        disabled={isLoading || !commandUrlsInput}
        class="mt-2 w-full"
      >
        Clear
      </Button>
      <Button
        type="submit"
        disabled={isLoading || $hasJsonLintErrors || !commandUrlsInput}
        class="mt-2 w-full"
        variant="primary"
      >
        Run
      </Button>
    </div>

    {#if formError}
      <div
        class="flex mx-auto justify-center w-6/12 mt-2 rounded-md bg-error-750 dark:bg-error-250 p-3 text-sm dark:text-error-900 text-error-100 whitespace-pre-line"
      >
        {formError}
      </div>
    {/if}

    {#if successMessage && !formError}
      <Info variant="success" dismissible class="m-4">
        {successMessage}
      </Info>
    {/if}
    {#if $hasJsonLintErrors}
      <Info variant="warning" title="Stop!" class="m-8">
        There is at least one error in your <a href="/config" class="underline">config file</a>
        that you must fix before proceeding!
      </Info>
    {/if}
  </form>
</div>
