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
  import type {
    ContainerSource,
    ExtractionConfig,
    ExtractionMode,
    ExtractionProfile,
    GalleryDisplayConfig,
    ImageSource,
    ProfileScope,
    SubRule,
  } from '$lib/extensionProfiles/types';

  interface Props {
    show: boolean;
    apiKeyId: string;
    profile: ExtractionProfile | null;
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
  let autoApply = $state(true);

  let mode = $state<ExtractionMode>('range');
  let startSelector = $state('');
  let endSelector = $state('');
  let containerVia = $state<'body' | 'selector' | 'string'>('body');
  let containerSelector = $state('');
  let containerBegin = $state('');
  let containerEnd = $state('');
  let imagesVia = $state<'selector' | 'string'>('selector');
  let imagesSelector = $state('');
  let imagesAttr = $state('');
  let imagesBegin = $state('');
  let imagesEnd = $state('');

  let rules = $state<SubRule[]>([]);

  let galleryEnabled = $state(false);
  let thumbSmall = $state(150);
  let thumbMedium = $state(200);
  let thumbLarge = $state(300);
  let galleryGap = $state(12);
  let galleryBorder = $state(30);
  let galleryCorner = $state<GalleryDisplayConfig['buttonCorner']>('bottom-right');

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
      autoApply = profile.autoApply;
      rules = profile.rules.map((rule) => ({ ...rule }));

      mode = profile.extraction.mode;
      if (profile.extraction.mode === 'range') {
        startSelector = profile.extraction.startSelector;
        endSelector = profile.extraction.endSelector;
        containerVia = 'body';
        containerSelector = '';
        containerBegin = '';
        containerEnd = '';
        imagesVia = 'selector';
        imagesSelector = '';
        imagesAttr = '';
        imagesBegin = '';
        imagesEnd = '';
      } else {
        startSelector = '';
        endSelector = '';
        const container = profile.extraction.container;
        containerVia = container.via;
        containerSelector = container.via === 'selector' ? container.selector : '';
        containerBegin = container.via === 'string' ? container.begin : '';
        containerEnd = container.via === 'string' ? container.end : '';
        const images = profile.extraction.images;
        imagesVia = images.via;
        imagesSelector = images.via === 'selector' ? images.selector : '';
        imagesAttr = images.via === 'selector' ? images.attr : '';
        imagesBegin = images.via === 'string' ? images.begin : '';
        imagesEnd = images.via === 'string' ? images.end : '';
      }

      galleryEnabled = profile.gallery !== undefined;
      thumbSmall = profile.gallery?.thumbSizes[0] ?? 150;
      thumbMedium = profile.gallery?.thumbSizes[1] ?? 200;
      thumbLarge = profile.gallery?.thumbSizes[2] ?? 300;
      galleryGap = profile.gallery?.gap ?? 12;
      galleryBorder = profile.gallery?.border ?? 30;
      galleryCorner = profile.gallery?.buttonCorner ?? 'bottom-right';
    } else {
      scope = 'host';
      host = '';
      originValue = '';
      pathValue = '';
      nameValue = '';
      applyToPreview = false;
      autoApply = true;
      rules = [];
      mode = 'range';
      startSelector = '';
      endSelector = '';
      containerVia = 'body';
      containerSelector = '';
      containerBegin = '';
      containerEnd = '';
      imagesVia = 'selector';
      imagesSelector = '';
      imagesAttr = '';
      imagesBegin = '';
      imagesEnd = '';
      galleryEnabled = false;
      thumbSmall = 150;
      thumbMedium = 200;
      thumbLarge = 300;
      galleryGap = 12;
      galleryBorder = 30;
      galleryCorner = 'bottom-right';
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

  function isPositiveInt(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  function isNonNegativeInt(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  }

  function validate(): string | null {
    if (!isEdit) {
      if (!host.trim()) {
        return 'Host is required.';
      }
      if (scope === 'origin' && !originValue.trim()) {
        return 'Origin is required when scope is "origin".';
      }
      if (scope === 'path' && !pathValue.trim()) {
        return 'Path is required when scope is "path".';
      }
    }

    if (mode === 'targeted') {
      if (containerVia === 'selector' && !containerSelector.trim()) {
        return 'Container selector is required.';
      }
      if (containerVia === 'string' && (!containerBegin || !containerEnd)) {
        return 'Container begin and end markers are required.';
      }
      if (imagesVia === 'selector' && !imagesSelector.trim()) {
        return 'Image selector is required.';
      }
      if (imagesVia === 'string' && (!imagesBegin || !imagesEnd)) {
        return 'Image begin and end markers are required.';
      }
    }

    for (const rule of rules) {
      if (!rule.pattern.trim()) {
        continue;
      }
      const ruleErr = ruleError(rule);
      if (ruleErr) {
        return `Rule "${rule.pattern}": ${ruleErr}`;
      }
    }

    if (galleryEnabled) {
      if (![thumbSmall, thumbMedium, thumbLarge].every(isPositiveInt)) {
        return 'Thumbnail sizes must be positive whole numbers.';
      }
      if (!isNonNegativeInt(galleryGap) || !isNonNegativeInt(galleryBorder)) {
        return 'Gallery gap and border must be zero or a positive whole number.';
      }
    }

    const hasContent =
      mode === 'targeted' ||
      startSelector.trim().length > 0 ||
      endSelector.trim().length > 0 ||
      rules.some((r) => r.pattern.trim().length > 0) ||
      galleryEnabled;
    if (!hasContent) {
      return 'Add selectors, a targeted config, a rule, or a gallery override.';
    }

    return null;
  }

  function buildExtraction(): ExtractionConfig {
    if (mode === 'range') {
      return {
        mode: 'range',
        startSelector: startSelector.trim(),
        endSelector: endSelector.trim(),
      };
    }
    let container: ContainerSource;
    if (containerVia === 'selector') {
      container = { via: 'selector', selector: containerSelector.trim() };
    } else if (containerVia === 'string') {
      container = { via: 'string', begin: containerBegin, end: containerEnd };
    } else {
      container = { via: 'body' };
    }
    const images: ImageSource =
      imagesVia === 'selector'
        ? { via: 'selector', selector: imagesSelector.trim(), attr: imagesAttr.trim() || 'src' }
        : { via: 'string', begin: imagesBegin, end: imagesEnd };
    return { mode: 'targeted', container, images };
  }

  async function handleSave(): Promise<void> {
    error = validate();
    if (error) {
      return;
    }

    saving = true;
    try {
      const ruleBody = rules
        .filter((rule) => rule.pattern.trim().length > 0)
        .map((rule) => ({
          id: rule.id.startsWith('draft_') ? undefined : rule.id,
          pattern: rule.pattern,
          replacement: rule.replacement,
          flags: rule.flags,
          enabled: rule.enabled,
        }));

      const gallery: GalleryDisplayConfig | undefined = galleryEnabled
        ? {
            thumbSizes: [thumbSmall, thumbMedium, thumbLarge],
            gap: galleryGap,
            border: galleryBorder,
            buttonCorner: galleryCorner,
          }
        : undefined;

      const common = {
        name: nameValue.trim() || undefined,
        extraction: buildExtraction(),
        rules: ruleBody,
        applyToPreview,
        autoApply,
        gallery,
      };

      const body = isEdit
        ? common
        : {
            ...common,
            scope,
            host: host.trim(),
            origin: scope === 'host' ? undefined : originValue.trim() || undefined,
            path: scope === 'path' ? pathValue.trim() : undefined,
          };

      const url =
        isEdit && profile
          ? `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/extraction/${encodeURIComponent(profile.id)}`
          : `/api/settings/extension-profiles/${encodeURIComponent(apiKeyId)}/extraction`;
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
      {isEdit ? 'Edit extraction profile' : 'New extraction profile'}
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
          for="extraction-scope"
        >
          Scope
        </label>
        <select
          id="extraction-scope"
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
          for="extraction-host"
        >
          Host
        </label>
        <input
          id="extraction-host"
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
            for="extraction-origin"
          >
            Origin
          </label>
          <input
            id="extraction-origin"
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
            for="extraction-path"
          >
            Path
          </label>
          <input
            id="extraction-path"
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
          for="extraction-name"
        >
          Name (optional)
        </label>
        <input
          id="extraction-name"
          type="text"
          class="form-input"
          bind:value={nameValue}
          placeholder="Friendly label"
        />
      </div>

      <div class="flex flex-wrap gap-6">
        <label class="flex items-center gap-3 text-sm">
          <Toggle bind:checked={autoApply} />
          <span>Auto-apply on matching pages</span>
        </label>
        <label class="flex items-center gap-3 text-sm">
          <Toggle bind:checked={applyToPreview} />
          <span>Apply to previews</span>
        </label>
      </div>

      <div>
        <label
          class="mb-1 block text-sm font-medium text-muted-foreground"
          for="extraction-mode"
        >
          Extraction mode
        </label>
        <select
          id="extraction-mode"
          class="form-select"
          bind:value={mode}
        >
          <option value="range">Range (start/end selectors)</option>
          <option value="targeted">Targeted (container + images)</option>
        </select>
      </div>

      {#if mode === 'range'}
        <div class="grid gap-2 sm:grid-cols-2">
          <div>
            <label
              class="mb-1 block text-sm font-medium text-muted-foreground"
              for="extraction-start-selector"
            >
              Start selector
            </label>
            <input
              id="extraction-start-selector"
              type="text"
              class="form-input font-mono"
              bind:value={startSelector}
              placeholder="#content"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-sm font-medium text-muted-foreground"
              for="extraction-end-selector"
            >
              End selector
            </label>
            <input
              id="extraction-end-selector"
              type="text"
              class="form-input font-mono"
              bind:value={endSelector}
              placeholder="#footer"
            />
          </div>
        </div>
      {:else}
        <div class="space-y-3">
          <div>
            <label
              class="mb-1 block text-sm font-medium text-muted-foreground"
              for="extraction-container-via"
            >
              Container source
            </label>
            <select
              id="extraction-container-via"
              class="form-select"
              bind:value={containerVia}
            >
              <option value="body">Whole page body</option>
              <option value="selector">CSS selector</option>
              <option value="string">String markers</option>
            </select>
          </div>

          {#if containerVia === 'selector'}
            <div>
              <label
                class="mb-1 block text-sm font-medium text-muted-foreground"
                for="extraction-container-selector"
              >
                Container selector
              </label>
              <input
                id="extraction-container-selector"
                type="text"
                class="form-input font-mono"
                bind:value={containerSelector}
                placeholder=".gallery"
              />
            </div>
          {:else if containerVia === 'string'}
            <div class="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-muted-foreground"
                  for="extraction-container-begin"
                >
                  Begin marker
                </label>
                <input
                  id="extraction-container-begin"
                  type="text"
                  class="form-input font-mono"
                  bind:value={containerBegin}
                  placeholder="<div class=&quot;gallery&quot;>"
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-muted-foreground"
                  for="extraction-container-end"
                >
                  End marker
                </label>
                <input
                  id="extraction-container-end"
                  type="text"
                  class="form-input font-mono"
                  bind:value={containerEnd}
                  placeholder="</div>"
                />
              </div>
            </div>
          {/if}

          <div>
            <label
              class="mb-1 block text-sm font-medium text-muted-foreground"
              for="extraction-images-via"
            >
              Image source
            </label>
            <select
              id="extraction-images-via"
              class="form-select"
              bind:value={imagesVia}
            >
              <option value="selector">CSS selector + attribute</option>
              <option value="string">String markers</option>
            </select>
          </div>

          {#if imagesVia === 'selector'}
            <div class="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-muted-foreground"
                  for="extraction-images-selector"
                >
                  Image selector
                </label>
                <input
                  id="extraction-images-selector"
                  type="text"
                  class="form-input font-mono"
                  bind:value={imagesSelector}
                  placeholder="img.thumb"
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-muted-foreground"
                  for="extraction-images-attr"
                >
                  Attribute
                </label>
                <input
                  id="extraction-images-attr"
                  type="text"
                  class="form-input font-mono"
                  bind:value={imagesAttr}
                  placeholder="src"
                />
              </div>
            </div>
          {:else}
            <div class="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-muted-foreground"
                  for="extraction-images-begin"
                >
                  Begin marker
                </label>
                <input
                  id="extraction-images-begin"
                  type="text"
                  class="form-input font-mono"
                  bind:value={imagesBegin}
                  placeholder="<a href=&quot;"
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-sm font-medium text-muted-foreground"
                  for="extraction-images-end"
                >
                  End marker
                </label>
                <input
                  id="extraction-images-end"
                  type="text"
                  class="form-input font-mono"
                  bind:value={imagesEnd}
                  placeholder="&quot;"
                />
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="font-semibold text-foreground">
            Substitution rules ({rules.length}/{MAX_RULES})
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
          <p class="text-sm text-muted-foreground">No rules — optional for extraction profiles.</p>
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
                        for="extraction-rule-pattern-{rule.id}"
                      >
                        Pattern
                      </label>
                      <input
                        id="extraction-rule-pattern-{rule.id}"
                        type="text"
                        class="form-input form-input-sm font-mono"
                        bind:value={rule.pattern}
                        placeholder="^https://"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-muted-foreground"
                        for="extraction-rule-replacement-{rule.id}"
                      >
                        Replacement
                      </label>
                      <input
                        id="extraction-rule-replacement-{rule.id}"
                        type="text"
                        class="form-input form-input-sm font-mono"
                        bind:value={rule.replacement}
                        placeholder="https://"
                      />
                    </div>
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-muted-foreground"
                        for="extraction-rule-flags-{rule.id}"
                      >
                        Flags
                      </label>
                      <input
                        id="extraction-rule-flags-{rule.id}"
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

      <div>
        <label class="flex items-center gap-3 text-sm">
          <Toggle bind:checked={galleryEnabled} />
          <span class="font-semibold text-foreground">Override gallery display</span>
        </label>

        {#if galleryEnabled}
          <div class="mt-3 space-y-3">
            <div class="grid gap-2 sm:grid-cols-3">
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-muted-foreground"
                  for="extraction-thumb-small"
                >
                  Thumb size (small)
                </label>
                <input
                  id="extraction-thumb-small"
                  type="number"
                  min="1"
                  class="form-input form-input-sm"
                  bind:value={thumbSmall}
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-muted-foreground"
                  for="extraction-thumb-medium"
                >
                  Thumb size (medium)
                </label>
                <input
                  id="extraction-thumb-medium"
                  type="number"
                  min="1"
                  class="form-input form-input-sm"
                  bind:value={thumbMedium}
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-muted-foreground"
                  for="extraction-thumb-large"
                >
                  Thumb size (large)
                </label>
                <input
                  id="extraction-thumb-large"
                  type="number"
                  min="1"
                  class="form-input form-input-sm"
                  bind:value={thumbLarge}
                />
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-3">
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-muted-foreground"
                  for="extraction-gallery-gap"
                >
                  Gap (px)
                </label>
                <input
                  id="extraction-gallery-gap"
                  type="number"
                  min="0"
                  class="form-input form-input-sm"
                  bind:value={galleryGap}
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-muted-foreground"
                  for="extraction-gallery-border"
                >
                  Border (px)
                </label>
                <input
                  id="extraction-gallery-border"
                  type="number"
                  min="0"
                  class="form-input form-input-sm"
                  bind:value={galleryBorder}
                />
              </div>
              <div>
                <label
                  class="mb-1 block text-xs font-medium text-muted-foreground"
                  for="extraction-gallery-corner"
                >
                  Button corner
                </label>
                <select
                  id="extraction-gallery-corner"
                  class="form-select form-input-sm"
                  bind:value={galleryCorner}
                >
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-right">Top right</option>
                  <option value="top-left">Top left</option>
                </select>
              </div>
            </div>
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
