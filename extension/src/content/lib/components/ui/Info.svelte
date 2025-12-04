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

  type InfoVariant = 'success' | 'warning' | 'error' | 'info';
  type InfoSize = 'sm' | 'default' | 'lg';

  interface InfoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    children?: Snippet;
    class?: string;
    variant?: InfoVariant;
    size?: InfoSize;
    soft?: boolean;
    dismissible?: boolean;
    title?: string;
    onDismiss?: () => void;
    ariaLabel?: string;
  }

  const {
    children,
    class: className = '',
    variant = 'info',
    size = 'default',
    soft = false,
    dismissible = false,
    title,
    onDismiss,
    ariaLabel,
    ...restProps
  }: InfoProps = $props();

  let dismissed = $state(false);

  const sizeClasses: Record<InfoSize, string[]> = {
    sm: ['text-sm', 'py-2', 'px-3'],
    default: ['text-base', 'py-3', 'px-4'],
    lg: ['text-lg', 'py-4', 'px-5'],
  };

  const iconSizeClasses: Record<InfoSize, string> = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-7 w-7',
  };

  const contentTextClasses: Record<InfoSize, string> = {
    sm: 'text-xs',
    default: 'text-xs',
    lg: 'text-sm',
  };

  const classes = $derived(
    [
      'alert',
      `alert-${variant}`,
      ...sizeClasses[size],
      soft && 'alert-soft',
      dismissed && 'hidden',
      className,
    ]
      .filter(Boolean)
      .join(' '),
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
  <div
    class={classes}
    {...ariaAttributes}
    {...restProps}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      class="{iconSizeClasses[size]} shrink-0 stroke-current"
    >
      {#if variant === 'success'}
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      {:else if variant === 'warning'}
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        ></path>
      {:else if variant === 'error'}
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      {:else}
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      {/if}
    </svg>

    <div>
      {#if title}
        <h3 class="font-bold">{title}</h3>
      {/if}
      <div class={contentTextClasses[size]}>
        {@render children?.()}
      </div>
    </div>

    {#if dismissible}
      <button
        onclick={handleDismiss}
        class="btn btn-circle btn-ghost btn-sm"
        aria-label="Dismiss notification"
        type="button"
      >
        ✕
      </button>
    {/if}
  </div>
{/if}
