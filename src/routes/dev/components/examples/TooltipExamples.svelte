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
  import { Button, Toggle, Tooltip } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  const placements = ['top', 'bottom', 'left', 'right', 'auto'] as const;
  const variants = ['default', 'dark', 'light', 'info', 'warning', 'danger'] as const;
  const sizes = ['sm', 'default', 'lg'] as const;

  let manualShow = $state(true);
  let interactionResult = $state('Show and hide callbacks have not fired yet.');
</script>

<div class="space-y-8">
  <ExampleSection
    title="Placements"
    description="These manual tooltips remain visible so every placement can be compared."
  >
    <div class="grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-3">
      {#each placements as placement (placement)}
        <div class="flex min-h-20 items-center justify-center">
          <Tooltip
            content={placement}
            {placement}
            trigger="manual"
            show
          >
            <Button
              size="sm"
              variant="outline-primary"
            >
              {placement}
            </Button>
          </Tooltip>
        </div>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Variants">
    <div class="grid gap-8 pt-10 sm:grid-cols-2 lg:grid-cols-3">
      {#each variants as variant (variant)}
        <div class="flex min-h-16 items-start justify-center">
          <Tooltip
            content={variant}
            placement="top"
            trigger="manual"
            show
            {variant}
          >
            <Button
              size="sm"
              variant="outline-primary"
            >
              {variant}
            </Button>
          </Tooltip>
        </div>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Sizes">
    <div class="flex flex-wrap items-center justify-around gap-10 pt-10">
      {#each sizes as size (size)}
        <Tooltip
          content={`${size} tooltip`}
          placement="top"
          trigger="manual"
          show
          {size}
        >
          <Button
            size="sm"
            variant="outline-primary"
          >
            {size}
          </Button>
        </Tooltip>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection
    title="Triggers"
    description="Hover, click, focus, and manually controlled visibility."
  >
    <div class="flex flex-wrap items-center gap-5">
      <Tooltip
        content="Hover trigger"
        trigger="hover"
        onShow={() => (interactionResult = 'Hover tooltip shown.')}
        onHide={() => (interactionResult = 'Hover tooltip hidden.')}
      >
        <Button variant="outline-primary">Hover or focus</Button>
      </Tooltip>
      <Tooltip
        content="Click trigger"
        trigger="click"
        onShow={() => (interactionResult = 'Click tooltip shown.')}
        onHide={() => (interactionResult = 'Click tooltip hidden.')}
      >
        <Button variant="outline-primary">Click</Button>
      </Tooltip>
      <Tooltip
        content="Focus trigger"
        trigger="focus"
        onShow={() => (interactionResult = 'Focus tooltip shown.')}
        onHide={() => (interactionResult = 'Focus tooltip hidden.')}
      >
        <Button variant="outline-primary">Focus</Button>
      </Tooltip>
      <Tooltip
        trigger="manual"
        show={manualShow}
        placement="bottom"
        maxWidth="20rem"
      >
        {#snippet tooltipContent()}
          <span>Rich content from the tooltipContent snippet.</span>
        {/snippet}
        <Button variant="outline-primary">Manual</Button>
      </Tooltip>
    </div>
    <div class="mt-8">
      <Toggle
        bind:checked={manualShow}
        id="dev-tooltip-manual"
        label="Show manual tooltip"
        variant="primary"
      />
    </div>
    <p
      class="mt-4 text-sm text-muted-foreground"
      aria-live="polite"
    >
      {interactionResult}
    </p>
  </ExampleSection>

  <ExampleSection
    title="Delays and wrapping"
    description="This tooltip waits before showing and permits wrapped content."
  >
    <Tooltip
      content="A longer tooltip with a constrained width and normal white-space wrapping."
      class="!whitespace-normal"
      maxWidth="12rem"
      delay={300}
      hideDelay={200}
      ariaLabel="Delayed tooltip example"
    >
      <Button variant="outline-info">Hover for delayed tooltip</Button>
    </Tooltip>
  </ExampleSection>
</div>
