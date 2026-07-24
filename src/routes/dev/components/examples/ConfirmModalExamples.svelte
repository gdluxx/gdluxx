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
  import { Button, ConfirmModal, Toggle } from '$lib/components/ui';
  import ExampleSection from './ExampleSection.svelte';

  type ButtonVariant =
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'light'
    | 'dark'
    | 'outline-primary'
    | 'outline-success'
    | 'outline-warning'
    | 'outline-danger'
    | 'outline-info';
  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  const variants = [
    'default',
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'light',
    'dark',
    'outline-primary',
    'outline-success',
    'outline-warning',
    'outline-danger',
    'outline-info',
  ] as const satisfies readonly ButtonVariant[];
  const sizes = ['sm', 'md', 'lg', 'xl'] as const satisfies readonly ModalSize[];

  let show = $state(false);
  let size = $state<ModalSize>('md');
  let confirmVariant = $state<ButtonVariant>('primary');
  let useCustomContent = $state(false);
  let preventEscapeClose = $state(false);
  let interactionResult = $state('Open a confirmation modal to test its callbacks.');

  function openModal(nextSize: ModalSize, nextVariant: ButtonVariant = 'primary'): void {
    size = nextSize;
    confirmVariant = nextVariant;
    show = true;
    interactionResult = `Opened ${nextSize} modal with ${nextVariant} confirmation.`;
  }

  function finish(action: string): void {
    show = false;
    interactionResult = action;
  }
</script>

<div class="space-y-8">
  <ExampleSection title="Sizes">
    <div class="flex flex-wrap gap-3">
      {#each sizes as modalSize (modalSize)}
        <Button
          variant="primary"
          onclick={() => openModal(modalSize)}
        >
          Open {modalSize}
        </Button>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection
    title="Action variants"
    description="Each launcher applies the named variant to the confirm action."
  >
    <div class="flex flex-wrap gap-3">
      {#each variants as variant (variant)}
        <Button
          {variant}
          size="sm"
          onclick={() => openModal('md', variant)}
        >
          {variant}
        </Button>
      {/each}
    </div>
  </ExampleSection>

  <ExampleSection title="Content and dismissal options">
    <div class="space-y-4">
      <Toggle
        bind:checked={useCustomContent}
        label="Use children snippet"
        description="Otherwise the modal renders its message prop."
        variant="primary"
      />
      <Toggle
        bind:checked={preventEscapeClose}
        label="Prevent Escape close"
        variant="warning"
      />
      <p
        class="text-sm text-muted-foreground"
        aria-live="polite"
      >
        {interactionResult}
      </p>
    </div>
  </ExampleSection>
</div>

{#if useCustomContent}
  <ConfirmModal
    {show}
    title="Confirm example action"
    cancelText="Keep it"
    confirmText="Continue"
    cancelVariant="outline-primary"
    {confirmVariant}
    {size}
    {preventEscapeClose}
    onCancel={() => finish('Cancel callback fired.')}
    onConfirm={() => finish('Confirm callback fired.')}
    onClose={() => finish('Close callback fired.')}
  >
    <div class="rounded border border-border bg-surface p-4 text-foreground">
      This content comes from the children snippet.
    </div>
  </ConfirmModal>
{:else}
  <ConfirmModal
    {show}
    title="Confirm example action"
    message="This content comes from the message prop."
    cancelText="Keep it"
    confirmText="Continue"
    cancelVariant="outline-primary"
    {confirmVariant}
    {size}
    {preventEscapeClose}
    onCancel={() => finish('Cancel callback fired.')}
    onConfirm={() => finish('Confirm callback fired.')}
    onClose={() => finish('Close callback fired.')}
  />
{/if}
