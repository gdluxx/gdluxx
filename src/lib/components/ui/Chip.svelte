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
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { Icon } from '$lib/components';

  type ChipVariant =
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'outline-primary'
    | 'outline-success'
    | 'outline-warning'
    | 'outline-danger'
    | 'outline-info';
  type ChipSize = 'sm' | 'default' | 'lg';

  interface ChipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    label: string;
    value?: string | number | boolean;
    editable?: boolean;
    dismissible?: boolean;
    variant?: ChipVariant;
    size?: ChipSize;
    icon?: Snippet;
    class?: string;
    onEdit?: (value: string | number | boolean) => void;
    onDismiss?: () => void;
    ariaLabel?: string;
  }

  const {
    label,
    value,
    editable = false,
    dismissible = true,
    variant = 'primary',
    size = 'default',
    icon,
    class: className = '',
    onEdit,
    onDismiss,
    ariaLabel,
    ...restProps
  }: ChipProps = $props();

  let dismissed = $state(false);
  let isEditing = $state(false);
  let editValue = $state('');
  let inputRef = $state<HTMLInputElement>();

  function handleDismiss(): void {
    dismissed = true;
    onDismiss?.();
  }

  function startEditing() {
    if (editable && value && typeof value !== 'boolean') {
      isEditing = true;
      editValue = String(value);
      // Focus input in next tick
      setTimeout(() => inputRef?.focus(), 0);
    }
  }

  function stopEditing() {
    isEditing = false;
  }

  function handleEditSubmit() {
    if (editValue.trim()) {
      onEdit?.(editValue.trim());
    }
    stopEditing();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      stopEditing();
    }
  }

  const baseClasses = [
    'inline-flex',
    'items-center',
    'gap-1.5',
    'font-medium',
    'transition-all',
    'duration-150',
    'ease-in-out',
    'group',
  ];

  const sizeClasses: Record<ChipSize, string[]> = {
    sm: ['px-2', 'py-0.5', 'text-xs', 'rounded-full'],
    default: ['px-3', 'py-1', 'text-sm', 'rounded-full'],
    lg: ['px-4', 'py-1.5', 'text-base', 'rounded-full'],
  };

  const variantClasses: Record<ChipVariant, string[]> = {
    primary: [
      'bg-primary',
      'text-on-primary',
      'border-primary',
      'hover:bg-primary-hover',
      'hover:border-primary',
    ],
    success: [
      'bg-success',
      'text-on-success',
      'border-success',
      'hover:bg-success-hover',
      'hover:border-success',
    ],
    warning: [
      'bg-surface-selected',
      'text-warning',
      'border-warning',
      'hover:bg-warning/10',
      'hover:border-warning',
    ],
    danger: [
      'bg-input-invalid',
      'text-error',
      'border-error',
      'hover:bg-error/10',
      'hover:border-error',
    ],
    info: [
      'bg-surface-selected',
      'text-info',
      'border-info',
      'hover:bg-info/10',
      'hover:border-info',
    ],
    'outline-primary': [
      'bg-transparent',
      'text-primary',
      'border-primary',
      'hover:bg-primary/10',
      'hover:border-primary',
    ],
    'outline-success': [
      'bg-transparent',
      'text-success',
      'border-success',
      'hover:bg-success/10',
      'hover:border-success',
    ],
    'outline-warning': [
      'bg-transparent',
      'text-warning',
      'border-warning',
      'hover:bg-warning/10',
      'hover:border-warning',
    ],
    'outline-danger': [
      'bg-transparent',
      'text-error',
      'border-error',
      'hover:bg-error/10',
      'hover:border-error',
    ],
    'outline-info': [
      'bg-transparent',
      'text-info',
      'border-info',
      'hover:bg-info/10',
      'hover:border-info',
    ],
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...sizeClasses[size],
      ...variantClasses[variant],
      'border',
      dismissed && 'hidden',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const inputClasses = $derived(
    [
      'bg-transparent',
      'border-none',
      'outline-none',
      'text-current',
      'min-w-0',
      size === 'sm' ? 'w-16' : size === 'lg' ? 'w-24' : 'w-20',
    ].join(' '),
  );

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel ?? `${variant} chip: ${label}`,
    role: 'status',
    'aria-live': 'polite',
  });
</script>

{#if !dismissed}
  <div
    class={computedClasses}
    {...ariaAttributes}
    {...restProps}
  >
    {#if icon}
      <div class="flex-shrink-0">
        {@render icon()}
      </div>
    {/if}

    <span class="font-medium">{label}</span>
    {#if value && typeof value !== 'boolean'}
      {#if isEditing}
        <input
          bind:this={inputRef}
          bind:value={editValue}
          onkeydown={handleKeydown}
          onblur={stopEditing}
          class={inputClasses}
          placeholder="Enter value"
        />
      {:else}
        <button
          type="button"
          class="cursor-pointer border-none bg-transparent p-0 font-medium opacity-80 transition-opacity hover:underline hover:opacity-100"
          onclick={startEditing}
          onkeydown={(e) => e.key === 'Enter' && startEditing()}
          title={editable ? 'Click to edit' : ''}
        >
          {value}
        </button>
      {/if}
    {/if}

    {#if dismissible}
      <button
        onclick={handleDismiss}
        class="-mr-0.5 ml-0.5 flex-shrink-0 cursor-pointer rounded-full p-0.5 opacity-60 transition-all group-hover:opacity-100 hover:bg-surface-hover hover:opacity-100 focus:ring-2 focus:ring-current/20 focus:outline-hidden"
        aria-label="Dismiss chip"
        title="Dismiss"
        type="button"
      >
        <Icon
          iconName="close"
          size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12}
        />
      </button>
    {/if}
  </div>
{/if}
