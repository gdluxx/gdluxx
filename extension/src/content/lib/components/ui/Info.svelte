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

  interface InfoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    children?: Snippet;
    class?: string;
    variant?: InfoVariant;
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
    soft = false,
    dismissible = false,
    title,
    onDismiss,
    ariaLabel,
    ...restProps
  }: InfoProps = $props();

  let dismissed = $state(false);

  const classes = $derived(
    ['alert', `alert-${variant}`, soft && 'alert-soft', dismissed && 'hidden', className]
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
      class="h-6 w-6 shrink-0 stroke-current"
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
      <div class="text-xs">
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
