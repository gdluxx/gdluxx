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
  import { Button } from '#components/ui';
  import {
    loadGallerizedSettings,
    saveGallerizedSettings,
    DEFAULT_GALLERIZED_SETTINGS,
  } from '#utils/gallerizedStorage';
  import { toastStore } from '#stores/toast';
  import type {
    GallerizedSettings,
    GallerizedProfile,
    GallerizedTransform,
  } from '#src/content/types';

  // DRAFT STATE
  let draft = $state<GallerizedSettings>(
    JSON.parse(JSON.stringify(DEFAULT_GALLERIZED_SETTINGS)) as GallerizedSettings,
  );
  let loading = $state(true);
  let saving = $state(false);
  let expandedProfileIndex = $state<number | null>(null);

  onMount(async () => {
    const loaded = await loadGallerizedSettings();
    draft = JSON.parse(JSON.stringify(loaded)) as GallerizedSettings;
    loading = false;
  });

  // TRANSFORMS HELPERS
  function normalizeTransforms(
    t: GallerizedTransform | GallerizedTransform[] | null,
  ): GallerizedTransform[] {
    if (!t) return [];
    if (Array.isArray(t)) return t;
    return [t];
  }

  function denormalizeTransforms(
    t: GallerizedTransform[],
  ): GallerizedTransform | GallerizedTransform[] | null {
    if (t.length === 0) return null;
    if (t.length === 1) return t[0];
    return t;
  }

  let defaultTransforms = $derived(normalizeTransforms(draft.defaultConfig.images.transform));

  function setDefaultTransforms(rows: GallerizedTransform[]): void {
    draft.defaultConfig.images.transform = denormalizeTransforms(rows);
  }

  function addDefaultTransform(): void {
    setDefaultTransforms([...defaultTransforms, { find: '', replace: '' }]);
  }

  function removeDefaultTransform(i: number): void {
    setDefaultTransforms(defaultTransforms.filter((_, idx) => idx !== i));
  }

  function updateDefaultTransform(i: number, field: 'find' | 'replace', value: string): void {
    const rows = [...defaultTransforms];
    rows[i] = { ...rows[i], [field]: value };
    setDefaultTransforms(rows);
  }

  // PROFILE TRANSFORMS HELPERS
  function getProfileTransforms(profile: GallerizedProfile): GallerizedTransform[] {
    return normalizeTransforms(profile.config.images?.transform ?? null);
  }

  function setProfileTransforms(profileIndex: number, rows: GallerizedTransform[]): void {
    if (!draft.profiles[profileIndex].config.images) {
      draft.profiles[profileIndex].config.images = {};
    }
    draft.profiles[profileIndex].config.images!.transform = denormalizeTransforms(rows);
  }

  // PROFILE MANAGEMENT
  function addProfile(): void {
    draft.profiles = [...draft.profiles, { key: '', config: {} }];
    expandedProfileIndex = draft.profiles.length - 1;
  }

  function removeProfile(i: number): void {
    draft.profiles = draft.profiles.filter((_, idx) => idx !== i);
    if (expandedProfileIndex === i) expandedProfileIndex = null;
    else if (expandedProfileIndex !== null && expandedProfileIndex > i) expandedProfileIndex--;
  }

  function toggleProfile(i: number): void {
    expandedProfileIndex = expandedProfileIndex === i ? null : i;
  }

  // SAVE
  async function handleSave(): Promise<void> {
    saving = true;
    try {
      const cleaned: GallerizedSettings = JSON.parse(JSON.stringify(draft)) as GallerizedSettings;
      const c = cleaned.defaultConfig;
      c.container.selector = c.container.selector?.trim() || null;
      c.container.begin = c.container.begin?.trim() || null;
      c.container.end = c.container.end?.trim() || null;
      c.images.selector = c.images.selector?.trim() || null;
      c.images.attr = c.images.attr?.trim() || 'src';
      c.images.begin = c.images.begin?.trim() || null;
      c.images.end = c.images.end?.trim() || null;
      for (const p of cleaned.profiles) {
        if (p.config.container) {
          p.config.container.selector = p.config.container.selector?.trim() || null;
          p.config.container.begin = p.config.container.begin?.trim() || null;
          p.config.container.end = p.config.container.end?.trim() || null;
        }
        if (p.config.images) {
          p.config.images.selector = p.config.images.selector?.trim() || null;
          p.config.images.attr = p.config.images.attr?.trim() || undefined;
          p.config.images.begin = p.config.images.begin?.trim() || null;
          p.config.images.end = p.config.images.end?.trim() || null;
        }
      }
      await saveGallerizedSettings(cleaned);
      toastStore.success('Gallerized settings saved');
    } catch {
      toastStore.error('Failed to save Gallerized settings');
    } finally {
      saving = false;
    }
  }

  // INPUT HELPERS
  function nullableStr(val: string | null): string {
    return val ?? '';
  }
