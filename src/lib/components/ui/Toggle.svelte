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
  import { Tooltip } from '$lib/components/ui';
  import { Icon } from '$lib/components';

  type ToggleVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';
  type ToggleSize = 'sm' | 'default' | 'lg';

  interface Props {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    description?: string;
    tooltipContent?: string;
    variant?: ToggleVariant;
    size?: ToggleSize;
    class?: string;
    containerClass?: string;
    ariaLabel?: string;
    onchange?: (checked: boolean) => void;
    id?: string;
    name?: string;
  }

  /* eslint-disable prefer-const */
  let {
    checked = $bindable(false),
    disabled = false,
    label,
    description,
    tooltipContent,
    variant = 'default',
    size = 'default',
    class: className = '',
    containerClass = '',
    ariaLabel,
    onchange,
    id,
    name,
  }: Props = $props();
  /* eslint-enable prefer-const */

  const toggleId = $state(`toggle-${Math.random().toString(36).substr(2, 9)}`);

  const sizeClasses: Record<ToggleSize, { track: string; thumb: string; label: string }> = {
    sm: {
      track: 'h-4 w-7',
      thumb: 'h-2.5 w-2.5 left-0.5 top-0.75 peer-checked:translate-x-3.5',
      label: 'text-xs',
    },
    default: {
      track: 'h-5 w-10',
      thumb: 'h-3 w-3 left-1 top-1 peer-checked:translate-x-5',
      label: 'text-sm',
    },
    lg: {
      track: 'h-6 w-12',
      thumb: 'h-4 w-4 left-1 top-1 peer-checked:translate-x-6',
      label: 'text-base',
    },
  };

  const variantClasses: Record<ToggleVariant, { trackOff: string; trackOn: string }> = {
    default: {
      trackOff: 'bg-border-strong',
      trackOn: 'peer-checked:bg-text-muted',
    },
    primary: {
      trackOff: 'bg-border-strong',
      trackOn: 'peer-checked:bg-primary',
    },
    success: {
      trackOff: 'bg-border-strong',
      trackOn: 'peer-checked:bg-success',
    },
    warning: {
      trackOff: 'bg-border-strong',
      trackOn: 'peer-checked:bg-warning',
    },
    danger: {
      trackOff: 'bg-border-strong',
      trackOn: 'peer-checked:bg-error',
    },
  };

  const trackClasses = $derived(
    [
      sizeClasses[size].track,
      'rounded-full',
      'transition-colors',
      'peer-disabled:opacity-50',
      variantClasses[variant].trackOff,
      variantClasses[variant].trackOn,
    ].join(' ')
  );

  const thumbClasses = $derived(
    [
      'absolute',
      sizeClasses[size].thumb,
      'rounded-full',
      'bg-surface-elevated',
      'transition-transform',
      'peer-disabled:opacity-70',
      'shadow-sm',
    ].join(' ')
  );

  const labelClasses = $derived(
    [sizeClasses[size].label, 'font-medium', 'text-foreground', disabled && 'text-disabled']
      .filter(Boolean)
      .join(' ')
  );

  const containerClasses = $derived(
    ['flex', 'items-center', 'space-x-3', containerClass].filter(Boolean).join(' ')
  );

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    checked = target.checked;
    onchange?.(target.checked);
  }

  const inputId = $derived(id ?? toggleId);

  const ariaAttributes = $derived<Record<string, string | undefined>>({
    'aria-label': ariaLabel ?? label,
    'aria-describedby': description ? `${inputId}-description` : undefined,
  });
</script>

<label for={inputId} class={containerClasses}>
  <div class="relative cursor-pointer">
    <input
      bind:checked
      {disabled}
      id={inputId}
      type="checkbox"
      onchange={handleChange}
      class={`peer sr-only ${className}`}
      {...ariaAttributes}
      {name}
    />
    <div class={trackClasses}></div>
    <div class={thumbClasses}></div>
  </div>

  {#if label}
    <span class={labelClasses}>
      {label}
    </span>
  {/if}

  {#if tooltipContent}
    <Tooltip maxWidth="32rem" class="!whitespace-normal !min-w-80" content={tooltipContent}>
      <Icon iconName="question" size={20} class="text-muted-foreground" />
    </Tooltip>
  {/if}
</label>

{#if description}
  <p id="{inputId}-description" class="mt-1 text-xs text-muted-foreground">
    {description}
  </p>
{/if}
