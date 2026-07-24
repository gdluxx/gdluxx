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
  import { Toggle } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  const variants = ['default', 'primary', 'success', 'warning', 'danger'] as const;
  const sizes = ['sm', 'default', 'lg'] as const;

  let boundValue = $state(false);
  let interactionResult = $state('Use the bound toggle to exercise onchange.');
</script>

<div class="space-y-8">
  <ExampleSection title="Variants">
    <div class="grid gap-4 sm:grid-cols-2">
      {#each variants as variant (variant)}
        <Toggle
          checked
          id="dev-toggle-variant-{variant}"
          label={variant}
          {variant}
        />
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Sizes">
    <div class="flex flex-wrap items-center gap-8">
      {#each sizes as size (size)}
        <Toggle
          checked
          id="dev-toggle-size-{size}"
          label={size}
          variant="primary"
          {size}
        />
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="States and supporting content">
    <div class="grid gap-6 sm:grid-cols-2">
      <Toggle
        id="dev-toggle-off"
        label="Unchecked"
      />
      <Toggle
        checked
        id="dev-toggle-on"
        label="Checked"
        variant="success"
      />
      <Toggle
        disabled
        id="dev-toggle-disabled-off"
        label="Disabled off"
      />
      <Toggle
        checked
        disabled
        id="dev-toggle-disabled-on"
        label="Disabled on"
        variant="primary"
      />
      <Toggle
        id="dev-toggle-description"
        label="With description"
        description="Supporting text is connected with aria-describedby."
        variant="warning"
      />
      <Toggle
        id="dev-toggle-tooltip"
        label="With tooltip"
        tooltipContent="Helpful information supplied through tooltipContent."
        variant="primary"
      />
    </div>
  </ExampleSection>

  <ExampleSection title="Binding and callback">
    <Toggle
      bind:checked={boundValue}
      id="dev-toggle-bound"
      name="component-gallery-toggle"
      label="Bound value"
      ariaLabel="Component gallery bound toggle"
      variant="primary"
      onchange={(checked: boolean) => (interactionResult = `onchange received ${String(checked)}.`)}
    />
    <p
      class="mt-4 text-sm text-muted-foreground"
      aria-live="polite"
    >
      Current value: {String(boundValue)} · {interactionResult}
    </p>
  </ExampleSection>
</div>