</script>

<div class="mx-2 my-4 max-w-[640px]">
  {#if loading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md"></span>
    </div>
  {:else}
    <!-- Enable / Disable -->
    <div class="card bg-base-200 mb-4 shadow-xl">
      <div class="card-body">
        <div class="card-title">Gallerized</div>
        <p class="text-base-content/70 text-sm">
          Inject a floating gallery button into every page to extract and browse images.
        </p>
        <div class="card-actions items-center justify-between">
          <span class="text-base-content text-sm font-medium">Enable gallery button</span>
          <input
            type="checkbox"
            class="toggle toggle-accent toggle-md"
            checked={draft.enabled}
            onchange={(e) => (draft.enabled = (e.target as HTMLInputElement).checked)}
          />
        </div>
      </div>
    </div>

    <!-- Default Config -->
    <div class="card bg-base-200 mb-4 shadow-xl">
      <div class="card-body gap-4">
        <div class="card-title">Default Config</div>
        <p class="text-base-content/70 text-sm">
          Applied on all pages unless a site profile matches.
        </p>

        <!-- Container -->
        <div class="border-base-300 rounded-lg border p-3">
          <p class="text-base-content mb-2 text-sm font-semibold">Container</p>
          <label class="mb-2 block">
            <span class="text-base-content/70 mb-1 block text-xs">CSS selector</span>
            <input
              class="input input-bordered input-sm w-full"
              placeholder="#gallery, .post-body, article"
              value={nullableStr(draft.defaultConfig.container.selector)}
              oninput={(e) =>
                (draft.defaultConfig.container.selector =
                  (e.target as HTMLInputElement).value || null)}
            />
          </label>
          <div class="flex gap-2">
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">Begin marker</span>
              <input
                class="input input-bordered input-sm w-full"
                placeholder="&lt;div id=&quot;gallery&quot;"
                value={nullableStr(draft.defaultConfig.container.begin)}
                oninput={(e) =>
                  (draft.defaultConfig.container.begin =
                    (e.target as HTMLInputElement).value || null)}
              />
            </label>
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">End marker</span>
              <input
                class="input input-bordered input-sm w-full"
                placeholder="&lt;/div&gt;"
                value={nullableStr(draft.defaultConfig.container.end)}
                oninput={(e) =>
                  (draft.defaultConfig.container.end =
                    (e.target as HTMLInputElement).value || null)}
              />
            </label>
          </div>
        </div>

        <!-- Images -->
        <div class="border-base-300 rounded-lg border p-3">
          <p class="text-base-content mb-2 text-sm font-semibold">Images</p>
          <div class="flex gap-2">
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">CSS selector</span>
              <input
                class="input input-bordered input-sm w-full"
                placeholder="img"
                value={nullableStr(draft.defaultConfig.images.selector)}
                oninput={(e) =>
                  (draft.defaultConfig.images.selector =
                    (e.target as HTMLInputElement).value || null)}
              />
            </label>
            <label class="w-28">
              <span class="text-base-content/70 mb-1 block text-xs">Attribute</span>
              <input
                class="input input-bordered input-sm w-full"
                placeholder="src"
                value={draft.defaultConfig.images.attr}
                oninput={(e) =>
                  (draft.defaultConfig.images.attr = (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>
          <div class="mt-2 flex gap-2">
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">Begin marker</span>
              <input
                class="input input-bordered input-sm w-full"
                placeholder="src=&quot;&quot;"
                value={nullableStr(draft.defaultConfig.images.begin)}
                oninput={(e) =>
                  (draft.defaultConfig.images.begin = (e.target as HTMLInputElement).value || null)}
              />
            </label>
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">End marker</span>
              <input
                class="input input-bordered input-sm w-full"
                placeholder="&quot;&quot;"
                value={nullableStr(draft.defaultConfig.images.end)}
                oninput={(e) =>
                  (draft.defaultConfig.images.end = (e.target as HTMLInputElement).value || null)}
              />
            </label>
          </div>

          <!-- URL Transforms -->
          <div class="mt-3">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-base-content/70 text-xs">URL transforms</span>
              <button
                class="btn btn-ghost btn-xs"
                onclick={addDefaultTransform}
              >
                + Add
              </button>
            </div>
            {#each defaultTransforms as transform, i (i)}
              <div class="mb-1 flex items-center gap-1">
                <input
                  class="input input-bordered input-xs flex-1"
                  placeholder="find"
                  value={transform.find}
                  oninput={(e) =>
                    updateDefaultTransform(i, 'find', (e.target as HTMLInputElement).value)}
                />
                <span class="text-base-content/50 text-xs">→</span>
                <input
                  class="input input-bordered input-xs flex-1"
                  placeholder="replace"
                  value={transform.replace}
                  oninput={(e) =>
                    updateDefaultTransform(i, 'replace', (e.target as HTMLInputElement).value)}
                />
                <button
                  class="btn btn-ghost btn-xs text-error"
                  onclick={() => removeDefaultTransform(i)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Gallery appearance -->
        <div class="border-base-300 rounded-lg border p-3">
          <p class="text-base-content mb-2 text-sm font-semibold">Gallery</p>
          <div class="mb-2">
            <span class="text-base-content/70 mb-1 block text-xs">
              Thumbnail sizes (px) — small · default · large
            </span>
            <div class="flex gap-2">
              {#each draft.defaultConfig.gallery.thumbSizes as _, i (i)}
                <input
                  type="number"
                  class="input input-bordered input-sm w-24"
                  min="50"
                  max="600"
                  value={draft.defaultConfig.gallery.thumbSizes[i]}
                  oninput={(e) => {
                    const sizes: [number, number, number] = [
                      ...draft.defaultConfig.gallery.thumbSizes,
                    ];
                    sizes[i] = Number((e.target as HTMLInputElement).value);
                    draft.defaultConfig.gallery.thumbSizes = sizes;
                  }}
                />
              {/each}
            </div>
          </div>
          <div class="flex gap-2">
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">Grid gap (px)</span>
              <input
                type="number"
                class="input input-bordered input-sm w-full"
                min="0"
                max="40"
                value={draft.defaultConfig.gallery.gap}
                oninput={(e) =>
                  (draft.defaultConfig.gallery.gap = Number((e.target as HTMLInputElement).value))}
              />
            </label>
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">Modal border (px)</span>
              <input
                type="number"
                class="input input-bordered input-sm w-full"
                min="0"
                max="100"
                value={draft.defaultConfig.gallery.border}
                oninput={(e) =>
                  (draft.defaultConfig.gallery.border = Number(
                    (e.target as HTMLInputElement).value,
                  ))}
              />
            </label>
            <label class="flex-1">
              <span class="text-base-content/70 mb-1 block text-xs">Button corner</span>
              <select
                class="select select-bordered select-sm w-full"
                value={draft.defaultConfig.gallery.buttonCorner}
                onchange={(e) => {
                  draft.defaultConfig.gallery.buttonCorner = (e.target as HTMLSelectElement)
                    .value as typeof draft.defaultConfig.gallery.buttonCorner;
                }}
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="top-right">Top right</option>
                <option value="top-left">Top left</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Site Profiles -->
    <div class="card bg-base-200 mb-4 shadow-xl">
      <div class="card-body gap-3">
        <div class="flex items-center justify-between">
          <div class="card-title">Site Profiles</div>
          <Button
            variant="secondary"
            onclick={addProfile}
          >
            + Add Profile
          </Button>
        </div>
        <p class="text-base-content/70 text-sm">
          Override config for specific hostnames or URL patterns. First match wins.
          <br />
          Patterns: <code class="text-xs">example.com</code>,
          <code class="text-xs">*.example.com</code>,
          <code class="text-xs">example.com/path</code>,
          <code class="text-xs">/regex/</code>
        </p>

        {#if draft.profiles.length === 0}
          <p class="text-base-content/40 py-2 text-center text-sm">No site profiles yet.</p>
        {/if}

        {#each draft.profiles as profile, i (i)}
          <div class="border-base-300 rounded-lg border">
            <!-- Profile header -->
            <div class="flex items-center gap-2 p-3">
              <input
                class="input input-bordered input-sm flex-1 font-mono"
                placeholder="example.com or *.example.com or /regex/"
                value={profile.key}
                oninput={(e) => (draft.profiles[i].key = (e.target as HTMLInputElement).value)}
              />
              <button
                class="btn btn-ghost btn-sm"
                onclick={() => toggleProfile(i)}
                title={expandedProfileIndex === i ? 'Collapse' : 'Edit overrides'}
              >
                {expandedProfileIndex === i ? '▲' : '▼'}
              </button>
              <button
                class="btn btn-ghost btn-sm text-error"
                onclick={() => removeProfile(i)}
                title="Delete profile"
              >
                ×
              </button>
            </div>

            {#if expandedProfileIndex === i}
              <div class="border-base-300 border-t px-3 pt-2 pb-3">
                <p class="text-base-content/50 mb-2 text-xs">
                  Leave fields empty to inherit from Default Config.
                </p>

                <!-- Profile Container override -->
                <div class="border-base-300 mb-2 rounded border p-2">
                  <p class="text-base-content/70 mb-1 text-xs font-semibold">Container</p>
                  <label class="mb-1 block">
                    <span class="text-base-content/50 mb-0.5 block text-xs">CSS selector</span>
                    <input
                      class="input input-bordered input-xs w-full"
                      placeholder="inherit"
                      value={nullableStr(profile.config.container?.selector ?? null)}
                      oninput={(e) => {
                        if (!draft.profiles[i].config.container)
                          draft.profiles[i].config.container = {};
                        draft.profiles[i].config.container!.selector =
                          (e.target as HTMLInputElement).value || null;
                      }}
                    />
                  </label>
                  <div class="flex gap-1">
                    <label class="flex-1">
                      <span class="text-base-content/50 mb-0.5 block text-xs">Begin</span>
                      <input
                        class="input input-bordered input-xs w-full"
                        placeholder="inherit"
                        value={nullableStr(profile.config.container?.begin ?? null)}
                        oninput={(e) => {
                          if (!draft.profiles[i].config.container)
                            draft.profiles[i].config.container = {};
                          draft.profiles[i].config.container!.begin =
                            (e.target as HTMLInputElement).value || null;
                        }}
                      />
                    </label>
                    <label class="flex-1">
                      <span class="text-base-content/50 mb-0.5 block text-xs">End</span>
                      <input
                        class="input input-bordered input-xs w-full"
                        placeholder="inherit"
                        value={nullableStr(profile.config.container?.end ?? null)}
                        oninput={(e) => {
                          if (!draft.profiles[i].config.container)
                            draft.profiles[i].config.container = {};
                          draft.profiles[i].config.container!.end =
                            (e.target as HTMLInputElement).value || null;
                        }}
                      />
                    </label>
                  </div>
                </div>

                <!-- Profile Images override -->
                <div class="border-base-300 mb-2 rounded border p-2">
                  <p class="text-base-content/70 mb-1 text-xs font-semibold">Images</p>
                  <div class="flex gap-1">
                    <label class="flex-1">
                      <span class="text-base-content/50 mb-0.5 block text-xs">Selector</span>
                      <input
                        class="input input-bordered input-xs w-full"
                        placeholder="inherit"
                        value={nullableStr(profile.config.images?.selector ?? null)}
                        oninput={(e) => {
                          if (!draft.profiles[i].config.images)
                            draft.profiles[i].config.images = {};
                          draft.profiles[i].config.images!.selector =
                            (e.target as HTMLInputElement).value || null;
                        }}
                      />
                    </label>
                    <label class="w-20">
                      <span class="text-base-content/50 mb-0.5 block text-xs">Attr</span>
                      <input
                        class="input input-bordered input-xs w-full"
                        placeholder="inherit"
                        value={profile.config.images?.attr ?? ''}
                        oninput={(e) => {
                          if (!draft.profiles[i].config.images)
                            draft.profiles[i].config.images = {};
                          draft.profiles[i].config.images!.attr =
                            (e.target as HTMLInputElement).value || undefined;
                        }}
                      />
                    </label>
                  </div>
                  <div class="mt-1 flex gap-1">
                    <label class="flex-1">
                      <span class="text-base-content/50 mb-0.5 block text-xs">Begin</span>
                      <input
                        class="input input-bordered input-xs w-full"
                        placeholder="inherit"
                        value={nullableStr(profile.config.images?.begin ?? null)}
                        oninput={(e) => {
                          if (!draft.profiles[i].config.images)
                            draft.profiles[i].config.images = {};
                          draft.profiles[i].config.images!.begin =
                            (e.target as HTMLInputElement).value || null;
                        }}
                      />
                    </label>
                    <label class="flex-1">
                      <span class="text-base-content/50 mb-0.5 block text-xs">End</span>
                      <input
                        class="input input-bordered input-xs w-full"
                        placeholder="inherit"
                        value={nullableStr(profile.config.images?.end ?? null)}
                        oninput={(e) => {
                          if (!draft.profiles[i].config.images)
                            draft.profiles[i].config.images = {};
                          draft.profiles[i].config.images!.end =
                            (e.target as HTMLInputElement).value || null;
                        }}
                      />
                    </label>
                  </div>

                  <!-- Profile transforms -->
                  <div class="mt-2">
                    <div class="mb-1 flex items-center justify-between">
                      <span class="text-base-content/50 text-xs">URL transforms</span>
                      <button
                        class="btn btn-ghost btn-xs"
                        onclick={() => {
                          setProfileTransforms(i, [
                            ...getProfileTransforms(draft.profiles[i]),
                            { find: '', replace: '' },
                          ]);
                        }}
                      >
                        + Add
                      </button>
                    </div>
                    {#each getProfileTransforms(draft.profiles[i]) as t, ti (ti)}
                      <div class="mb-1 flex items-center gap-1">
                        <input
                          class="input input-bordered input-xs flex-1"
                          placeholder="find"
                          value={t.find}
                          oninput={(e) => {
                            const rows = [...getProfileTransforms(draft.profiles[i])];
                            rows[ti] = {
                              ...rows[ti],
                              find: (e.target as HTMLInputElement).value,
                            };
                            setProfileTransforms(i, rows);
                          }}
                        />
                        <span class="text-base-content/50 text-xs">→</span>
                        <input
                          class="input input-bordered input-xs flex-1"
                          placeholder="replace"
                          value={t.replace}
                          oninput={(e) => {
                            const rows = [...getProfileTransforms(draft.profiles[i])];
                            rows[ti] = {
                              ...rows[ti],
                              replace: (e.target as HTMLInputElement).value,
                            };
                            setProfileTransforms(i, rows);
                          }}
                        />
                        <button
                          class="btn btn-ghost btn-xs text-error"
                          onclick={() =>
                            setProfileTransforms(
                              i,
                              getProfileTransforms(draft.profiles[i]).filter(
                                (_, idx) => idx !== ti,
                              ),
                            )}
                        >
                          ×
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Profile Gallery override -->
                <div class="border-base-300 rounded border p-2">
                  <p class="text-base-content/70 mb-1 text-xs font-semibold">Gallery</p>
                  <label>
                    <span class="text-base-content/50 mb-0.5 block text-xs">Button corner</span>
                    <select
                      class="select select-bordered select-xs w-full"
                      value={profile.config.gallery?.buttonCorner ?? ''}
                      onchange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        if (!draft.profiles[i].config.gallery)
                          draft.profiles[i].config.gallery = {};
                        draft.profiles[i].config.gallery!.buttonCorner = val as
                          | 'bottom-right'
                          | 'bottom-left'
                          | 'top-right'
                          | 'top-left';
                      }}
                    >
                      <option value="">inherit</option>
                      <option value="bottom-right">Bottom right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="top-right">Top right</option>
                      <option value="top-left">Top left</option>
                    </select>
                  </label>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Save -->
    <div class="flex justify-end">
      <Button
        variant="primary"
        onclick={handleSave}
        disabled={saving}
      >
        {#if saving}
          <span class="loading loading-sm loading-spinner"></span>
          Saving...
        {:else}
          Save Settings
        {/if}
      </Button>
    </div>
  {/if}
</div>
