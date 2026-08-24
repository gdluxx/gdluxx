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
  import OverflowMenu, { type OverflowMenuItem } from '$lib/components/ui/OverflowMenu.svelte';
  import ExampleSection from './ExampleSection.svelte';

  let interactionResult = $state('Select a menu item to see its callback.');
  let busy = $state(false);

  const basicItems: OverflowMenuItem[] = [
    { label: 'Edit', onSelect: () => (interactionResult = 'Selected: Edit') },
    { label: 'History', onSelect: () => (interactionResult = 'Selected: History') },
  ];

  const dangerItems: OverflowMenuItem[] = [
    { label: 'Edit', onSelect: () => (interactionResult = 'Selected: Edit') },
    { label: 'History', onSelect: () => (interactionResult = 'Selected: History') },
    {
      label: 'Delete',
      variant: 'danger',
      onSelect: () => (interactionResult = 'Selected: Delete'),
    },
  ];

  const disabledItems: OverflowMenuItem[] = [
    { label: 'Edit', onSelect: () => (interactionResult = 'Selected: Edit') },
    { label: 'History', disabled: true, onSelect: () => (interactionResult = 'Selected: History') },
    {
      label: 'Delete',
      variant: 'danger',
      onSelect: () => (interactionResult = 'Selected: Delete'),
    },
  ];

  function toggleBusy() {
    busy = true;
    setTimeout(() => (busy = false), 1500);
  }
</script>

<div class="space-y-8">
  <ExampleSection
    title="Basic"
    description="Two default items, no separator."
  >
    <OverflowMenu
      items={basicItems}
      ariaLabel="Basic actions"
    />
  </ExampleSection>

  <ExampleSection
    title="Danger item"
    description="A separator is inserted automatically before the first danger item."
  >
    <OverflowMenu
      items={dangerItems}
      ariaLabel="Actions with a danger item"
    />
  </ExampleSection>

  <ExampleSection
    title="Disabled item"
    description="Disabled items are skipped by roving focus and cannot be selected."
  >
    <OverflowMenu
      items={disabledItems}
      ariaLabel="Actions with a disabled item"
    />
  </ExampleSection>

  <ExampleSection
    title="Busy"
    description="The trigger icon swaps for a spinner while staying enabled and focusable."
  >
    <div class="flex items-center gap-3">
      <OverflowMenu
        items={dangerItems}
        ariaLabel="Actions while busy"
        {busy}
      />
      <button
        type="button"
        class="text-sm text-primary hover:underline"
        onclick={toggleBusy}
      >
        Trigger busy for 1.5s
      </button>
    </div>
  </ExampleSection>

  <p
    class="text-sm text-muted-foreground"
    aria-live="polite"
  >
    {interactionResult}
  </p>
</div>
