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

  type AlertType = 'info' | 'success' | 'warning' | 'error';

  interface ToastProps {
    id?: string;
    type?: AlertType;
    title?: string;
    message?: string;
    dismissible?: boolean;
    autoHide?: boolean;
    duration?: number;
    children?: Snippet;
    onDismiss?: () => void;
  }

  const {
    id: _id = crypto.randomUUID(),
    type = 'info',
    title,
    message,
    dismissible = true,
    autoHide = true,
    duration = 5000,
    children,
    onDismiss,
  }: ToastProps = $props();

  let visible = $state(true);

  if (autoHide && duration > 0) {
    setTimeout(() => {
      if (visible) {
        handleDismiss();
      }
    }, duration);
  }

  function handleDismiss() {
    visible = false;
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }

  const classes = $derived(
    [
      'alert',
      `alert-${type}`,
      'shadow-lg',
      'transition-all',
      'duration-300',
      'ease-in-out',
      visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
    ].join(' '),
  );
</script>

{#if visible}
  <div class="toast-top toast-end toast">
    <div
      class={classes}
      role="alert"
      aria-live="polite"
    >
      <div>
        {#if title}
          <h3 class="font-bold">{title}</h3>
        {/if}
        {#if message}
          <div class="text-xs">{message}</div>
        {/if}
        {#if children}
          {@render children()}
        {/if}
      </div>
      {#if dismissible}
        <button
          class="btn btn-circle btn-ghost btn-sm"
          onclick={handleDismiss}>✕</button
        >
      {/if}
    </div>
  </div>
{/if}
