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
  import { Modal, Button, Info } from '$lib/components/ui';
  import type { ProfileScope, SelectorProfile } from '$lib/extensionProfiles/types';

  interface Props {
    show: boolean;
    apiKeyId: string;
    profile: SelectorProfile | null;
    onClose: () => void;
    onSaved: () => void;
  }

  const { show, apiKeyId, profile, onClose, onSaved }: Props = $props();

  const isEdit = $derived(profile !== null);

  let scope = $state<ProfileScope>('host');
  let host = $state('');
  let originValue = $state('');
  let pathValue = $state('');
  let startSelector = $state('');
  let endSelector = $state('');
  let nameValue = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!show) {
      return;
    }
    if (profile) {
      scope = profile.scope;
      host = profile.host;
      originValue = profile.origin ?? '';
      pathValue = profile.path ?? '';
      startSelector = profile.startSelector;
      endSelector = profile.endSelector;
      nameValue = profile.name ?? '';
    } else {
      scope = 'host';
      host = '';
      originValue = '';
      pathValue = '';
      startSelector = '';
      endSelector = '';
      nameValue = '';
    }
    error = null;
    saving = false;
  });

  async function handleSave(): Promise<void> {
    error = null;
    if (!startSelector.trim() && !endSelector.trim()) {
      error = 'At least one of start or end selector must be filled in.';
      return;
    }
    if (!isEdit && !host.trim()) {
      error = 'Host is required.';
      return;
    }
    if (!isEdit && scope === 'origin' && !originValue.trim()) {
      error = 'Origin is required when scope is "origin".';
      return;
    }
    if (!isEdit && scope === 'path' && !pathValue.trim()) {
      error = 'Path is required when scope is "path".';
      return;
    }

    saving = true;
    try {
      const body = isEdit
        ? {
            startSelector: startSelector.trim(),
            endSelector: endSelector.trim(),
            name: nameValue.trim() || undefined,
          }
        : {
            scope,
            host: host.trim(),
            origin: scope === 'host' ? undefined : originValue.trim() || undefined,
            path: scope === 'path' ? pathValue.trim() : undefined,
            startSelector: startSelector.trim(),
            endSelector: endSelector.trim(),
            name: nameValue.trim() || undefined,
          };

      const url =
        isEdit && profile
          ? `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/selectors/${encodeURIComponent(profile.id)}`
          : `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/selectors`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        error = payload?.error ?? `Server error: ${response.status}`;
        saving = false;
        return;
      }

      onSaved();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      saving = false;
    }
  }
</script>

<Modal
  {show}
  size="lg"
  {onClose}
>
  <div class="p-6">
    <h2 class="mb-4 text-lg font-semibold">
      {isEdit ? 'Edit selector profile' : 'New selector profile'}
    </h2>

    {#if error}
      <div class="mb-4">
        <Info variant="error">
          <p class="text-sm">{error}</p>
        </Info>
      </div>
    {/if}

    <div class="space-y-4">
      <div>
        <label
          class="mb-1 block text-sm font-medium text-muted-foreground"
          for="selector-scope"
        >
          Scope
        </label>
        <select
          id="selector-scope"
          class="form-select"
          bind:value={scope}
          disabled={isEdit}
        >
          <option value="host">Host (e.g. example.com)</option>
          <option value="origin">Origin (e.g. https://example.com)</option>
          <option value="path">Path (e.g. example.com/gallery/123)</option>
        </select>
        {#if isEdit}
          <p class="mt-1 text-xs text-muted-foreground">
            To change scope/host/path, delete this profile and create a new one.
          </p>
        {/if}
      </div>

      <div>
        <label
          class="mb-1 block text-sm font-medium text-muted-foreground"
          for="selector-host"
        >
          Host
        </label>
        <input
          id="selector-host"
          type="text"
          class="form-input"
          bind:value={host}
          placeholder="example.com"
          disabled={isEdit}
        />
      </div>

      {#if scope === 'origin'}
        <div>
          <label
            class="mb-1 block text-sm font-medium text-muted-foreground"
            for="selector-origin"
          >
            Origin
          </label>
          <input
            id="selector-origin"
            type="text"
            class="form-input"
            bind:value={originValue}
            placeholder="https://example.com"
            disabled={isEdit}
          />
        </div>
      {:else if scope === 'path'}
        <div>
          <label
            class="mb-1 block text-sm font-medium text-muted-foreground"
            for="selector-path"
          >
            Path
          </label>
          <input
            id="selector-path"
            type="text"
            class="form-input"
            bind:value={pathValue}
            placeholder="/gallery/123"
            disabled={isEdit}
          />
        </div>
      {/if}

      <div>
        <label
          class="mb-1 block text-sm font-medium text-muted-foreground"
          for="selector-start"
        >
          Start selector
        </label>
        <input
          id="selector-start"
          type="text"
          class="form-input"
          bind:value={startSelector}
          placeholder="#first-link"
        />
      </div>

      <div>
        <label
          class="mb-1 block text-sm font-medium text-muted-foreground"
          for="selector-end"
        >
          End selector
        </label>
        <input
          id="selector-end"
          type="text"
          class="form-input"
          bind:value={endSelector}
          placeholder="#last-link"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          At least one of start or end selector must be set.
        </p>
      </div>

      <div>
        <label
          class="mb-1 block text-sm font-medium text-muted-foreground"
          for="selector-name"
        >
          Name (optional)
        </label>
        <input
          id="selector-name"
          type="text"
          class="form-input"
          bind:value={nameValue}
          placeholder="Friendly label"
        />
      </div>
    </div>

    <div class="mt-6 flex justify-end gap-2">
      <Button
        variant="default"
        onclick={onClose}
        disabled={saving}>Cancel</Button
      >
      <Button
        variant="primary"
        onclick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
      </Button>
    </div>
  </div>
</Modal>
