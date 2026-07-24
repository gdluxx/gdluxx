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
  import { Button, Info } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  const variants = ['success', 'warning', 'error', 'info'] as const;
  const sizes = ['sm', 'default', 'lg'] as const;
  let resetKey = $state(0);
  let interactionResult = $state('Dismiss the final notification to exercise its callback.');
</script>

<div class="space-y-8">
  <ExampleSection title="Variants">
    <div class="space-y-3">
      {#each variants as variant (variant)}
        <Info
          {variant}
          title={`${variant} notification`}
        >
          This is the {variant} treatment.
        </Info>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Sizes">
    <div class="space-y-3">
      {#each sizes as size (size)}
        <Info
          variant="info"
          {size}
        >
          {size} informational content
        </Info>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Custom icon and dismissal">
    {#key resetKey}
      <Info
        variant="success"
        title="Custom icon"
        dismissible
        onDismiss={() => (interactionResult = 'Dismiss callback fired.')}
      >
        {#snippet icon()}
          <Icon
            iconName="checked"
            size={18}
          />
        {/snippet}
        This notification can be dismissed.
      </Info>
    {/key}
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="outline-primary"
        onclick={() => {
          resetKey += 1;
          interactionResult = 'Notification reset.';
        }}
      >
        Reset example
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
