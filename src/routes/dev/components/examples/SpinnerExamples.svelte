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
  import { Spinner } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  const sizes = [12, 16, 24, 32, 48] as const;
</script>

<div class="space-y-8">
  <ExampleSection title="Variants and sizes">
    <div class="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 class="mb-3 text-sm font-medium text-foreground">Icon</h3>
        <div class="flex items-center gap-5 text-primary">
          {#each sizes as size (size)}
            <Spinner
              variant="icon"
              {size}
            />
          {/each}
        </div>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-medium text-foreground">Ring</h3>
        <div class="flex items-center gap-5 text-primary">
          {#each sizes as size (size)}
            <Spinner
              variant="ring"
              {size}
            />
          {/each}
        </div>
      </div>
    </div>
  </ExampleSection>

  <ExampleSection title="Ring borders">
    <div class="flex items-center gap-6 text-primary">
      <div class="text-center">
        <Spinner
          variant="ring"
          border="full"
          size={32}
        />
        <p class="mt-2 text-xs text-muted-foreground">full</p>
      </div>
      <div class="text-center">
        <Spinner
          variant="ring"
          border="bottom"
          size={32}
        />
        <p class="mt-2 text-xs text-muted-foreground">bottom</p>
      </div>
    </div>
  </ExampleSection>

  <ExampleSection
    title="Accessibility"
    description="Decorative spinners are hidden from assistive technology; status spinners expose a label."
  >
    <div class="flex flex-wrap items-center gap-6 text-primary">
      <div class="flex items-center gap-2">
        <Spinner
          decorative
          size={24}
        />
        <span class="text-sm text-foreground">Decorative</span>
      </div>
      <div class="flex items-center gap-2">
        <Spinner
          decorative={false}
          label="Loading component examples"
          size={24}
        />
        <span class="text-sm text-foreground">Status: Loading component examples</span>
      </div>
    </div>
  </ExampleSection>
</div>
