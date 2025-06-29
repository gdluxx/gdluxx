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
  import type { OptionCategory } from '$lib/types/options';

  interface Props {
    isOpen: boolean;
    category: OptionCategory;
    selectedIds: Set<string>;
    onClose: () => void;
    onApply: (selected: Set<string>) => void;
  }

  const { isOpen, category, selectedIds, onClose, onApply }: Props = $props();

  let localSelected = $state(new Set<string>());
  let hoveredOption = $state<string | null>(null);
  let tooltipPosition = $state({ x: 0, y: 0 });

  $effect(() => {
    if (isOpen) {
      localSelected = new Set(selectedIds);
    }
  });

  function toggleOption(optionId: string) {
    if (localSelected.has(optionId)) {
      localSelected.delete(optionId);
    } else {
      localSelected.add(optionId);
    }
    localSelected = new Set(localSelected);
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
    onApply(new Set(localSelected));
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
            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800"
            >
              <input
                type="checkbox"
                checked={localSelected.has(option.id)}
                onchange={() => toggleOption(option.id)}
                class="mt-1 h-4 w-4 rounded border-secondary-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-secondary-600 dark:bg-secondary-700 dark:focus:ring-primary-400"
              />
              <div class="flex-1">
                <span class="font-medium text-secondary-900 dark:text-secondary-100">
                  {option.command}
                </span>
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
            </label>
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
