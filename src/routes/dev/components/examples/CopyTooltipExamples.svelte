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
  import { Button, CopyTooltip } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  let x = $state(0);
  let y = $state(0);
  let visible = $state(false);
  let text = $state('Copied!');

  function showTooltip(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const bounds = target.getBoundingClientRect();
    x = bounds.left + bounds.width / 2;
    y = bounds.top - 8;
    visible = true;
  }
</script>

<div class="space-y-8">
  <ExampleSection
    title="Fixed-position feedback"
    description="CopyTooltip accepts viewport coordinates, visibility, and display text."
  >
    <label
      for="copy-tooltip-text"
      class="block text-sm font-medium text-foreground"
    >
      Tooltip text
    </label>
    <input
      id="copy-tooltip-text"
      bind:value={text}
      class="mt-2 w-full max-w-sm rounded-control border border-border bg-input-background px-3 py-2 text-foreground"
    />
    <div class="mt-4 flex flex-wrap gap-3">
      <Button
        variant="primary"
        onclick={showTooltip}
      >
        Show above this button
      </Button>
      <Button
        variant="outline-primary"
        onclick={() => (visible = false)}
      >
        Hide
      </Button>
    </div>
    <p class="mt-4 text-sm text-muted-foreground">
      Position: {Math.round(x)}, {Math.round(y)} · Visible: {visible ? 'yes' : 'no'}
    </p>
  </ExampleSection>
</div>

<CopyTooltip
  {x}
  {y}
  {visible}
  {text}
/>
