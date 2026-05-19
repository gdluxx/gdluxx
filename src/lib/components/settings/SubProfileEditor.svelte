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
  import { Modal, Button, Info, Toggle } from '$lib/components/ui';
  import type { ProfileScope, SubProfile, SubRule } from '$lib/extensionProfiles/types';

  interface Props {
    show: boolean;
    apiKeyId: string;
    profile: SubProfile | null;
    onClose: () => void;
    onSaved: () => void;
  }

  const { show, apiKeyId, profile, onClose, onSaved }: Props = $props();

  const isEdit = $derived(profile !== null);
  const MAX_RULES = 20;
  const ALLOWED_FLAGS = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);

  let scope = $state<ProfileScope>('host');
  let host = $state('');
  let originValue = $state('');
  let pathValue = $state('');
  let nameValue = $state('');
  let applyToPreview = $state(false);
  let rules = $state<SubRule[]>([]);
  let saving = $state(false);
  let error = $state<string | null>(null);

  function makeEmptyRule(order: number): SubRule {
    return {
      id: `draft_${Date.now()}_${order}_${Math.random().toString(36).slice(2, 6)}`,
      pattern: '',
      replacement: '',
      flags: 'g',
      enabled: true,
      order,
    };
  }

  $effect(() => {
    if (!show) {
      return;
    }
    if (profile) {
      scope = profile.scope;
      host = profile.host;
      originValue = profile.origin ?? '';
      pathValue = profile.path ?? '';
      nameValue = profile.name ?? '';
      applyToPreview = profile.applyToPreview;
      rules = profile.rules.map((rule) => ({ ...rule }));
    } else {
      scope = 'host';
      host = '';
      originValue = '';
      pathValue = '';
      nameValue = '';
      applyToPreview = false;
      rules = [makeEmptyRule(0)];
    }
    error = null;
    saving = false;
  });

  function ruleError(rule: SubRule): string | null {
    if (!rule.pattern.trim()) {
      return null;
    }
    for (const ch of rule.flags) {
      if (!ALLOWED_FLAGS.has(ch)) {
        return `Flag "${ch}" is not a recognized regex flag.`;
      }
    }
    if (new Set(rule.flags).size !== rule.flags.length) {
      return 'Regex flags must be unique.';
    }
    try {
      new RegExp(rule.pattern, rule.flags);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid regex.';
    }
  }

  function addRule(): void {
    if (rules.length >= MAX_RULES) {
      return;
    }
    rules = [...rules, makeEmptyRule(rules.length)];
  }

  function removeRule(id: string): void {
    rules = rules.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i }));
  }

  function moveRule(id: string, direction: -1 | 1): void {
    const idx = rules.findIndex((r) => r.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= rules.length) {
      return;
    }
    const next = [...rules];
    [next[idx], next[target]] = [next[target], next[idx]];
    rules = next.map((r, i) => ({ ...r, order: i }));
  }

  async function handleSave(): Promise<void> {
    error = null;

    const effective = rules.filter((r) => r.pattern.trim().length > 0);
    if (effective.length === 0) {
      error = 'Add at least one rule with a non-empty pattern.';
      return;
    }
    for (const rule of effective) {
      const ruleErr = ruleError(rule);
      if (ruleErr) {
        error = `Rule "${rule.pattern}": ${ruleErr}`;
        return;
      }
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
      const ruleBody = effective.map((rule) => ({
        id: rule.id.startsWith('draft_') ? undefined : rule.id,
        pattern: rule.pattern,
        replacement: rule.replacement,
        flags: rule.flags,
        enabled: rule.enabled,
      }));

      const body = isEdit
        ? {
            applyToPreview,
            name: nameValue.trim() || undefined,
            rules: ruleBody,
          }
        : {
            scope,
            host: host.trim(),
            origin: scope === 'host' ? undefined : originValue.trim() || undefined,
            path: scope === 'path' ? pathValue.trim() : undefined,
            applyToPreview,
            name: nameValue.trim() || undefined,
            rules: ruleBody,
          };

      const url =
        isEdit && profile
          ? `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/subs/${encodeURIComponent(profile.id)}`
          : `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/subs`;
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
  size="xl"
  {onClose}
>
  <div class="p-6">
    <h2 class="mb-3 text-xl font-semibold text-accent-foreground">
      {isEdit ? 'Edit substitution profile' : 'New substitution profile'}
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
          for="sub-scope"
        >
          Scope
        </label>
        <select
          id="sub-scope"
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
          for="sub-host"
        >
          Host
        </label>
        <input
          id="sub-host"
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
            for="sub-origin"
          >
            Origin
          </label>
          <input
            id="sub-origin"
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
            for="sub-path"
          >
            Path
          </label>
          <input
            id="sub-path"
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
          for="sub-name"
        >
          Name (optional)
        </label>
        <input
          id="sub-name"
          type="text"
          class="form-input"
          bind:value={nameValue}
          placeholder="Friendly label"
        />
      </div>

      <div class="flex items-center gap-3">
        <Toggle bind:checked={applyToPreview} />
        <span class="text-sm">Apply to previews</span>
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="font-semibold text-foreground">
            Rules ({rules.length}/{MAX_RULES})
          </span>
          <Button
            variant="default"
            onclick={addRule}
            disabled={rules.length >= MAX_RULES}
          >
            Add rule
          </Button>
        </div>

        {#if rules.length === 0}
          <p class="text-sm text-muted-foreground">No rules yet — add one above.</p>
        {:else}
          <div>
            {#each rules as rule, idx (rule.id)}
              {@const err = ruleError(rule)}
              <div class="data-list-item">
                <div class="flex flex-wrap items-start gap-2">
                  <div class="grid flex-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-muted-foreground"
                        for="rule-pattern-{rule.id}"
                      >
                        Pattern
                      </label>
                      <input
                        id="rule-pattern-{rule.id}"
                        type="text"
                        class="form-input form-input-sm font-mono"
                        bind:value={rule.pattern}
                        placeholder="^https://"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-muted-foreground"
                        for="rule-replacement-{rule.id}"
                      >
                        Replacement
                      </label>
                      <input
                        id="rule-replacement-{rule.id}"
                        type="text"
                        class="form-input form-input-sm font-mono"
                        bind:value={rule.replacement}
                        placeholder="https://"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-muted-foreground"
                        for="rule-flags-{rule.id}"
                      >
                        Flags
                      </label>
                      <input
                        id="rule-flags-{rule.id}"
                        type="text"
                        class="form-input form-input-sm font-mono"
                        bind:value={rule.flags}
                        placeholder="g"
                      />
                    </div>
                  </div>
                  <div class="flex flex-col gap-1">
                    <Button
                      variant="default"
                      onclick={() => moveRule(rule.id, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="default"
                      onclick={() => moveRule(rule.id, 1)}
                      disabled={idx === rules.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
                <div class="mt-2 flex items-center justify-between gap-2">
                  <label class="flex items-center gap-2 text-xs">
                    <Toggle bind:checked={rule.enabled} />
                    <span>Enabled</span>
                  </label>
                  <Button
                    variant="outline-danger"
                    onclick={() => removeRule(rule.id)}
                  >
                    Remove
                  </Button>
                </div>
                {#if err}
                  <p class="mt-2 text-xs text-error">{err}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
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
