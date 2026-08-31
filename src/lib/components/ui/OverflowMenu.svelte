<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script
  module
  lang="ts"
>
  export interface OverflowMenuItem {
    label: string;
    onSelect: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { Button, Spinner } from '$lib/components/ui';
  import { Icon } from '$lib/components';

  interface Props {
    items: OverflowMenuItem[];
    ariaLabel: string;
    busy?: boolean;
  }

  const { items, ariaLabel, busy = false }: Props = $props();

  const uid = $props.id();
  const triggerId = `overflow-menu-trigger-${uid}`;
  const menuId = `overflow-menu-${uid}`;

  let open = $state(false);
  let flipUp = $state(false);

  let rootEl: HTMLDivElement | undefined = $state();
  let panelEl: HTMLDivElement | undefined = $state();
  const itemEls: Array<HTMLButtonElement | undefined> = $state([]);

  const firstDangerIndex = $derived(items.findIndex((item) => item.variant === 'danger'));

  const panelClasses = $derived(
    [
      'absolute right-0 z-20 rounded-overlay border-strong bg-surface-elevated p-1 shadow-floating',
      flipUp ? 'bottom-full mb-1' : 'mt-1',
    ].join(' '),
  );

  function itemClasses(item: OverflowMenuItem): string {
    return [
      'flex w-full items-center rounded-control px-3 text-left text-sm transition-colors duration-fast',
      'min-h-11 @2xl:min-h-8',
      'focus:bg-surface-hover',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
      item.variant === 'danger'
        ? 'text-error hover:bg-error/10'
        : 'text-foreground hover:bg-surface-hover',
    ].join(' ');
  }

  function currentIndex(): number {
    return itemEls.findIndex((el) => el === document.activeElement);
  }

  function focusIndex(index: number): void {
    itemEls[index]?.focus();
  }

  function focusFirst(): void {
    const index = items.findIndex((item) => !item.disabled);
    if (index !== -1) {
      focusIndex(index);
    }
  }

  function focusLast(): void {
    for (let i = items.length - 1; i >= 0; i--) {
      if (!items[i].disabled) {
        focusIndex(i);
        return;
      }
    }
  }

  function moveActive(delta: number): void {
    const len = items.length;
    if (len === 0) {
      return;
    }
    let index = currentIndex();
    for (let step = 0; step < len; step++) {
      index = (index + delta + len) % len;
      if (!items[index].disabled) {
        focusIndex(index);
        return;
      }
    }
  }

  function computeFlip(): void {
    const trigger = document.getElementById(triggerId);
    if (!trigger) {
      flipUp = false;
      return;
    }
    const estimatedPanelHeight = items.length * 40 + 16;
    flipUp = trigger.getBoundingClientRect().bottom + estimatedPanelHeight > window.innerHeight;
  }

  function openMenu(): void {
    if (open) {
      return;
    }
    computeFlip();
    open = true;
    setTimeout(() => {
      focusFirst();
      panelEl?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  function closeMenu(opts: { refocusTrigger?: boolean } = {}): void {
    if (!open) {
      return;
    }
    open = false;
    if (opts.refocusTrigger) {
      document.getElementById(triggerId)?.focus();
    }
  }

  function selectItem(item: OverflowMenuItem): void {
    if (item.disabled) {
      return;
    }

    closeMenu({ refocusTrigger: true });
    item.onSelect();
  }

  function handleTriggerClick(): void {
    if (open) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu();
    }
  }

  function handleMenuKeydown(event: KeyboardEvent): void {
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
        focusFirst();
        break;
      case 'End':
        event.preventDefault();
        focusLast();
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu({ refocusTrigger: true });
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  }

  $effect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (rootEl && event.target instanceof Node && !rootEl.contains(event.target)) {
        closeMenu();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  });

  function handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (rootEl && (!next || !rootEl.contains(next))) {
      closeMenu();
    }
  }
</script>

<div
  bind:this={rootEl}
  class="relative"
  onfocusout={handleFocusOut}
>
  <Button
    id={triggerId}
    variant="default"
    size="sm"
    icon
    {ariaLabel}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={menuId}
    aria-busy={busy}
    class="h-11 w-11 @2xl:h-8 @2xl:w-8"
    onclick={handleTriggerClick}
    onkeydown={handleTriggerKeydown}
  >
    {#if busy}
      <Spinner size={16} />
    {:else}
      <Icon
        iconName="more-vertical"
        size={18}
      />
    {/if}
  </Button>

  {#if open}
    <div
      bind:this={panelEl}
      id={menuId}
      role="menu"
      tabindex="-1"
      aria-labelledby={triggerId}
      class={panelClasses}
      onkeydown={handleMenuKeydown}
    >
      {#each items as item, i (item.label)}
        {#if i === firstDangerIndex && firstDangerIndex > 0}
          <div
            role="separator"
            class="my-1 border-t border-strong"
          ></div>
        {/if}
        <button
          type="button"
          bind:this={itemEls[i]}
          role="menuitem"
          tabindex="-1"
          disabled={item.disabled}
          class={itemClasses(item)}
          onclick={() => selectItem(item)}
          onmouseenter={() => !item.disabled && focusIndex(i)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
