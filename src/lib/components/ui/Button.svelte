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
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonType = 'button' | 'submit' | 'reset';
  type ButtonSize = 'sm' | 'default' | 'lg';
  type ButtonVariant =
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'light'
    | 'dark'
    | 'outline-primary'
    | 'outline-success'
    | 'outline-warning'
    | 'outline-danger'
    | 'outline-info';

  interface ButtonProps extends Omit<HTMLButtonAttributes, 'type' | 'class'> {
    children?: Snippet;
    class?: string;
    type?: ButtonType;
    disabled?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    block?: boolean;
    pill?: boolean;
    square?: boolean;
    icon?: boolean;
    ariaLabel?: string;
  }

  const {
    children,
    class: className = '',
    type = 'button',
    disabled = false,
    variant = 'default',
    size = 'default',
    loading = false,
    block = false,
    pill = false,
    square = false,
    icon = false,
    ariaLabel = undefined,
    ...restProps
  }: ButtonProps = $props();

  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'transition-all',
    'duration-150',
    'ease-in-out',
    'border',
    'focus:outline-hidden',
    'whitespace-nowrap',
    'select-none',
    'cursor-pointer',
    'disabled:opacity-60',
    'disabled:cursor-not-allowed',
    'hover:enabled:-translate-y-0.5',
    'hover:enabled:shadow-sm',
    'active:enabled:translate-y-0',
    'active:enabled:shadow-xs',
  ];

  const sizeClasses: Record<ButtonSize, string[]> = {
    sm: [
      icon ? 'p-1' : 'px-3 py-1',
      'text-sm',
      square ? 'rounded-none' : pill ? 'rounded-full' : 'rounded-xs',
    ],
    default: [
      icon ? 'p-2' : 'px-4 py-2',
      'text-base',
      square ? 'rounded-none' : pill ? 'rounded-full' : 'rounded-sm',
    ],
    lg: [
      icon ? 'p-3' : 'px-6 py-3',
      'text-lg',
      square ? 'rounded-none' : pill ? 'rounded-full' : 'rounded-sm',
    ],
  };

  const variantClasses: Record<ButtonVariant, string[]> = {
    default: [
      'bg-surface',
      'text-foreground',
      'border-transparent',
      'hover:enabled:bg-surface-hover',
      'focus:border-focus',
    ],
    primary: [
      'bg-primary',
      'text-on-primary',
      'border-primary',
      'hover:enabled:bg-primary-hover',
      'hover:enabled:border-primary-hover',
      'focus:border-focus',
    ],
    success: [
      'bg-success',
      'text-on-success',
      'border-success',
      'hover:enabled:bg-success-hover',
      'hover:enabled:border-success-hover',
      'focus:border-focus',
    ],
    warning: [
      'bg-warning',
      'text-on-warning',
      'border-warning',
      'hover:enabled:bg-warning-hover',
      'hover:enabled:border-warning-hover',
      'focus:border-focus',
    ],
    danger: [
      'bg-error',
      'text-on-error',
      'border-error',
      'hover:enabled:bg-error-hover',
      'hover:enabled:border-error-hover',
      'focus:border-focus',
    ],
    info: [
      'bg-info',
      'text-on-info',
      'border-info',
      'hover:enabled:bg-info-hover',
      'hover:enabled:border-info-hover',
      'focus:border-focus',
    ],
    light: [
      'bg-surface',
      'text-foreground',
      'border',
      'hover:enabled:bg-surface-hover',
      'hover:enabled:border-strong',
      'focus:border-focus',
    ],
    dark: [
      'bg-text-primary',
      'text-inverse',
      'border-text-primary',
      'hover:enabled:bg-surface-hover',
      'hover:enabled:border-hover',
      'focus:border-focus',
    ],
    'outline-primary': [
      'bg-transparent',
      'text-primary',
      'border-primary',
      'hover:enabled:bg-primary/10',
      'hover:enabled:border-primary',
      'focus:border-focus',
    ],
    'outline-success': [
      'bg-transparent',
      'text-success',
      'border-success',
      'hover:enabled:bg-success/10',
      'hover:enabled:border-success',
      'focus:border-focus',
    ],
    'outline-warning': [
      'bg-transparent',
      'text-warning',
      'border-warning',
      'hover:enabled:bg-warning/10',
      'hover:enabled:border-warning',
      'focus:border-focus',
    ],
    'outline-danger': [
      'bg-transparent',
      'text-error',
      'border-error',
      'hover:enabled:bg-error/10',
      'hover:enabled:border-error',
      'focus:border-focus',
    ],
    'outline-info': [
      'bg-transparent',
      'text-info',
      'border-info',
      'hover:enabled:bg-info/10',
      'hover:enabled:border-info',
      'focus:border-focus',
    ],
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...sizeClasses[size],
      ...variantClasses[variant],
      block && 'flex w-full',
      loading && 'relative text-transparent pointer-events-none',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel,
    'aria-disabled': disabled || loading ? 'true' : undefined,
    'aria-busy': loading ? 'true' : undefined,
    role: type === 'button' ? undefined : 'button',
  });

  // Screen reader text for loading state
  const loadingText = $derived(loading ? 'Loading' : '');
</script>

<button
  class={computedClasses}
  {type}
  disabled={disabled || loading}
  {...ariaAttributes}
  {...restProps}
>
  {@render children?.()}

  <!-- Screen reader loading announcement -->
  {#if loading}
    <span class="sr-only">{loadingText}</span>
  {/if}

  <!-- Loading spinner -->
  {#if loading}
    <div
      class="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <div
        class="h-4 w-4 animate-spin rounded-full border-2 border-skeleton border-t-spinner"
        role="status"
        aria-label="Loading"
      ></div>
    </div>
  {/if}
</button>
