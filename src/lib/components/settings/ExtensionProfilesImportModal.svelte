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
  import { toastStore } from '$lib/stores/toast';

  interface Props {
    apiKeyId: string;
    apiKeyName: string;
    onClose: () => void;
    onImported: () => void;
  }

  const { apiKeyId, apiKeyName, onClose, onImported }: Props = $props();

  let pastedJson = $state('');
  let errorMessage = $state('');
  let submitting = $state(false);

  function handleFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    file.text().then((text) => {
      pastedJson = text;
      errorMessage = '';
    });
  }

  async function handleSubmit(): Promise<void> {
    errorMessage = '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(pastedJson);
    } catch {
      errorMessage = 'Not valid JSON.';
      return;
    }

    submitting = true;
    try {
      const response = await fetch(
        `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        errorMessage = payload?.error ?? `Server error: ${response.status}`;
        return;
      }

      const { selectors, subs } = payload.data as {
        selectors: { added: number; updated: number; total: number };
        subs: { added: number; updated: number; total: number };
      };

      toastStore.success(
        'Import complete',
        `Imported ${selectors.added + selectors.updated} selector profile(s) (${selectors.added} new, ${selectors.updated} updated) and ${subs.added + subs.updated} substitution profile(s) (${subs.added} new, ${subs.updated} updated).`,
      );
      onImported();
    } finally {
      submitting = false;
    }
  }
</script>

<Modal
  show={true}
  size="lg"
  {onClose}
>
  <div class="p-6">
    <h2 class="mb-1 text-lg font-semibold">Import profiles</h2>
    <p class="mb-4 text-sm text-muted-foreground">
      Importing into key: <span class="font-medium text-foreground">{apiKeyName}</span>. Existing
      profiles with the same id will be overwritten; others are preserved.
    </p>

    <div class="space-y-4">
      <div>
        <label
          class="mb-1 block text-sm font-medium"
          for="import-file-picker"
        >
          Choose a file
        </label>
        <input
          id="import-file-picker"
          type="file"
          accept="application/json,.json"
          class="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-active file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-surface-hover"
          onchange={handleFileChange}
        />
      </div>

      <div>
        <label
          class="mb-1 block text-sm font-medium"
          for="import-textarea"
        >
          Or paste JSON
        </label>
        <textarea
          id="import-textarea"
          bind:value={pastedJson}
          rows={14}
          class="focus:ring-ring w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs focus:ring-2 focus:outline-none"
          placeholder="Paste exported JSON here…"
          spellcheck="false"
        ></textarea>
      </div>

      {#if errorMessage}
        <Info variant="error">
          <p class="text-sm whitespace-pre-wrap">{errorMessage}</p>
        </Info>
      {/if}

      <div class="flex justify-end gap-2">
        <Button
          variant="default"
          onclick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onclick={handleSubmit}
          disabled={submitting || !pastedJson.trim()}
        >
          {submitting ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  </div>
</Modal>
