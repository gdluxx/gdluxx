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
  import type { HTMLInputAttributes } from 'svelte/elements';

  type ToggleVariant =
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'success'
    | 'warning'
    | 'info'
    | 'error';
  type ToggleSize = 'xs' | 'sm' | 'md' | 'lg';

  interface Props extends Omit<HTMLInputAttributes, 'type' | 'size' | 'class' | 'onchange'> {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    description?: string;
    variant?: ToggleVariant;
    size?: ToggleSize;
    class?: string;
    containerClass?: string;
    labelClass?: string;
    onchange?: (checked: boolean) => void;
    id?: string;
    name?: string;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    label,
    description,
    variant,
    size = 'md',
    class: className = '',
    containerClass = '',
    labelClass = '',
    onchange,
    id,
    name,
    ...restProps
  }: Props = $props();

  const toggleId = $derived(id ?? `toggle-${Math.random().toString(36).slice(2, 9)}`);

  const toggleClasses = $derived(
    ['toggle', variant && `toggle-${variant}`, `toggle-${size}`, className]
      .filter(Boolean)
      .join(' '),
  );

  const containerClasses = $derived(['form-control', containerClass].filter(Boolean).join(' '));

  const labelClasses = $derived(['label cursor-pointer', labelClass].filter(Boolean).join(' '));

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    checked = target.checked;
    onchange?.(target.checked);
  }
</script>

<div class={containerClasses}>
  <label
    for={toggleId}
    class={labelClasses}
  >
    {#if label}
      <span class="label-text">{label}</span>
    {/if}
    <input
      bind:checked
      {disabled}
      id={toggleId}
      {name}
      type="checkbox"
      class={toggleClasses}
      onchange={handleChange}
      {...restProps}
    />
  </label>

  {#if description}
    <div class="label">
      <span class="label-text-alt">{description}</span>
    </div>
  {/if}
</div>
