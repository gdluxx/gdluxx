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

  type InfoVariant = 'success' | 'warning' | 'error' | 'info';
  type InfoSize = 'sm' | 'default' | 'lg';

  interface InfoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    children?: Snippet;
    class?: string;
    variant?: InfoVariant;
    size?: InfoSize;
    dismissible?: boolean;
    icon?: Snippet;
    title?: string;
    onDismiss?: () => void;
    ariaLabel?: string;
  }

  const {
    children,
    class: className = '',
    variant = 'info',
    size = 'default',
    dismissible = false,
    icon,
    title,
    onDismiss,
    ariaLabel,
    ...restProps
  }: InfoProps = $props();

  let dismissed = $state(false);

  const baseClasses = [
    'flex',
    'items-start',
    'gap-3',
    'border',
    'transition-all',
    'duration-150',
    'ease-in-out',
  ];

  const sizeClasses: Record<InfoSize, string[]> = {
    sm: ['p-3', 'text-sm', 'rounded-xs'],
    default: ['p-4', 'text-base', 'rounded-sm'],
    lg: ['p-5', 'text-lg', 'rounded-sm'],
  };

  const variantClasses: Record<InfoVariant, string[]> = {
    success: ['bg-success', 'text-on-success', 'border-success'],
    warning: ['bg-warning', 'text-on-warning', 'border-warning'],
    error: ['bg-error', 'text-on-error', 'border-error'],
    info: ['bg-info', 'text-on-info', 'border-info'],
  };

  const iconClasses: Record<InfoVariant, string[]> = {
    success: ['text-on-success'],
    warning: ['text-on-warning'],
    error: ['text-on-error'],
    info: ['text-on-info'],
  };

  const defaultIcons: Record<InfoVariant, string> = {
    success: '✓',
    warning: '⚠',
    error: '✗',
    info: 'ℹ',
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...sizeClasses[size],
      ...variantClasses[variant],
      dismissed && 'hidden',
      className,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const iconContainerClasses = $derived(
    [
      'flex-shrink-0',
      'w-5',
      'h-5',
      'flex',
      'items-center',
      'justify-center',
      'font-bold',
      ...iconClasses[variant],
    ].join(' ')
  );

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    role: 'alert',
    'aria-live': 'polite',
    'aria-label': ariaLabel ?? `${variant} notification`,
    'aria-atomic': 'true',
  });

  function handleDismiss(): void {
    dismissed = true;
    onDismiss?.();
  }
</script>

{#if !dismissed}
  <div class={computedClasses} {...ariaAttributes} {...restProps}>
    <!-- Icon -->
    <div class={iconContainerClasses}>
      {#if icon}
        {@render icon()}
      {:else}
        {defaultIcons[variant]}
      {/if}
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      {#if title}
        <h4 class="font-semibold mb-1 text-current">
          {title}
        </h4>
      {/if}

      <div class="text-current">
        {@render children?.()}
      </div>
    </div>

    <!-- Dismiss button -->
    {#if dismissible}
      <button
        onclick={handleDismiss}
        class="cursor-pointer flex-shrink-0 ml-2 p-1 -mr-1 -mt-1 opacity-60 hover:opacity-100 rounded-xs hover:bg-surface-hover transition-all focus:outline-hidden focus:ring-2 focus:ring-current/20"
        aria-label="Dismiss notification"
        type="button"
      >
        <Icon iconName="close" size={16} />
      </button>
    {/if}
  </div>
{/if}
