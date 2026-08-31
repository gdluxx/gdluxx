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
  import { onMount } from 'svelte';
  import { Icon } from '$lib/components';
  import {
    Button,
    Chip,
    Field,
    Info,
    Modal,
    OverflowMenu,
    PageLayout,
    Spinner,
    Toggle,
    Tooltip,
  } from '$lib/components/ui';
  import { toastStore } from '$lib/stores/toast';
  import {
    applyTheme,
    getCurrentTheme,
    getCurrentMode,
    AVAILABLE_THEMES,
    type ThemeName,
    type ResolvedThemeMode,
  } from '$lib/themes/themeUtils';

  const themeNames = Object.keys(AVAILABLE_THEMES) as ThemeName[];

  let activeTheme = $state<ThemeName>('indigo');
  let activeMode = $state<ResolvedThemeMode>('dark');
  let showModal = $state(false);
  let toggleOn = $state(true);
  let toggleOff = $state(false);

  const tabs = [
    { key: 'panels', label: 'Panels' },
    { key: 'data-lists', label: 'Data lists' },
    { key: 'forms', label: 'Forms' },
    { key: 'scrim', label: 'Scrim' },
    { key: 'primitives', label: 'Primitives' },
    { key: 'states', label: 'States board' },
  ] as const;
  type TabKey = (typeof tabs)[number]['key'];
  let activeTab = $state<TabKey>('panels');

  const buttonVariants = [
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
  ] as const;

  const chipVariants = [
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

  function switchTo(theme: ThemeName, mode: ResolvedThemeMode) {
    activeTheme = theme;
    activeMode = mode;
    // Gallery-local switching: applies classes without persisting anything.
    applyTheme(theme, mode);
  }

  onMount(() => {
    const restoreTheme = getCurrentTheme();
    const restoreMode = getCurrentMode();
    activeTheme = restoreTheme;
    activeMode = restoreMode;
    return () => applyTheme(restoreTheme, restoreMode);
  });
</script>

<PageLayout
  title="Theme QA"
  description="Exercises every role recipe, primitive, and interaction state across all registered themes and both modes."
>
  {#snippet icon()}
    <Icon
      iconName="ui"
      size={24}
    />
  {/snippet}

  <!-- Gallery-local theme + mode switcher -->
  <div class="data-list-controls mb-6 flex flex-wrap items-center gap-2">
    {#each themeNames as name (name)}
      <button
        type="button"
        class="cursor-pointer rounded-pill border px-3 py-1 text-xs font-medium transition-colors {activeTheme ===
        name
          ? 'border-primary bg-primary text-on-primary'
          : 'border-strong bg-surface text-foreground hover:border-primary'}"
        aria-pressed={activeTheme === name}
        onclick={() => switchTo(name, activeMode)}
      >
        {AVAILABLE_THEMES[name].displayName}
      </button>
    {/each}
    <span class="mx-2 border-r-strong self-stretch"></span>
    {#each ['light', 'dark'] as const as mode (mode)}
      <button
        type="button"
        class="cursor-pointer rounded-pill border px-3 py-1 text-xs font-medium transition-colors {activeMode ===
        mode
          ? 'border-primary bg-primary text-on-primary'
          : 'border-strong bg-surface text-foreground hover:border-primary'}"
        aria-pressed={activeMode === mode}
        onclick={() => switchTo(activeTheme, mode)}
      >
        {mode}
      </button>
    {/each}
  </div>

  <!-- Role-recipe tabs -->
  <div
    class="mb-6 flex gap-1 overflow-x-auto border-b-strong"
    role="tablist"
    aria-label="Theme QA sections"
  >
    {#each tabs as tab (tab.key)}
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === tab.key}
        class="cursor-pointer border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors {activeTab ===
        tab.key
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'}"
        onclick={() => (activeTab = tab.key)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab === 'panels'}
    <div class="space-y-6">
      <div class="content-panel">
        <h2>content-panel</h2>
        <p class="text-sm text-muted-foreground">
          Surface radius role, stroke dial, surface background.
        </p>
      </div>
      <div class="content-panel-elevated">
        <h2 class="mb-2 text-xl font-semibold text-accent-foreground">content-panel-elevated</h2>
        <p class="text-sm text-muted-foreground">Raised elevation plane; accent border.</p>
      </div>
      <div class="content-panel-sunken">
        <h2 class="mb-2 text-xl font-semibold text-accent-foreground">content-panel-sunken</h2>
        <p class="text-sm text-muted-foreground">Sunken surface; accent border.</p>
      </div>
    </div>
  {:else if activeTab === 'data-lists'}
    <div class="data-list">
      <div class="data-list-header">
        <h2>data-list-header</h2>
      </div>
      <div class="data-list-item">data-list-item (hover me)</div>
      <div class="data-list-item data-list-item-interactive">data-list-item-interactive</div>
      <div class="data-list-item data-list-item-disabled">data-list-item-disabled</div>
      <div class="m-4 grid gap-4 sm:grid-cols-2">
        <div class="data-list-stats">data-list-stats</div>
        <div class="data-list-controls">data-list-controls</div>
      </div>
    </div>
  {:else if activeTab === 'forms'}
    <div class="content-panel max-w-xl space-y-4">
      <Field
        label="Field with form-input"
        id="qa-input"
      >
        {#snippet control({ id, describedBy, invalid })}
          <input
            {id}
            class="form-input"
            placeholder="Rest / focus / typing"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        {/snippet}
      </Field>
      <Field
        label="Field with error"
        id="qa-input-error"
        error="Validation error text on the error composite"
      >
        {#snippet control({ id, describedBy, invalid })}
          <input
            {id}
            class="form-input form-input-error"
            value="Invalid value"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        {/snippet}
      </Field>
      <input
        class="form-input form-input-success"
        value="Valid value"
        aria-label="Success input"
      />
      <input
        class="form-input"
        value="Disabled value"
        disabled
        aria-label="Disabled input"
      />
      <textarea
        class="form-textarea"
        placeholder="form-textarea"
        aria-label="Textarea"></textarea>
      <select
        class="form-select"
        aria-label="Select"
      >
        <option>form-select option one</option>
        <option>Option two</option>
      </select>
    </div>
  {:else if activeTab === 'scrim'}
    <div class="content-panel space-y-4">
      <p class="text-sm text-muted-foreground">
        The scrim recipe (color token + backdrop-filter dial) over sample content, and the Modal
        backdrop using the same declarations on ::backdrop.
      </p>
      <div class="relative h-48 overflow-hidden rounded-surface border-strong">
        <div class="p-4 font-mono text-sm text-foreground">
          Sample content underneath. 0123456789 abcdefghijklmnopqrstuvwxyz. The quick brown fox
          jumps over the lazy dog, repeatedly, to make blur legible.
        </div>
        <div class="scrim absolute inset-0"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-inverse font-semibold">.scrim overlay</span>
        </div>
      </div>
      <Button
        variant="primary"
        onclick={() => (showModal = true)}>Open Modal (overlay plane + ::backdrop)</Button
      >
    </div>
  {:else if activeTab === 'primitives'}
    <div class="space-y-6">
      <div class="content-panel">
        <h3>Radius roles</h3>
        <div class="flex flex-wrap items-center gap-4">
          <div class="rounded-control border-strong bg-surface-elevated px-4 py-2">control</div>
          <div class="rounded-surface border-strong bg-surface-elevated px-4 py-2">surface</div>
          <div class="rounded-overlay border-strong bg-surface-elevated px-4 py-2">overlay</div>
          <div class="rounded-pill border-strong bg-surface-elevated px-4 py-2">pill</div>
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full border-strong bg-surface-elevated text-xs"
          >
            circle
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          The circle is structural (H15): it must stay round in every theme, including squared ones.
        </p>
      </div>
      <div class="content-panel">
        <h3>Elevation roles</h3>
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="shadow-raised rounded-surface bg-surface-elevated p-4">shadow-raised</div>
          <div class="shadow-floating rounded-surface bg-surface-elevated p-4">shadow-floating</div>
          <div class="shadow-overlay rounded-surface bg-surface-elevated p-4">shadow-overlay</div>
        </div>
      </div>
      <div class="content-panel">
        <h3>Stroke and borders</h3>
        <div class="flex flex-wrap gap-4">
          <div class="border-strong rounded-surface px-4 py-2">border-strong</div>
          <div class="border-focus rounded-surface px-4 py-2">border-focus</div>
          <div class="rounded-surface border border-error px-4 py-2">border + border-error</div>
          <div class="rounded-surface border-t-strong px-4 py-2">border-t-strong</div>
          <div class="rounded-surface border-b-strong px-4 py-2">border-b-strong</div>
        </div>
      </div>
      <div class="content-panel">
        <h3>On-color text and feedback</h3>
        <div class="flex flex-wrap gap-2">
          <span class="rounded-control bg-primary px-3 py-1 text-on-primary">text-on-primary</span>
          <span class="rounded-control bg-success px-3 py-1 text-on-success">text-on-success</span>
          <span class="rounded-control bg-warning px-3 py-1 text-on-warning">text-on-warning</span>
          <span class="rounded-control bg-error px-3 py-1 text-on-error">text-on-error</span>
          <span class="rounded-control bg-info px-3 py-1 text-on-info">text-on-info</span>
          <span class="rounded-control bg-foreground px-3 py-1 text-inverse">text-inverse</span>
          <span class="rounded-control bg-surface-disabled px-3 py-1 text-disabled"
            >text-disabled</span
          >
        </div>
        <div class="mt-4 flex items-center gap-4">
          <Spinner size={24} />
          <div class="h-6 w-40 animate-pulse rounded-control bg-skeleton"></div>
          <span class="h-3 w-3 rounded-full bg-success"></span>
          <span class="h-3 w-3 rounded-full bg-warning"></span>
          <span class="h-3 w-3 rounded-full bg-error"></span>
          <span class="h-3 w-3 animate-pulse rounded-full bg-info"></span>
        </div>
      </div>
      <div class="content-panel">
        <h3>Motion paces</h3>
        <div class="flex gap-4">
          <div
            class="rounded-control border-strong bg-surface-elevated px-4 py-2 transition-colors duration-fast hover:bg-surface-active"
          >
            duration-fast (hover)
          </div>
          <div
            class="rounded-control border-strong bg-surface-elevated px-4 py-2 transition-colors duration-base hover:bg-surface-active"
          >
            duration-base (hover)
          </div>
        </div>
      </div>
      <div class="content-panel">
        <h3>Type families</h3>
        <p class="font-sans">font-sans: The quick brown fox jumps over the lazy dog 0123456789.</p>
        <p class="font-mono">font-mono: The quick brown fox jumps over the lazy dog 0123456789.</p>
      </div>
    </div>
  {:else if activeTab === 'states'}
    <div class="space-y-6">
      <div class="content-panel">
        <h3>Button: every variant at rest / disabled / loading / disabled loading</h3>
        <div class="space-y-2">
          {#each buttonVariants as variant (variant)}
            <div class="flex flex-wrap items-center gap-2">
              <Button {variant}>{variant}</Button>
              <Button
                {variant}
                disabled>disabled</Button
              >
              <Button
                {variant}
                loading>loading</Button
              >
              <Button
                {variant}
                disabled
                loading>disabled loading</Button
              >
            </div>
          {/each}
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Hover, press, and keyboard-focus the live buttons: hover lifts to the raised plane, press
          swaps to the -active background (survives flat themes), focus renders the global outline.
        </p>
      </div>

      <div class="content-panel">
        <h3>Chip variants, dismissible, editable, and disabled</h3>
        <div class="flex flex-wrap gap-2">
          {#each chipVariants as variant (variant)}
            <Chip
              {variant}
              label={variant}
              dismissible
            />
            <Chip
              {variant}
              label="disabled {variant}"
              dismissible
              disabled
            />
          {/each}
          <Chip
            variant="primary"
            label="editable"
            value="value"
            editable
          />
        </div>
      </div>

      <div class="content-panel">
        <h3>Tooltip tints</h3>
        <div class="flex flex-wrap gap-3">
          <Tooltip
            content="Info tooltip"
            variant="info"
            trigger="manual"
            show
            placement="auto"
            class="static! opacity-100!"
          />
          <Tooltip
            content="Warning tooltip"
            variant="warning"
            trigger="manual"
            show
            placement="auto"
            class="static! opacity-100!"
          />
          <Tooltip
            content="Danger tooltip"
            variant="danger"
            trigger="manual"
            show
            placement="auto"
            class="static! opacity-100!"
          />
        </div>
      </div>

      <div class="content-panel">
        <h3>Toggle: off / on / disabled (keyboard focus must be visible)</h3>
        <div class="flex flex-wrap gap-6">
          <Toggle
            bind:checked={toggleOff}
            label="Off"
          />
          <Toggle
            bind:checked={toggleOn}
            label="On"
          />
          <Toggle
            checked
            disabled
            label="Disabled"
          />
        </div>
      </div>

      <div class="content-panel">
        <h3>Info banners</h3>
        <div class="space-y-2">
          <Info
            variant="success"
            title="Success">Success body text.</Info
          >
          <Info
            variant="warning"
            title="Warning">Warning body text.</Info
          >
          <Info
            variant="error"
            title="Error">Error body text.</Info
          >
          <Info
            variant="info"
            title="Info"
            dismissible>Dismissible info body text.</Info
          >
        </div>
      </div>

      <div class="content-panel">
        <h3>Selected states</h3>
        <div class="flex flex-wrap items-center gap-3">
          <div class="rounded-surface border border-primary bg-primary/10 px-3 py-1.5">
            stat-card selected
          </div>
          <div class="rounded-surface border border-primary bg-surface-selected px-3 py-1.5">
            surface-selected
          </div>
          <button
            type="button"
            class="cursor-pointer rounded-pill border border-primary bg-primary px-3 py-1 text-xs text-on-primary"
          >
            pill selected
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-pill border border-strong bg-surface px-3 py-1 text-xs text-foreground"
          >
            pill unselected
          </button>
        </div>
      </div>

      <div class="content-panel">
        <h3>Overlays</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Button onclick={() => (showModal = true)}>Modal</Button>
          <Button onclick={() => toastStore.success('Toast', 'Floating plane, overlay radius')}>
            Toast
          </Button>
          <OverflowMenu
            ariaLabel="QA overflow menu"
            items={[
              { label: 'Menu item one', onSelect: () => undefined },
              { label: 'Menu item two', onSelect: () => undefined },
              { label: 'Destructive', variant: 'danger', onSelect: () => undefined },
            ]}
          />
          <Tooltip content="Floating tooltip on the overlay radius">
            <span class="rounded-control border-strong px-3 py-1 text-sm">hover for tooltip</span>
          </Tooltip>
        </div>
      </div>
    </div>
  {/if}
</PageLayout>

<Modal
  show={showModal}
  size="md"
  onClose={() => (showModal = false)}
>
  <div class="p-6">
    <h3 class="mb-2 text-lg font-semibold text-foreground">Overlay plane</h3>
    <p class="text-sm text-muted-foreground">
      The modal sits on shadow-overlay with the overlay radius; its backdrop repeats the scrim
      declarations. Check the focus ring on this button against the elevated surface.
    </p>
    <div class="mt-4 flex justify-end gap-2">
      <Button onclick={() => (showModal = false)}>Close</Button>
      <Button variant="primary">Primary</Button>
    </div>
  </div>
</Modal>
