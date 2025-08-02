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

  type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';
  type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual';
  type TooltipVariant = 'default' | 'dark' | 'light' | 'info' | 'warning' | 'danger';
  type TooltipSize = 'sm' | 'default' | 'lg';

  interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    children?: Snippet;
    tooltipContent?: Snippet;
    content?: string;
    class?: string;

    placement?: TooltipPlacement;
    offset?: number;

    trigger?: TooltipTrigger;
    show?: boolean;
    delay?: number;
    hideDelay?: number;

    variant?: TooltipVariant;
    size?: TooltipSize;
    maxWidth?: string;

    ariaLabel?: string;

    onShow?: () => void;
    onHide?: () => void;
  }

  const {
    children,
    tooltipContent,
    content,
    class: className = '',
    placement = 'top',
    offset = 8,
    trigger = 'hover',
    show = false,
    delay = 0,
    hideDelay = 0,
    variant = 'default',
    size = 'default',
    maxWidth = '16rem',
    ariaLabel,
    onShow,
    onHide,
    ...restProps
  }: TooltipProps = $props();

  let isVisible = $state(false);
  let triggerElement = $state<HTMLElement>();
  let tooltipElement = $state<HTMLElement>();
  let showTimeout = $state<number>();
  let hideTimeout = $state<number>();

  const tooltipId = $state(`tooltip-${Math.random().toString(36).substr(2, 9)}`);

  const baseClasses = [
    'absolute',
    'z-50',
    'px-3',
    'py-2',
    'rounded',
    'shadow-lg',
    'text-sm',
    'font-medium',
    'pointer-events-none',
    'transition-opacity',
    'duration-200',
    'whitespace-nowrap',
  ];

  const sizeClasses: Record<TooltipSize, string[]> = {
    sm: ['px-2', 'py-1', 'text-xs'],
    default: ['px-3', 'py-2', 'text-sm'],
    lg: ['px-4', 'py-3', 'text-base'],
  };

  const variantClasses: Record<TooltipVariant, string[]> = {
    default: [
      'bg-accent-50',
      'text-secondary-800',
      'border',
      'border-accent-500',
      'dark:bg-accent-900',
      'dark:text-secondary-200',
    ],
    dark: [
      'bg-secondary-900',
      'text-white',
      'border',
      'border-secondary-700',
      'dark:bg-secondary-800',
      'dark:border-secondary-600',
    ],
    light: [
      'bg-white',
      'text-secondary-900',
      'border',
      'border-secondary-200',
      'shadow-lg',
      'dark:bg-secondary-100',
      'dark:text-secondary-800',
    ],
    info: [
      'bg-info-100',
      'text-info-900',
      'border',
      'border-info-250',
      'dark:bg-info-900',
      'dark:text-info-100',
      'dark:border-info-750',
    ],
    warning: [
      'bg-warning-100',
      'text-warning-900',
      'border',
      'border-warning-250',
      'dark:bg-warning-900',
      'dark:text-warning-100',
      'dark:border-warning-750',
    ],
    danger: [
      'bg-error-100',
      'text-error-900',
      'border',
      'border-error-250',
      'dark:bg-error-900',
      'dark:text-error-100',
      'dark:border-error-750',
    ],
  };

  const placementClasses: Record<TooltipPlacement, string[]> = {
    top: ['bottom-full', 'left-1/2', 'transform', '-translate-x-1/2', '-translate-y-2'],
    bottom: ['top-full', 'left-1/2', 'transform', '-translate-x-1/2', 'translate-y-2'],
    left: ['right-full', 'top-1/2', 'transform', '-translate-y-1/2', '-translate-x-2'],
    right: ['left-full', 'top-1/2', 'transform', '-translate-y-1/2', 'translate-x-2'],
    auto: [],
  };

  const computedClasses = $derived(
    [
      ...baseClasses,
      ...sizeClasses[size],
      ...variantClasses[variant],
      ...placementClasses[placement],
      isVisible ? 'opacity-100' : 'opacity-0',
      className,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const tooltipStyle = $derived(maxWidth ? `max-width: ${maxWidth};` : '');

  const shouldShow = $derived(trigger === 'manual' ? show : isVisible);

  function showTooltip(): void {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = undefined;
    }

    if (delay > 0) {
      showTimeout = setTimeout(() => {
        isVisible = true;
        onShow?.();
      }, delay);
    } else {
      isVisible = true;
      onShow?.();
    }
  }

  function hideTooltip(): void {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = undefined;
    }

    if (hideDelay > 0) {
      hideTimeout = setTimeout(() => {
        isVisible = false;
        onHide?.();
      }, hideDelay);
    } else {
      isVisible = false;
      onHide?.();
    }
  }

  function handleMouseEnter(): void {
    if (trigger === 'hover') {
      showTooltip();
    }
  }

  function handleMouseLeave(): void {
    if (trigger === 'hover') {
      hideTooltip();
    }
  }

  function handleClick(): void {
    if (trigger === 'click') {
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    }
  }

  function handleFocus(): void {
    if (trigger === 'focus') {
      showTooltip();
    }
  }

  function handleBlur(): void {
    if (trigger === 'focus') {
      hideTooltip();
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isVisible) {
      hideTooltip();
    }
  }

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-describedby': shouldShow ? tooltipId : undefined,
    'aria-label': ariaLabel,
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="relative inline-block"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onclick={handleClick}
  onfocus={handleFocus}
  onblur={handleBlur}
  bind:this={triggerElement}
  {...ariaAttributes}
  {...restProps}
>
  {#if children}
    {@render children()}
  {/if}

  {#if shouldShow && (content || tooltipContent)}
    <div
      bind:this={tooltipElement}
      id={tooltipId}
      role="tooltip"
      class={computedClasses}
      style={tooltipStyle}
      aria-hidden={!shouldShow}
    >
      {#if tooltipContent}
        {@render tooltipContent()}
      {:else if content}
        {content}
      {/if}
    </div>
  {/if}
</div>
