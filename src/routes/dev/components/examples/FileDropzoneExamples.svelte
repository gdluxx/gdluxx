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
  import { Button, FileDropzone } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  let boundFile = $state<File | null>(null);
  let interactionResult = $state('Pick or drop a file to exercise onSelect.');
</script>

<div class="space-y-8">
  <ExampleSection title="Default">
    <FileDropzone ariaLabel="Component gallery default dropzone" />
  </ExampleSection>

  <ExampleSection title="Restricted types and custom prompt">
    <FileDropzone
      accept=".json"
      prompt="Drop a .json config, or click to browse"
      ariaLabel="Component gallery JSON dropzone"
    />
  </ExampleSection>

  <ExampleSection title="Disabled">
    <FileDropzone
      disabled
      prompt="Uploads are unavailable"
      ariaLabel="Component gallery disabled dropzone"
    />
  </ExampleSection>

  <ExampleSection title="Binding and callback">
    <FileDropzone
      bind:selectedFile={boundFile}
      ariaLabel="Component gallery bound dropzone"
      onSelect={(file: File) => (interactionResult = `onSelect received ${file.name}.`)}
    />
    <div class="mt-4 flex items-center gap-4">
      <Button
        onclick={() => {
          boundFile = null;
          interactionResult = 'Cleared — the native input resets with the binding.';
        }}
        disabled={!boundFile}
      >
        Clear
      </Button>
      <p
        class="text-sm text-muted-foreground"
        aria-live="polite"
      >
        Current value: {boundFile ? boundFile.name : 'null'} · {interactionResult}
      </p>
    </div>
  </ExampleSection>
</div>
