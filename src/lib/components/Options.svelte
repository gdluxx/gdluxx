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
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { Option, OptionCategory } from '$lib/types/options';

  type SelectedOptions = Map<string, string | number | boolean>;

  interface Props {
    isOpen: boolean;
    category: OptionCategory;
    selectedOptions?: SelectedOptions;
    selectedIds?: Set<string>;
    onClose: () => void;
    onApply: (selected: SelectedOptions | Set<string>) => void;
  }

  const { isOpen, category, selectedOptions, selectedIds, onClose, onApply }: Props = $props();

  let localSelected = $state<SelectedOptions>(new Map());
  let hoveredOption = $state<string | null>(null);
  let tooltipPosition = $state({ x: 0, y: 0 });
  let validationErrors = $state<Map<string, string>>(new Map());

  $effect(() => {
    if (isOpen) {
      if (selectedOptions) {
        // CommandForm usage - Map of option values
        localSelected = new Map(selectedOptions);
      } else if (selectedIds) {
        // Options page usage - Set of option IDs
        localSelected = new Map();
        selectedIds.forEach(id => {
          const option = category.options.find(opt => opt.id === id);
          if (option) {
            localSelected.set(id, option.defaultValue ?? true);
          }
        });
      } else {
        localSelected = new Map();
      }
    }
  });

  function toggleOption(option: Option) {
    const { id, defaultValue } = option;
    if (localSelected.has(id)) {
      localSelected.delete(id);
    } else {
      localSelected.set(id, defaultValue ?? true);
    }
    localSelected = new Map(localSelected);
  }

  function validateOptionValue(
    option: Option,
    value: unknown
  ): { valid: boolean; sanitized?: string | number | boolean; error?: string } {
    if (option.type === 'boolean') {
      return { valid: true, sanitized: Boolean(value) };
    }

    if (option.type === 'number') {
      const num = Number(value);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, error: 'Please enter a valid number' };
      }
      return { valid: true, sanitized: num };
    }

    if (option.type === 'string' || option.type === 'range') {
      const str = String(value).trim();
      if (str.length === 0) {
        return { valid: false, error: 'This field cannot be empty' };
      }
      // Basic sanitization - prevent command injection
      if (str.includes(';') || str.includes('|') || str.includes('&') || str.includes('`')) {
        return { valid: false, error: 'Invalid characters detected' };
      }
      return { valid: true, sanitized: str };
    }

    return { valid: false, error: 'Unknown option type' };
  }

  function updateOptionValue(optionId: string, value: string | number) {
    if (localSelected.has(optionId)) {
      const option = category.options.find(opt => opt.id === optionId);
      if (option) {
        const validation = validateOptionValue(option, value);
        if (validation.valid) {
          if (validation.sanitized !== undefined) {
            localSelected.set(optionId, validation.sanitized);
            localSelected = new Map(localSelected);
          }
          // Clear any existing error
          validationErrors.delete(optionId);
          validationErrors = new Map(validationErrors);
        } else {
          // Set validation error
          validationErrors.set(optionId, validation.error ?? 'Invalid value');
          validationErrors = new Map(validationErrors);
        }
      }
    }
  }

  function handleMouseEnter(event: MouseEvent, optionId: string) {
    hoveredOption = optionId;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipPosition = {
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    };
  }

  function handleMouseLeave() {
    hoveredOption = null;
  }

  function handleApply() {
    if (selectedOptions) {
      // CommandForm usage - return Map
      onApply(new Map(localSelected));
    } else {
      // Options page usage - return Set of IDs
      onApply(new Set(localSelected.keys()));
    }
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
    onclick={handleBackdropClick}
    onkeydown={e => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
  >
    <div
      class="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-secondary-900"
      transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}
    >
      <!-- Header -->
      <div class="border-b border-secondary-200 px-6 py-4 dark:border-secondary-700">
        <h2 class="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
          {category.title}
        </h2>
      </div>

      <!-- Content -->
      <div class="max-h-[60vh] overflow-y-auto px-6 py-4">
        <div class="space-y-3">
          {#each category.options as option (option.id)}
            <div
              class="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800"
            >
              <input
                type="checkbox"
                id="option-{option.id}"
                checked={localSelected.has(option.id)}
                onchange={() => toggleOption(option)}
                class="mt-1 h-4 w-4 rounded border-secondary-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-700 dark:focus:ring-primary-400"
              />
              <div class="flex-1">
                <label for="option-{option.id}" class="cursor-pointer">
                  <span class="font-medium text-secondary-900 dark:text-secondary-100">
                    {option.command}
                  </span>
                </label>
                {#if localSelected.has(option.id) && option.type !== 'boolean'}
                  <div class="mt-2">
                    {#if option.type === 'string'}
                      <input
                        type="text"
                        placeholder={option.placeholder}
                        value={localSelected.get(option.id)}
                        oninput={e => updateOptionValue(option.id, e.currentTarget.value)}
                        class="w-full rounded-md border-secondary-300 bg-white px-3 py-2 text-secondary-900 focus:border-primary-500 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-800 dark:text-secondary-100 {validationErrors.has(
                          option.id
                        )
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : ''}"
                      />
                      {#if validationErrors.has(option.id)}
                        <div class="mt-1 text-sm text-red-600 dark:text-red-400">
                          {validationErrors.get(option.id)}
                        </div>
                      {/if}
                    {:else if option.type === 'number'}
                      <input
                        type="number"
                        placeholder={option.placeholder}
                        value={localSelected.get(option.id)}
                        oninput={e => updateOptionValue(option.id, e.currentTarget.valueAsNumber)}
                        class="w-full rounded-md border-secondary-300 bg-white px-3 py-2 text-secondary-900 focus:border-primary-500 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-800 dark:text-secondary-100 {validationErrors.has(
                          option.id
                        )
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : ''}"
                      />
                      {#if validationErrors.has(option.id)}
                        <div class="mt-1 text-sm text-red-600 dark:text-red-400">
                          {validationErrors.get(option.id)}
                        </div>
                      {/if}
                    {:else if option.type === 'range'}
                      <input
                        type="text"
                        placeholder={option.placeholder}
                        value={localSelected.get(option.id)}
                        oninput={e => updateOptionValue(option.id, e.currentTarget.value)}
                        class="w-full rounded-md border-secondary-300 bg-white px-3 py-2 text-secondary-900 focus:border-primary-500 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-800 dark:text-secondary-100 {validationErrors.has(
                          option.id
                        )
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : ''}"
                      />
                      {#if validationErrors.has(option.id)}
                        <div class="mt-1 text-sm text-red-600 dark:text-red-400">
                          {validationErrors.get(option.id)}
                        </div>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>
              <button
                type="button"
                class="relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-secondary-200 transition-colors hover:bg-secondary-300 dark:bg-secondary-700 dark:hover:bg-secondary-600"
                onmouseenter={e => handleMouseEnter(e, option.id)}
                onmouseleave={handleMouseLeave}
                onclick={e => e.preventDefault()}
              >
                <span class="text-xs text-secondary-600 dark:text-secondary-400">?</span>
              </button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex justify-end gap-3 border-t border-secondary-200 px-6 py-4 dark:border-secondary-700"
      >
        <button
          onclick={onClose}
          class="cursor-pointer rounded-md px-4 py-2 text-secondary-700 transition-colors hover:bg-secondary-100 hover:text-secondary-800 dark:text-secondary-300 dark:hover:bg-secondary-800 dark:hover:text-secondary-200"
        >
          Close
        </button>
        <button
          onclick={handleApply}
          class="cursor-pointer rounded-md bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"
        >
          Apply Options
        </button>
      </div>
    </div>

    <!-- Tooltip -->
    {#if hoveredOption}
      {@const option = category.options.find(o => o.id === hoveredOption)}
      {#if option}
        <div
          class="pointer-events-none fixed z-60 max-w-sm rounded-lg bg-secondary-900 p-3 text-sm text-secondary-100 shadow-lg dark:bg-secondary-100 dark:text-secondary-900"
          style:left="{tooltipPosition.x}px"
          style:top="{tooltipPosition.y}px"
          style:transform="translateY(-50%)"
          transition:fade={{ duration: 150 }}
        >
          <div class="mb-1 font-medium">{option.command}</div>
          <div class="text-secondary-300 dark:text-secondary-700">{option.description}</div>
          <div
            class="absolute top-1/2 -left-2 h-0 w-0 -translate-y-1/2 border-t-8 border-r-8 border-b-8 border-t-transparent border-r-secondary-900 border-b-transparent dark:border-r-secondary-100"
          ></div>
        </div>
      {/if}
    {/if}
  </div>
{/if}
