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
    disabled?: boolean;
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
    dismissible = false,
    disabled = false,
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
    if (disabled) {
      return;
    }

    dismissed = true;
    onDismiss?.();
  }

  function startEditing() {
    if (!disabled && editable && value && typeof value !== 'boolean') {
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
    if (disabled) {
      stopEditing();
      return;
    }

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
    'duration-fast',
    'ease-in-out',
    'group',
  ];

  const sizeClasses: Record<ChipSize, string[]> = {
    sm: ['px-2', 'py-0.5', 'text-xs', 'rounded-pill'],
    default: ['px-3', 'py-1', 'text-sm', 'rounded-pill'],
    lg: ['px-4', 'py-1.5', 'text-base', 'rounded-pill'],
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
    warning: ['bg-warning/10', 'text-foreground', 'border-warning'],
    danger: ['bg-error/10', 'text-foreground', 'border-error'],
    info: ['bg-info/10', 'text-foreground', 'border-info'],
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

  const disabledClasses = ['bg-surface-disabled', 'text-disabled', 'border-border'];

  const tintIconClasses: Partial<Record<ChipVariant, string>> = {
    warning: 'text-warning',
    danger: 'text-error',
    info: 'text-info',
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...sizeClasses[size],
      ...(disabled ? disabledClasses : variantClasses[variant]),
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
      'text-current',
      'min-w-0',
      size === 'sm' ? 'w-16' : size === 'lg' ? 'w-24' : 'w-20',
    ].join(' '),
  );

  const iconClasses = $derived(
    ['flex-shrink-0', disabled ? 'text-disabled' : tintIconClasses[variant]]
      .filter(Boolean)
      .join(' '),
  );

  const editButtonClasses = $derived(
    [
      'border-none',
      'bg-transparent',
      'p-0',
      'font-medium',
      'transition-opacity',
      disabled
        ? 'cursor-not-allowed'
        : 'cursor-pointer opacity-80 hover:underline hover:opacity-100',
    ].join(' '),
  );

  const dismissButtonClasses = $derived(
    [
      '-mr-1',
      'ml-0.5',
      'flex',
      'h-6',
      'w-6',
      'flex-shrink-0',
      'items-center',
      'justify-center',
      'rounded-full',
      'transition-all',
      disabled
        ? 'cursor-not-allowed'
        : 'cursor-pointer opacity-60 group-hover:opacity-100 hover:bg-surface-hover hover:opacity-100',
    ].join(' '),
  );

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel ?? `${variant} chip: ${label}`,
    'aria-disabled': disabled ? 'true' : undefined,
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
      <div class={iconClasses}>
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
          {disabled}
        />
      {:else}
        <button
          type="button"
          class={editButtonClasses}
          onclick={startEditing}
          onkeydown={(e) => e.key === 'Enter' && startEditing()}
          title={editable ? 'Click to edit' : ''}
          {disabled}
        >
          {value}
        </button>
      {/if}
    {/if}

    {#if dismissible}
      <button
        onclick={handleDismiss}
        class={dismissButtonClasses}
        aria-label="Dismiss chip"
        title="Dismiss"
        type="button"
        {disabled}
      >
        <Icon
          iconName="close"
          size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12}
        />
      </button>
    {/if}
  </div>
{/if}
