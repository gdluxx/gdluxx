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
  import Spinner from './Spinner.svelte';

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

  interface ButtonBaseProps extends Omit<HTMLButtonAttributes, 'type' | 'class'> {
    children?: Snippet;
    class?: string;
    type?: ButtonType;
    disabled?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    block?: boolean;
    icon?: boolean;
    ariaLabel?: string;
  }

  type ButtonProps = ButtonBaseProps &
    ({ pill?: boolean; square?: never } | { square?: boolean; pill?: never });

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
    'duration-fast',
    'ease-in-out',
    'border',
    'whitespace-nowrap',
    'select-none',
    'cursor-pointer',
    'disabled:cursor-not-allowed',
    'hover:enabled:-translate-y-0.5',
    'hover:enabled:shadow-raised',
    'active:enabled:translate-y-0',
  ];

  function getSizeClasses(buttonSize: ButtonSize): string[] {
    const padding = icon
      ? { sm: 'p-1', default: 'p-2', lg: 'p-3' }[buttonSize]
      : { sm: 'px-3 py-1', default: 'px-4 py-2', lg: 'px-6 py-3' }[buttonSize];
    const textSize = { sm: 'text-sm', default: 'text-base', lg: 'text-lg' }[buttonSize];
    const defaultRadius = 'rounded-control';
    const radius = square ? 'rounded-none' : pill ? 'rounded-pill' : defaultRadius;

    return [padding, textSize, radius];
  }

  const variantClasses: Record<ButtonVariant, string[]> = {
    default: [
      'bg-surface',
      'text-foreground',
      'border-border-strong',
      'hover:enabled:bg-surface-hover',
      'active:enabled:bg-surface-active',
    ],
    primary: [
      'bg-primary',
      'text-on-primary',
      'border-primary',
      'hover:enabled:bg-primary-hover',
      'hover:enabled:border-primary-hover',
      'active:enabled:bg-primary-active',
    ],
    success: [
      'bg-success',
      'text-on-success',
      'border-success',
      'hover:enabled:bg-success-hover',
      'hover:enabled:border-success-hover',
      'active:enabled:bg-success-active',
    ],
    warning: [
      'bg-warning',
      'text-on-warning',
      'border-warning',
      'hover:enabled:bg-warning-hover',
      'hover:enabled:border-warning-hover',
      'active:enabled:bg-warning-active',
    ],
    danger: [
      'bg-error',
      'text-on-error',
      'border-error',
      'hover:enabled:bg-error-hover',
      'hover:enabled:border-error-hover',
      'active:enabled:bg-error-active',
    ],
    info: [
      'bg-info',
      'text-on-info',
      'border-info',
      'hover:enabled:bg-info-hover',
      'hover:enabled:border-info-hover',
      'active:enabled:bg-info-active',
    ],
    light: [
      'bg-surface',
      'text-foreground',
      'border',
      'hover:enabled:bg-surface-hover',
      'hover:enabled:border-strong',
      'active:enabled:bg-surface-active',
    ],
    dark: [
      'bg-foreground',
      'text-background',
      'border-foreground',
      'hover:enabled:opacity-90',
      'active:enabled:opacity-80',
    ],
    'outline-primary': [
      'bg-transparent',
      'text-primary',
      'border-primary',
      'hover:enabled:bg-primary/10',
      'hover:enabled:border-primary',
      'active:enabled:bg-primary/20',
    ],
    'outline-success': [
      'bg-transparent',
      'text-success',
      'border-success',
      'hover:enabled:bg-success/10',
      'hover:enabled:border-success',
      'active:enabled:bg-success/20',
    ],
    'outline-warning': [
      'bg-transparent',
      'text-warning',
      'border-warning',
      'hover:enabled:bg-warning/10',
      'hover:enabled:border-warning',
      'active:enabled:bg-warning/20',
    ],
    'outline-danger': [
      'bg-transparent',
      'text-error',
      'border-error',
      'hover:enabled:bg-error/10',
      'hover:enabled:border-error',
      'active:enabled:bg-error/20',
    ],
    'outline-info': [
      'bg-transparent',
      'text-info',
      'border-info',
      'hover:enabled:bg-info/10',
      'hover:enabled:border-info',
      'active:enabled:bg-info/20',
    ],
  };

  const disabledVariantClasses: Record<ButtonVariant, string[]> = {
    default: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    primary: ['bg-primary-disabled', 'text-disabled', 'border-primary-disabled'],
    success: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    warning: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    danger: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    info: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    light: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    dark: ['bg-surface-disabled', 'text-disabled', 'border-border'],
    'outline-primary': ['bg-transparent', 'text-disabled', 'border-border'],
    'outline-success': ['bg-transparent', 'text-disabled', 'border-border'],
    'outline-warning': ['bg-transparent', 'text-disabled', 'border-border'],
    'outline-danger': ['bg-transparent', 'text-disabled', 'border-border'],
    'outline-info': ['bg-transparent', 'text-disabled', 'border-border'],
  };

  const spinnerClasses: Record<ButtonVariant, string> = {
    default: 'border-skeleton border-t-spinner',
    primary: 'border-primary-text/25 border-t-primary-text',
    success: 'border-success-text/25 border-t-success-text',
    warning: 'border-warning-text/25 border-t-warning-text',
    danger: 'border-error-text/25 border-t-error-text',
    info: 'border-info-text/25 border-t-info-text',
    light: 'border-skeleton border-t-spinner',
    dark: 'border-background/25 border-t-background',
    'outline-primary': 'border-skeleton border-t-primary',
    'outline-success': 'border-skeleton border-t-success',
    'outline-warning': 'border-skeleton border-t-warning',
    'outline-danger': 'border-skeleton border-t-error',
    'outline-info': 'border-skeleton border-t-info',
  };

  const visuallyDisabled = $derived(disabled && !loading);

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...getSizeClasses(size),
      ...(visuallyDisabled ? disabledVariantClasses[variant] : variantClasses[variant]),
      block && 'flex w-full',
      loading && 'relative pointer-events-none',
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
  <span
    class="contents"
    class:invisible={loading}
    aria-hidden={loading ? 'true' : undefined}
  >
    {@render children?.()}
  </span>

  <!-- Screen reader loading announcement -->
  {#if loading}
    <span class="sr-only">{loadingText}</span>

    <!-- Loading spinner -->
    <div
      class="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <Spinner
        variant="ring"
        size={16}
        border="full"
        class={spinnerClasses[variant]}
      />
    </div>
  {/if}
</button>
