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
  import type { CatalogOption, CatalogSite } from '$lib/types/catalog';
  import { buildSiteChoices, filterSiteChoices, type SiteChoice } from '$lib/utils/catalogFilter';

  interface Props {
    sites: CatalogSite[];
    options: CatalogOption[];
    value: string;
    onChange: (value: string) => void;
  }

  const { sites, options, value, onChange }: Props = $props();

  const uid = $props.id();
  const listboxId = `site-picker-listbox-${uid}`;
  const inputId = `site-picker-filter-${uid}`;

  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(-1);
  let triggerWidth = $state(0);

  let rootEl: HTMLDivElement | undefined = $state();
  let triggerEl: HTMLButtonElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();
  const optionEls: Array<HTMLLIElement | undefined> = $state([]);

  const choices = $derived(buildSiteChoices(sites, options));
  const filteredChoices = $derived(filterSiteChoices(choices, query));
  const selected = $derived(choices.find((choice) => choice.value === value));
  const triggerLabel = $derived(selected?.name ?? 'All sites');

  const activeOptionId = $derived(
    open && activeIndex >= 0 && activeIndex < filteredChoices.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined,
  );

  const PANEL_MIN_WIDTH = 288;
  const panelMinWidth = $derived(Math.max(triggerWidth, PANEL_MIN_WIDTH));

  function scrollActiveIntoView() {
    optionEls[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function openPanel() {
    if (open) {
      return;
    }
    open = true;
    query = '';
    const currentIndex = choices.findIndex((choice) => choice.value === value);
    activeIndex = currentIndex >= 0 ? currentIndex : 0;

    setTimeout(() => inputEl?.focus(), 0);
  }

  function closePanel(opts: { refocusTrigger?: boolean } = {}) {
    if (!open) {
      return;
    }
    open = false;
    query = '';
    activeIndex = -1;
    if (opts.refocusTrigger) {
      triggerEl?.focus();
    }
  }

  function selectChoice(choice: SiteChoice) {
    onChange(choice.value);
    closePanel({ refocusTrigger: true });
  }

  function moveActive(delta: number) {
    const len = filteredChoices.length;
    if (len === 0) {
      activeIndex = -1;
      return;
    }
    if (activeIndex < 0) {
      activeIndex = delta > 0 ? 0 : len - 1;
    } else {
      activeIndex = (activeIndex + delta + len) % len;
    }
    scrollActiveIntoView();
  }

  function handleTriggerClick() {
    if (open) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPanel();
    }
  }

  function handleQueryInput(event: Event) {
    const next = (event.target as HTMLInputElement).value;
    query = next;
    const filtered = filterSiteChoices(choices, next);
    activeIndex = filtered.length > 0 ? 0 : -1;
  }

  function handleInputKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        activeIndex = filteredChoices.length > 0 ? 0 : -1;
        scrollActiveIntoView();
        break;
      case 'End':
        event.preventDefault();
        activeIndex = filteredChoices.length - 1;
        scrollActiveIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredChoices.length) {
          selectChoice(filteredChoices[activeIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closePanel({ refocusTrigger: true });
        break;
    }
  }

  $effect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (rootEl && event.target instanceof Node && !rootEl.contains(event.target)) {
        closePanel();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  });

  function handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (rootEl && (!next || !rootEl.contains(next))) {
      closePanel();
    }
  }
</script>

<div
  bind:this={rootEl}
  class="relative"
  onfocusout={handleFocusOut}
>
  <button
    type="button"
    bind:this={triggerEl}
    bind:clientWidth={triggerWidth}
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-activedescendant={activeOptionId}
    aria-label="Filter by site"
    class="form-select max-w-[210px] truncate text-left text-sm"
    onclick={handleTriggerClick}
    onkeydown={handleTriggerKeydown}
  >
    {triggerLabel}
  </button>

  {#if open}
    <div
      class="absolute right-0 z-20 mt-1 max-w-[24rem] rounded-md border border-strong bg-surface-elevated p-1 shadow-lg"
      style:min-width="{panelMinWidth}px"
    >
      <input
        bind:this={inputEl}
        id={inputId}
        type="text"
        value={query}
        oninput={handleQueryInput}
        onkeydown={handleInputKeydown}
        placeholder="Filter sites…"
        aria-label="Filter sites by name or key"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autocomplete="off"
        class="form-input text-sm"
      />

      <ul
        id={listboxId}
        role="listbox"
        aria-label="Sites"
        class="mt-1 max-h-80 space-y-0.5 overflow-y-auto"
      >
        {#if filteredChoices.length === 0}
          <li class="px-3 py-2 text-sm text-muted-foreground">No sites match</li>
        {:else}
          {#each filteredChoices as choice, i (choice.value)}
            <!-- Keyboard selection is handled on the filter input above
                 This <li> is never itself focused so it has no
                 keydown of its own. -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <li
              bind:this={optionEls[i]}
              id="{listboxId}-option-{i}"
              role="option"
              aria-selected={choice.value === value}
              class="flex cursor-pointer items-center rounded-sm px-3 py-1.5 text-sm text-foreground"
              class:bg-surface-hover={i === activeIndex}
              onmousedown={(event) => event.preventDefault()}
              onclick={() => selectChoice(choice)}
              onmouseenter={() => (activeIndex = i)}
            >
              <span class="min-w-0 flex-1 truncate">
                {choice.name}{#if choice.key}<span class="text-xs text-muted-foreground"
                    >&nbsp;— {choice.key}</span
                  >{/if}
              </span>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  {/if}
</div>
