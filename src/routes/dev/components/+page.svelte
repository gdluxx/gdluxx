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
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Icon } from '$lib/components';
  import ComponentTabs from './ComponentTabs.svelte';
  import { isComponentKey, type ComponentKey } from './catalog';
  import ButtonExamples from './examples/ButtonExamples.svelte';
  import ChipExamples from './examples/ChipExamples.svelte';
  import ConfirmModalExamples from './examples/ConfirmModalExamples.svelte';
  import CopyTooltipExamples from './examples/CopyTooltipExamples.svelte';
  import EmptyStateExamples from './examples/EmptyStateExamples.svelte';
  import FileDropzoneExamples from './examples/FileDropzoneExamples.svelte';
  import IconExamples from './examples/IconExamples.svelte';
  import InfoExamples from './examples/InfoExamples.svelte';
  import ModalExamples from './examples/ModalExamples.svelte';
  import OverflowMenuExamples from './examples/OverflowMenuExamples.svelte';
  import PageLayoutExamples from './examples/PageLayoutExamples.svelte';
  import SpinnerExamples from './examples/SpinnerExamples.svelte';
  import ToggleExamples from './examples/ToggleExamples.svelte';
  import TooltipExamples from './examples/TooltipExamples.svelte';

  const requestedKey = $derived(page.url.searchParams.get('component'));
  const activeKey = $derived<ComponentKey>(isComponentKey(requestedKey) ? requestedKey : 'button');
</script>

<svelte:head>
  <title>Component Gallery - gdluxx</title>
  <meta
    name="description"
    content="Development gallery for shared gdluxx UI components."
  />
</svelte:head>

<section
  class="space-y-6"
  aria-labelledby="component-gallery-title"
>
  <header>
    <a
      href={resolve('/dev')}
      class="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary focus:ring-2 focus:ring-focus focus:outline-hidden"
    >
      <Icon
        iconName="chevron-right"
        size={14}
        class="rotate-180"
      />
      Developer Tools
    </a>
    <div class="flex items-center gap-2">
      <Icon
        iconName="ui"
        size={24}
        class="text-primary"
      />
      <h1
        id="component-gallery-title"
        class="text-2xl font-bold text-primary"
      >
        Component Gallery
      </h1>
    </div>
    <p class="mt-1 text-sm text-muted-foreground">
      Shared component variants, sizes, states, and interactions.
    </p>
  </header>

  <ComponentTabs {activeKey} />

  <div>
    {#if activeKey === 'button'}
      <ButtonExamples />
    {:else if activeKey === 'chip'}
      <ChipExamples />
    {:else if activeKey === 'confirm-modal'}
      <ConfirmModalExamples />
    {:else if activeKey === 'copy-tooltip'}
      <CopyTooltipExamples />
    {:else if activeKey === 'empty-state'}
      <EmptyStateExamples />
    {:else if activeKey === 'file-dropzone'}
      <FileDropzoneExamples />
    {:else if activeKey === 'icon'}
      <IconExamples />
    {:else if activeKey === 'info'}
      <InfoExamples />
    {:else if activeKey === 'modal'}
      <ModalExamples />
    {:else if activeKey === 'overflow-menu'}
      <OverflowMenuExamples />
    {:else if activeKey === 'page-layout'}
      <PageLayoutExamples />
    {:else if activeKey === 'spinner'}
      <SpinnerExamples />
    {:else if activeKey === 'toggle'}
      <ToggleExamples />
    {:else}
      <TooltipExamples />
    {/if}
  </div>
</section>
