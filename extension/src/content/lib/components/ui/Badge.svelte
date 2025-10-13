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
  import Icon from '#components/ui/Icon.svelte';

  type BadgeVariant =
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'outline-primary'
    | 'outline-secondary'
    | 'outline-accent'
    | 'outline-success'
    | 'outline-warning'
    | 'outline-danger'
    | 'outline-info';
  type BadgeSize = 'sm' | 'default' | 'lg';

  interface BadgeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    label: string;
    value?: string | number | boolean;
    editable?: boolean;
    dismissible?: boolean;
    variant?: BadgeVariant;
    size?: BadgeSize;
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
  }: BadgeProps = $props();

  let dismissed = $state(false);
  let isEditing = $state(false);
  let editValue = $state('');
  let inputRef = $state<HTMLInputElement>();

  function handleDismiss(): void {
    dismissed = true;
    onDismiss?.();
  }

  function canDisplayValue(
    candidate: string | number | boolean | undefined,
  ): candidate is string | number {
    return candidate !== undefined && candidate !== null && typeof candidate !== 'boolean';
  }

  function startEditing() {
    if (editable && canDisplayValue(value)) {
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
    'font-medium',
    'whitespace-nowrap',
    'transition',
    'duration-150',
    'ease-in-out',
    'gap-2',
  ];

  const sizeClasses: Record<BadgeSize, string[]> = {
    sm: ['badge-sm', 'gap-1.5', 'text-xs'],
    default: [],
    lg: ['badge-lg', 'gap-2', 'text-sm'],
  };

  const variantClasses: Record<BadgeVariant, string[]> = {
    primary: ['badge-primary'],
    secondary: ['badge-secondary'],
    accent: ['badge-accent'],
    success: ['badge-success'],
    warning: ['badge-warning'],
    danger: ['badge-error'],
    info: ['badge-info'],
    'outline-primary': ['badge-outline', 'badge-primary'],
    'outline-secondary': ['badge-outline', 'badge-secondary'],
    'outline-accent': ['badge-outline', 'badge-accent'],
    'outline-success': ['badge-outline', 'badge-success'],
    'outline-warning': ['badge-outline', 'badge-warning'],
    'outline-danger': ['badge-outline', 'badge-error'],
    'outline-info': ['badge-outline', 'badge-info'],
  };

  const computedClasses = $derived(
    [
      'badge',
      ...baseClasses,
      ...sizeClasses[size],
      ...variantClasses[variant],
      dismissed && 'hidden',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const inputSizeClasses: Record<BadgeSize, string> = {
    sm: 'input-xs',
    default: 'input-sm',
    lg: 'input-md',
  };

  const inputClasses = $derived(
    [
      'input',
      'input-ghost',
      inputSizeClasses[size],
      'border-none',
      'outline-none',
      'focus:outline-none',
      'focus:ring-0',
      'text-current',
      'min-w-0',
      'min-h-0',
      'bg-transparent',
      'px-1',
      size === 'sm' ? 'w-16' : size === 'lg' ? 'w-28' : 'w-20',
    ].join(' '),
  );

  const dismissButtonSizeClasses: Record<BadgeSize, string> = {
    sm: 'btn-xs h-6 w-6',
    default: 'btn-xs h-6 w-6',
    lg: 'btn-sm h-7 w-7',
  };

  const dismissButtonClasses = $derived(
    [
      'btn',
      'btn-ghost',
      dismissButtonSizeClasses[size],
      'btn-circle',
      'min-h-0',
      'ml-1',
      'shrink-0',
    ]
      .filter(Boolean)
      .join(' '),
  );

  const hasDisplayableValue = $derived(canDisplayValue(value));

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel ?? `${variant} badge: ${label}`,
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
      <span class="inline-flex items-center">
        {@render icon()}
      </span>
    {/if}

    <span class="font-semibold">{label}</span>
    {#if hasDisplayableValue}
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
          class="link link-hover font-semibold text-inherit"
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
        class={dismissButtonClasses}
        aria-label="Dismiss badge"
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
