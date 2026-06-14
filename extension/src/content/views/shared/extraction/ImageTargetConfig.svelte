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
  import type { ImageSource } from '#src/content/types';
  import { validateSelector } from '#utils/validation';

  interface ImageTargetConfigProps {
    images: ImageSource;
    onimagesourcechange?: (source: ImageSource) => void;
  }

  let { images, onimagesourcechange }: ImageTargetConfigProps = $props();

  type ImageVia = 'selector' | 'string';

  const imageVia = $derived<ImageVia>(images.via);

  let selectorError = $state('');

  function setVia(via: ImageVia) {
    if (via === 'selector') {
      onimagesourcechange?.({ via: 'selector', selector: '', attr: 'src' });
    } else {
      onimagesourcechange?.({ via: 'string', begin: '', end: '' });
    }
    selectorError = '';
  }

  function handleSelectorInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    selectorError = validateSelector(value);
    if (images.via === 'selector') {
      onimagesourcechange?.({ ...images, selector: value });
    }
  }

  function handleAttrInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (images.via === 'selector') {
      onimagesourcechange?.({ ...images, attr: value || 'src' });
    }
  }

  function handleBeginInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (images.via === 'string') {
      onimagesourcechange?.({ ...images, begin: value });
    }
  }

  function handleEndInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (images.via === 'string') {
      onimagesourcechange?.({ ...images, end: value });
    }
  }
</script>

<div class="space-y-2">
  <div class="text-base-content/70 text-xs font-medium tracking-wide uppercase">Images via</div>
  <div class="join">
    <button
      type="button"
      class="join-item btn btn-xs {imageVia === 'selector' ? 'btn-primary' : 'btn-neutral'}"
      onclick={() => setVia('selector')}
    >
      CSS Selector
    </button>
    <button
      type="button"
      class="join-item btn btn-xs {imageVia === 'string' ? 'btn-primary' : 'btn-neutral'}"
      onclick={() => setVia('string')}
    >
      String Markers
    </button>
  </div>

  {#if imageVia === 'selector'}
    <div class="flex gap-2">
      <div class="flex-1">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2 {selectorError
            ? 'input-error'
            : ''}"
          placeholder="Image selector (e.g. img, .gallery img)"
          aria-label="Image CSS selector"
          value={images.via === 'selector' ? images.selector : ''}
          oninput={handleSelectorInput}
        />
        {#if selectorError}
          <p class="text-error mt-1 text-xs">{selectorError}</p>
        {/if}
      </div>
      <div class="w-24">
        <input
          class="input-bordered input focus:ring-primary/20 focus:input-primary w-full transition-all focus:ring-2"
          placeholder="attr (src)"
          aria-label="Image attribute"
          value={images.via === 'selector' ? images.attr : 'src'}
          oninput={handleAttrInput}
        />
      </div>
    </div>
  {:else}
    <div class="flex gap-2">
      <input
        class="input-bordered input focus:ring-primary/20 focus:input-primary flex-1 transition-all focus:ring-2"
        placeholder="Begin marker"
        aria-label="Image URL begin marker"
        value={images.via === 'string' ? images.begin : ''}
        oninput={handleBeginInput}
      />
      <input
        class="input-bordered input focus:ring-primary/20 focus:input-primary flex-1 transition-all focus:ring-2"
        placeholder="End marker"
        aria-label="Image URL end marker"
        value={images.via === 'string' ? images.end : ''}
        oninput={handleEndInput}
      />
    </div>
  {/if}
</div>
