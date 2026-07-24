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
  import { Button, Chip } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  const variants = [
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'outline-primary',
    'outline-success',
    'outline-warning',
    'outline-danger',
    'outline-info',
  ] as const;

  const sizes = ['sm', 'default', 'lg'] as const;
  let resetKey = $state(0);
  let interactionResult = $state('Edit or dismiss a chip to see its callback.');
</script>

<div class="space-y-8">
  <ExampleSection title="Variants">
    <div class="flex flex-wrap gap-3">
      {#each variants as variant (variant)}
        <Chip
          label={variant}
          {variant}
        />
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Sizes">
    <div class="flex flex-wrap items-center gap-3">
      {#each sizes as size (size)}
        <Chip
          label={size}
          variant="primary"
          {size}
        />
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection
    title="Content and interactions"
    description="Click the editable value, press Enter to submit it, or dismiss a chip."
  >
    {#key resetKey}
      <div class="flex flex-wrap items-center gap-3">
        <Chip
          label="Value"
          value="editable"
          editable
          onEdit={(value: string | number | boolean) =>
            (interactionResult = `Edited value: ${String(value)}`)}
        />
        <Chip
          label="Count"
          value={42}
          variant="success"
        />
        <Chip
          label="Dismiss me"
          dismissible
          variant="warning"
          onDismiss={() => (interactionResult = 'Dismissed the warning chip.')}
        />
        <Chip
          label="With icon"
          variant="info"
        >
          {#snippet icon()}
            <Icon
              iconName="checked"
              size={14}
            />
          {/snippet}
        </Chip>
      </div>
    {/key}
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="outline-primary"
        onclick={() => {
          resetKey += 1;
          interactionResult = 'Examples reset.';
        }}
      >
        Reset examples
      </Button>
      <p
        class="text-sm text-muted-foreground"
        aria-live="polite"
      >
        {interactionResult}
      </p>
    </div>
  </ExampleSection>
</div>
