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
  lang="ts"
  module
>
  export type DropdownOption<T = string> = {
    value: T;
    label: string;
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  type BaseButtonVariant =
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'neutral'
    | 'ghost'
    | 'link'
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

  type OutlineButtonVariant = `${BaseButtonVariant}-outline`;
  type ButtonVariant = BaseButtonVariant | OutlineButtonVariant;

  interface DropdownProps<T = string> {
    options: DropdownOption<T>[];
    selected: T;
    onSelect: (value: T) => void;
    placeholder?: string;
    width?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: ButtonVariant;
    outline?: boolean;
    disabled?: boolean;
    class?: string;
  }

  let {
    options,
    selected,
    onSelect,
    placeholder = 'Select...',
    width = 'w-full',
    size = 'sm',
    variant,
    outline = false,
    disabled = false,
    class: className = '',
  }: DropdownProps = $props();

  let detailsRef = $state<HTMLDetailsElement | null>(null);
  let isOpen = $state(false);

  const listboxId = $derived(`dropdown-listbox-${Math.random().toString(36).slice(2, 11)}`);

  const selectedOption = $derived(options.find((opt) => opt.value === selected));

  const resolvedVariant = $derived(() => {
    if (!variant) return undefined;
    if (variant.endsWith('-outline')) {
      return variant.replace('-outline', '') as BaseButtonVariant;
    }
    return variant as BaseButtonVariant;
  });

  const isOutline = $derived(outline || (variant && variant.endsWith('-outline')));

  const isCustomWidth = $derived(
    width.includes('px') || width.includes('rem') || width.includes('%'),
  );

  function handleSelect(value: typeof selected) {
    if (disabled) return;
    onSelect(value);
    if (detailsRef) {
      detailsRef.open = false;
      isOpen = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        if (detailsRef) {
          detailsRef.open = false;
          isOpen = false;
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (detailsRef && detailsRef.open) {
          const items = detailsRef.querySelectorAll('button[role="option"]');
          const activeIndex = Array.from(items || []).findIndex(
            (el) => el === document.activeElement,
          );
          const nextIndex = activeIndex < (items?.length || 0) - 1 ? activeIndex + 1 : 0;
          (items?.[nextIndex] as HTMLElement)?.focus();
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (detailsRef && detailsRef.open) {
          const items = detailsRef.querySelectorAll('button[role="option"]');
          const activeIndex = Array.from(items || []).findIndex(
            (el) => el === document.activeElement,
          );
          const prevIndex = activeIndex > 0 ? activeIndex - 1 : (items?.length || 0) - 1;
          (items?.[prevIndex] as HTMLElement)?.focus();
        }
        break;
    }
  }

  $effect(() => {
    if (!isOpen || !detailsRef) return;

    function handleClickOutside(event: Event) {
      if (detailsRef && !detailsRef.contains(event.target as Node)) {
        detailsRef.open = false;
        isOpen = false;
      }
    }

    const shadowRoot = detailsRef.getRootNode();
    const eventTarget = shadowRoot instanceof ShadowRoot ? shadowRoot : document;

    const timeoutId = setTimeout(() => {
      eventTarget.addEventListener('click', handleClickOutside, { capture: true });
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      eventTarget.removeEventListener('click', handleClickOutside, { capture: true });
    };
  });
</script>

<details
  bind:this={detailsRef}
  class="dropdown {isCustomWidth ? '' : width}"
  class:opacity-50={disabled}
  style={isCustomWidth ? `width: ${width}` : ''}
  ontoggle={() => (isOpen = !!detailsRef?.open)}
>
  <summary
    class="btn btn-{size} {resolvedVariant() ? `btn-${resolvedVariant()}` : ''} {isOutline
      ? 'btn-outline'
      : ''} w-full justify-between gap-2 {className}"
    onkeydown={handleKeydown}
  >
    <span class="truncate">{selectedOption?.label ?? placeholder}</span>
    <Icon
      iconName="chevron-down"
      size={16}
      class="flex-shrink-0 transition-transform"
    />
  </summary>

  <ul
    id={listboxId}
    role="listbox"
    tabindex="-1"
    class="dropdown-content menu rounded-box bg-base-100 z-[9999] w-full p-2 shadow-lg"
  >
    {#each options as option (option.value)}
      <li class:disabled={option.disabled}>
        <button
          type="button"
          role="option"
          aria-selected={option.value === selected}
          class:active={option.value === selected}
          disabled={option.disabled}
          onclick={() => handleSelect(option.value)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelect(option.value);
            }
          }}
        >
          {option.label}
        </button>
      </li>
    {/each}
  </ul>
</details>
