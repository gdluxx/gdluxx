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
  import { Button, Modal } from '$lib/components/ui';
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

  let selectedPattern = $state('');
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
      const userOptions: Array<[string, string | number | boolean]> = [];
      for (const [key, optionData] of options) {
        if (optionData.source === 'user') {
          userOptions.push([key, optionData.value]);
        }
      }

      const response = await fetch('/api/site-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_pattern: selectedPattern,
          display_name: displayName.trim(),
          cli_options: userOptions,
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

  // Escape, backdrop-click and the Modal close button all cancel, but never
  // while a save is in flight
  function handleClose() {
    if (!isSaving) {
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

<Modal
  {show}
  size="md"
  onClose={handleClose}
>
  <div class="px-4 pt-5 pb-4 text-left sm:p-6">
    <div class="sm:flex sm:items-start">
      <div class="mt-3 w-full text-center sm:mt-0 sm:ml-0 sm:text-left">
        <h3
          class="pr-8 text-lg leading-6 font-medium text-foreground"
          id="modal-title"
        >
          <Icon
            iconName="save"
            size={20}
          />
          Save Options as Site Rule
        </h3>

        <div
          class="mt-4 space-y-4"
          id="modal-description"
        >
          <div>
            <label
              for="site-pattern"
              class="mb-1 block text-sm font-medium text-foreground"
            >
              Site Pattern:
            </label>
            <select
              id="site-pattern"
              bind:value={selectedPattern}
              disabled={isSaving}
              class="bg-input w-full rounded-sm border px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
            >
              {#each detectedPatterns as pattern (pattern)}
                <option value={pattern}>{pattern}</option>
              {/each}
            </select>
          </div>

          <div>
            <label
              for="rule-name"
              class="mb-1 block text-sm font-medium text-foreground"
            >
              Rule Name:
            </label>
            <input
              id="rule-name"
              type="text"
              bind:value={displayName}
              disabled={isSaving}
              placeholder="My custom rule"
              class="bg-input w-full rounded-sm border px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
            />
          </div>

          {#if getUserOptions().length > 0}
            <div class="options-preview rounded-sm border bg-primary/10 p-3">
              <h4 class="mb-2 text-sm font-medium text-foreground">
                Options to save ({getUserOptions().length}):
              </h4>
              <div class="max-h-32 space-y-1 overflow-y-auto">
                {#each getUserOptions() as [id, value] (id)}
                  <div class="font-mono text-xs text-foreground">
                    {id}: {value}
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="text-sm text-foreground italic">No user-selected options to save.</div>
          {/if}

          {#if error}
            <div class="-error rounded-sm bg-error/50 p-3">
              <div class="text-sm text-error">
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
        class="w-full sm:w-auto"
      >
        Cancel
      </Button>
    </div>
  </div>
</Modal>
