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
  import { Button, EmptyState } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';
</script>

<div class="space-y-8">
  <ExampleSection
    title="Content combinations"
    description="Title-only, descriptive, icon, and action-slot examples."
  >
    <div class="grid gap-8 md:grid-cols-2">
      <EmptyState title="Nothing here yet" />
      <EmptyState
        title="No jobs found"
        description="New download jobs will appear here."
        icon="job"
      />
      <EmptyState
        title="Custom icon size"
        description="The iconSize prop accepts a pixel value."
        icon="magnifying-glass"
        iconSize={32}
      />
      <EmptyState
        title="Ready to begin?"
        description="Children render below the description."
        icon="download-arrow"
      >
        <Button
          class="mt-4"
          size="sm"
          variant="primary"
        >
          Create job
        </Button>
      </EmptyState>
    </div>
  </ExampleSection>
</div>
