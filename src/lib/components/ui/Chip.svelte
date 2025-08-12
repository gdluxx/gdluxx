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
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'outline-primary'
    | 'outline-secondary'
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
      'bg-primary-100',
      'text-primary-800',
      'border-primary-200',
      'hover:bg-primary-200',
      'dark:bg-primary-900',
      'dark:text-primary-200',
      'dark:border-primary-800',
      'dark:hover:bg-primary-800',
    ],
    secondary: [
      'bg-secondary-100',
      'text-secondary-800',
      'border-secondary-200',
      'hover:bg-secondary-200',
      'dark:bg-secondary-900',
      'dark:text-secondary-200',
      'dark:border-secondary-800',
      'dark:hover:bg-secondary-800',
    ],
    success: [
      'bg-success-100',
      'text-success-900',
      'border-success-250',
      'hover:bg-success-250',
      'dark:bg-success-900',
      'dark:text-success-100',
      'dark:border-success-750',
      'dark:hover:bg-success-750',
    ],
    warning: [
      'bg-warning-100',
      'text-warning-900',
      'border-warning-250',
      'hover:bg-warning-250',
      'dark:bg-warning-900',
      'dark:text-warning-100',
      'dark:border-warning-750',
      'dark:hover:bg-warning-750',
    ],
    danger: [
      'bg-error-100',
      'text-error-900',
      'border-error-250',
      'hover:bg-error-250',
      'dark:bg-error-900',
      'dark:text-error-100',
      'dark:border-error-750',
      'dark:hover:bg-error-750',
    ],
    info: [
      'bg-info-100',
      'text-info-900',
      'border-info-250',
      'hover:bg-info-250',
      'dark:bg-info-900',
      'dark:text-info-100',
      'dark:border-info-750',
      'dark:hover:bg-info-750',
    ],
    'outline-primary': [
      'bg-transparent',
      'text-primary-700',
      'border-primary-300',
      'hover:bg-primary-50',
      'hover:border-primary-400',
      'dark:text-primary-300',
      'dark:border-primary-600',
      'dark:hover:bg-primary-950',
      'dark:hover:border-primary-500',
    ],
    'outline-secondary': [
      'bg-transparent',
      'text-secondary-700',
      'border-secondary-300',
      'hover:bg-secondary-50',
      'hover:border-secondary-400',
      'dark:text-secondary-300',
      'dark:border-secondary-600',
      'dark:hover:bg-secondary-950',
      'dark:hover:border-secondary-500',
    ],
    'outline-success': [
      'bg-transparent',
      'text-success-750',
      'border-success-500',
      'hover:bg-success-50',
      'hover:border-success-600',
      'dark:text-success-400',
      'dark:border-success-600',
      'dark:hover:bg-success-950',
      'dark:hover:border-success-500',
    ],
    'outline-warning': [
      'bg-transparent',
      'text-warning-750',
      'border-warning-500',
      'hover:bg-warning-50',
      'hover:border-warning-600',
      'dark:text-warning-400',
      'dark:border-warning-600',
      'dark:hover:bg-warning-950',
      'dark:hover:border-warning-500',
    ],
    'outline-danger': [
      'bg-transparent',
      'text-error-750',
      'border-error-500',
      'hover:bg-error-50',
      'hover:border-error-600',
      'dark:text-error-400',
      'dark:border-error-600',
      'dark:hover:bg-error-950',
      'dark:hover:border-error-500',
    ],
    'outline-info': [
      'bg-transparent',
      'text-info-750',
      'border-info-500',
      'hover:bg-info-50',
      'hover:border-info-600',
      'dark:text-info-400',
      'dark:border-info-600',
      'dark:hover:bg-info-950',
      'dark:hover:border-info-500',
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
      .join(' ')
  );

  const inputClasses = $derived(
    [
      'bg-transparent',
      'border-none',
      'outline-none',
      'text-current',
      'min-w-0',
      size === 'sm' ? 'w-16' : size === 'lg' ? 'w-24' : 'w-20',
    ].join(' ')
  );

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel ?? `${variant} chip: ${label}`,
    role: 'status',
    'aria-live': 'polite',
  });
</script>

{#if !dismissed}
  <div class={computedClasses} {...ariaAttributes} {...restProps}>
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
          class="font-medium opacity-80 hover:opacity-100 hover:underline bg-transparent border-none p-0 cursor-pointer transition-opacity"
          onclick={startEditing}
          onkeydown={e => e.key === 'Enter' && startEditing()}
          title={editable ? 'Click to edit' : ''}
        >
          {value}
        </button>
      {/if}
    {/if}

    {#if dismissible}
      <button
        onclick={handleDismiss}
        class="opacity-60 group-hover:opacity-100 hover:opacity-100 transition-all flex-shrink-0 ml-0.5 p-0.5 -mr-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 focus:outline-hidden focus:ring-2 focus:ring-current/20"
        aria-label="Dismiss chip"
        title="Dismiss"
        type="button"
      >
        <Icon iconName="close" size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />
      </button>
    {/if}
  </div>
{/if}
