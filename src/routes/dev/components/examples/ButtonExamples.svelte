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
  import { Icon } from '$lib/components';
  import { Button } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  const variants = [
    'default',
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'light',
    'dark',
    'outline-primary',
    'outline-success',
    'outline-warning',
    'outline-danger',
    'outline-info',
  ] as const;

  const sizes = ['sm', 'default', 'lg'] as const;
  let interactionResult = $state('No button clicked yet.');
</script>

<div class="space-y-8">
  <ExampleSection
    title="Variants"
    description="Every color and outline treatment at the default size."
  >
    <div class="flex flex-wrap gap-3">
      {#each variants as variant (variant)}
        <Button
          {variant}
          onclick={() => (interactionResult = `Clicked ${variant}`)}
        >
          {variant}
        </Button>
      {/each}
    </div>
    <p
      class="mt-4 text-sm text-muted-foreground"
      aria-live="polite"
    >
      {interactionResult}
    </p>
  </ExampleSection>

  <ExampleSection title="Sizes">
    <div class="flex flex-wrap items-center gap-3">
      {#each sizes as size (size)}
        <Button
          variant="primary"
          {size}
        >
          {size}
        </Button>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection
    title="States"
    description="Disabled, loading, shape, icon, and full-width states."
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button disabled>Disabled</Button>
        <Button
          variant="primary"
          loading
        >
          Loading
        </Button>
        <Button
          variant="success"
          pill
        >
          Pill
        </Button>
        <Button
          variant="warning"
          square
        >
          Square
        </Button>
        <Button
          variant="primary"
          icon
          ariaLabel="Add item"
        >
          <Icon
            iconName="plus"
            size={18}
          />
        </Button>
      </div>
      <Button
        variant="outline-primary"
        block
      >
        Block button
      </Button>
    </div>
  </ExampleSection>

  <ExampleSection
    title="Native button types"
    description="The button supports button, submit, and reset HTML types."
  >
    <div class="flex flex-wrap gap-3">
      <Button type="button">button</Button>
      <Button type="submit">submit</Button>
      <Button type="reset">reset</Button>
    </div>
  </ExampleSection>
</div>
