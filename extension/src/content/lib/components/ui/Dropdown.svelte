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

  let isOpen = $state(false);
  let dropdownRef = $state<HTMLDivElement | null>(null);

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
    isOpen = false;
  }

  function handleToggle() {
    if (disabled) return;
    isOpen = !isOpen;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        isOpen = false;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        isOpen = !isOpen;
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          isOpen = true;
        } else {
          const items = dropdownRef?.querySelectorAll('button[role="option"]');
          const activeIndex = Array.from(items || []).findIndex(
            (el) => el === document.activeElement,
          );
          const nextIndex = activeIndex < (items?.length || 0) - 1 ? activeIndex + 1 : 0;
          (items?.[nextIndex] as HTMLElement)?.focus();
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          const items = dropdownRef?.querySelectorAll('button[role="option"]');
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
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        isOpen = false;
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div
  bind:this={dropdownRef}
  class="dropdown {isOpen ? 'dropdown-open' : ''} {isCustomWidth ? '' : width}"
  class:opacity-50={disabled}
  style={isCustomWidth ? `width: ${width}` : ''}
>
  <button
    type="button"
    tabindex="0"
    role="combobox"
    aria-expanded={isOpen}
    aria-controls={listboxId}
    aria-haspopup="listbox"
    aria-disabled={disabled}
    class="btn btn-{size} {resolvedVariant() ? `btn-${resolvedVariant()}` : ''} {isOutline
      ? 'btn-outline'
      : ''} w-full justify-between gap-2 {className}"
    onclick={handleToggle}
    onkeydown={handleKeydown}
    {disabled}
  >
    <span class="truncate">{selectedOption?.label ?? placeholder}</span>
    <Icon
      iconName="chevron-down"
      size={16}
      class="flex-shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
    />
  </button>

  <ul
    id={listboxId}
    role="listbox"
    tabindex="-1"
    class="dropdown-content menu rounded-box bg-base-100 z-[1] w-full p-2 shadow-lg"
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
</div>
