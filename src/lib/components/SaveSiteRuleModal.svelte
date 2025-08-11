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
  import { scale } from 'svelte/transition';
  import { Button } from '$lib/components/ui';
  import type { OptionWithSource } from '$lib/types/command-form';
  import { Icon } from '$lib/components/index';

  interface SaveSiteRuleModalProps {
    show: boolean;
    options: Map<string, OptionWithSource>;
    detectedPatterns: string[];
    onSaved: () => void;
    onCancel: () => void;
  }

  const {
    show = false,
    options,
    detectedPatterns,
    onSaved,
    onCancel,
  }: SaveSiteRuleModalProps = $props();

  let selectedPattern = $state(detectedPatterns[0] ?? '');
  let displayName = $state('');
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (show && detectedPatterns.length > 0) {
      selectedPattern = detectedPatterns[0];
    }
  });

  async function handleSave() {
    if (!selectedPattern || !displayName.trim()) {
      error = 'Please provide both a site pattern and rule name.';
      return;
    }

    isSaving = true;
    error = null;

    try {
      const userOptions = new Map<string, string | number | boolean>();
      for (const [key, optionData] of options) {
        if (optionData.source === 'user') {
          userOptions.set(key, optionData.value);
        }
      }

      const response = await fetch('/api/site-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_pattern: selectedPattern,
          display_name: displayName.trim(),
          cli_options: Array.from(userOptions.entries()),
          enabled: true,
        }),
      });

      if (response.ok) {
        onSaved();
        displayName = '';
        error = null;
      } else {
        const data = await response.json();
        error = data.error ?? 'Failed to save site rule.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unexpected error occurred.';
    } finally {
      isSaving = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !isSaving) {
      onCancel();
    }
  }

  function getUserOptions(): Array<[string, string | number | boolean]> {
    const userOptions: Array<[string, string | number | boolean]> = [];
    for (const [key, optionData] of options) {
      if (optionData.source === 'user') {
        userOptions.push([key, optionData.value]);
      }
    }
    return userOptions;
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if show}
  <div
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    aria-describedby="modal-description"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div
        class="fixed inset-0 backdrop-blur-xs transition-opacity"
        onclick={onCancel}
        onkeydown={e => e.key === 'Enter' && onCancel()}
        role="button"
        tabindex="-1"
        aria-label="Close modal"
      ></div>

      <div
        class="relative transform overflow-hidden rounded-sm dark:bg-white bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
        transition:scale={{ duration: 150, start: 0.95 }}
      >
        <div class="absolute right-0 top-0 pr-4 pt-4">
          <Button
            onclick={onCancel}
            disabled={isSaving}
            class="rounded-sm dark:bg-white dark:text-gray-400 dark:hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 bg-gray-800 text-gray-500 hover:text-gray-400"
            aria-label="Close"
          >
            <span class="sr-only">Close</span>
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        <div class="sm:flex sm:items-start">
          <div class="mt-3 w-full text-center sm:ml-0 sm:mt-0 sm:text-left">
            <h3
              class="text-lg font-medium leading-6 text-gray-100 dark:text-gray-100"
              id="modal-title"
            >
              <Icon iconName="save" size={20} />
              Save Options as Site Rule
            </h3>

            <div class="mt-4 space-y-4" id="modal-description">
              <div>
                <label
                  for="site-pattern"
                  class="block text-sm font-medium dark:text-gray-100 text-gray-300 mb-1"
                >
                  Site Pattern:
                </label>
                <select
                  id="site-pattern"
                  bind:value={selectedPattern}
                  disabled={isSaving}
                  class="w-full rounded-sm border dark:border-gray-300 border-gray-600 dark:bg-white bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 text-gray-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {#each detectedPatterns as pattern (pattern)}
                    <option value={pattern}>{pattern}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label
                  for="rule-name"
                  class="block text-sm font-medium dark:text-gray-100 text-gray-300 mb-1"
                >
                  Rule Name:
                </label>
                <input
                  id="rule-name"
                  type="text"
                  bind:value={displayName}
                  disabled={isSaving}
                  placeholder="My custom rule"
                  class="w-full rounded-sm border dark:border-gray-300 border-gray-600 dark:bg-white bg-gray-700 px-3 py-2 text-sm dark:text-gray-100 text-gray-100 dark:placeholder-gray-500 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                />
              </div>

              {#if getUserOptions().length > 0}
                <div
                  class="options-preview dark:bg-gray-50 bg-gray-700 rounded-sm p-3 border dark:border-gray-200 border-gray-600"
                >
                  <h4 class="text-sm font-medium dark:text-gray-700 text-gray-300 mb-2">
                    Options to save ({getUserOptions().length}):
                  </h4>
                  <div class="space-y-1 max-h-32 overflow-y-auto">
                    {#each getUserOptions() as [id, value] (id)}
                      <div class="text-xs dark:text-gray-600 text-gray-400 font-mono">
                        {id}: {value}
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
                <div class="text-sm dark:text-gray-500 text-gray-400 italic">
                  No user-selected options to save.
                </div>
              {/if}

              {#if error}
                <div
                  class="dark:bg-red-50 bg-red-900/20 border dark:border-red-200 border-red-700 rounded-sm p-3"
                >
                  <div class="text-sm dark:text-red-600 text-red-400">
                    {error}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="mt-6 flex gap-3 sm:flex-row-reverse">
          <Button
            onclick={handleSave}
            disabled={isSaving ||
              !selectedPattern ||
              !displayName.trim() ||
              getUserOptions().length === 0}
            variant="primary"
            class="w-full sm:w-auto"
          >
            {#if isSaving}
              Saving...
            {:else}
              Save Rule
            {/if}
          </Button>
          <Button
            onclick={onCancel}
            disabled={isSaving}
            variant="secondary"
            class="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
