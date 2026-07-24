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
  import { Button, Modal, Toggle } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  const sizes = ['sm', 'md', 'lg', 'xl'] as const satisfies readonly ModalSize[];
  let activeSize = $state<ModalSize | null>(null);
  let closeOnEscape = $state(true);
  let interactionResult = $state('Open a modal to exercise its close behavior.');

  function openModal(size: ModalSize): void {
    activeSize = size;
    interactionResult = `Opened the ${size} modal.`;
  }

  function closeModal(): void {
    activeSize = null;
    interactionResult = 'Modal onClose callback fired.';
  }
</script>

<div class="space-y-8">
  <ExampleSection
    title="Sizes"
    description="Each launcher opens the native dialog at a different maximum width."
  >
    <div class="flex flex-wrap gap-3">
      {#each sizes as size (size)}
        <Button
          variant="primary"
          onclick={() => openModal(size)}
        >
          Open {size}
        </Button>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection
    title="Close behavior"
    description="Backdrop and close-button dismissal always call onClose. Escape can be disabled."
  >
    <Toggle
      bind:checked={closeOnEscape}
      label="Close on Escape"
      description="Turn this off before opening a modal to test the protected Escape behavior."
      variant="primary"
    />
    <p
      class="mt-4 text-sm text-muted-foreground"
      aria-live="polite"
    >
      {interactionResult}
    </p>
  </ExampleSection>
</div>

<Modal
  show={activeSize !== null}
  size={activeSize ?? 'md'}
  {closeOnEscape}
  onClose={closeModal}
>
  <div class="p-6 pr-14">
    <h2 class="text-lg font-semibold text-primary">{activeSize ?? 'md'} modal</h2>
    <p class="mt-2 text-foreground">
      This content is supplied through the Modal children snippet. Use the close button, backdrop,
      or Escape when enabled.
    </p>
    <Button
      class="mt-5"
      variant="primary"
      onclick={closeModal}
    >
      Close from content
    </Button>
  </div>
</Modal>
