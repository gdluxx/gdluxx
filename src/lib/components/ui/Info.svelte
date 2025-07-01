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

  type InfoVariant = 'success' | 'warning' | 'danger' | 'info';
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
    success: [
      'dark:bg-success-100',
      'dark:text-success-900',
      'dark:border-success-250',
      'bg-success-900/20',
      'text-success-100',
      'border-success-750/40',
    ],
    warning: [
      'dark:bg-warning-100',
      'dark:text-warning-900',
      'dark:border-warning-250',
      'bg-warning-900/20',
      'text-warning-100',
      'border-warning-750/40',
    ],
    danger: [
      'dark:bg-error-100',
      'dark:text-error-900',
      'dark:border-error-250',
      'bg-error-900/20',
      'text-error-100',
      'border-error-750/40',
    ],
    info: [
      'dark:bg-info-100',
      'dark:text-info-900',
      'dark:border-info-250',
      'bg-info-900/20',
      'text-info-100',
      'border-info-750/40',
    ],
  };

  const iconClasses: Record<InfoVariant, string[]> = {
    success: ['text-success-500', 'dark:text-success-500'],
    warning: ['text-warning-500', 'dark:text-warning-500'],
    danger: ['text-error-500', 'dark:text-error-500'],
    info: ['text-info-500', 'dark:text-info-500'],
  };

  const defaultIcons: Record<InfoVariant, string> = {
    success: '✓',
    warning: '⚠',
    danger: '✗',
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
        class="cursor-pointer flex-shrink-0 ml-2 p-1 -mr-1 -mt-1 opacity-60 hover:opacity-100 rounded-xs dark:hover:bg-black/5 hover:bg-white/5 transition-all focus:outline-hidden focus:ring-2 focus:ring-current/20"
        aria-label="Dismiss notification"
        type="button"
      >
        <Icon iconName="close" size={16} />
      </button>
    {/if}
  </div>
{/if}
