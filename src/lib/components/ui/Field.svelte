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

  interface ControlProps {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
    required: boolean;
  }

  interface Props {
    label: string;
    description?: string;
    error?: string;
    required?: boolean;
    id?: string;
    class?: string;
    control: Snippet<[ControlProps]>;
  }

  const {
    label,
    description,
    error,
    required = false,
    id,
    class: className = '',
    control,
  }: Props = $props();

  const uid = $props.id();
  const fieldId = $derived(id ?? `field-${uid}`);
  const descriptionId = $derived(description ? `${fieldId}-description` : undefined);
  const errorId = $derived(error ? `${fieldId}-error` : undefined);
  const describedBy = $derived([descriptionId, errorId].filter(Boolean).join(' ') || undefined);
</script>

<div class="space-y-1 {className}">
  <label
    for={fieldId}
    class="block text-sm font-medium text-foreground"
  >
    {label}
    {#if required}
      <span
        class="text-error"
        aria-hidden="true">*</span
      >
    {/if}
  </label>

  {@render control({ id: fieldId, describedBy, invalid: !!error, required })}

  {#if description}
    <p
      id={descriptionId}
      class="text-xs text-muted-foreground"
    >
      {description}
    </p>
  {/if}

  {#if error}
    <p
      id={errorId}
      class="text-sm text-error"
      role="alert"
    >
      {error}
    </p>
  {/if}
</div>
