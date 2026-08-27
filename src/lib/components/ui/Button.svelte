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
    'disabled:opacity-60',
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
    ],
    'outline-success': [
      'bg-transparent',
      'text-success',
      'border-success',
      'hover:enabled:bg-success/10',
      'hover:enabled:border-success',
    ],
    'outline-warning': [
      'bg-transparent',
      'text-warning',
      'border-warning',
      'hover:enabled:bg-warning/10',
      'hover:enabled:border-warning',
    ],
    'outline-danger': [
      'bg-transparent',
      'text-error',
      'border-error',
      'hover:enabled:bg-error/10',
      'hover:enabled:border-error',
    ],
    'outline-info': [
      'bg-transparent',
      'text-info',
      'border-info',
      'hover:enabled:bg-info/10',
      'hover:enabled:border-info',
    ],
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...getSizeClasses(size),
      ...variantClasses[variant],
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
        class="border-skeleton border-t-spinner"
      />
    </div>
  {/if}
</button>
