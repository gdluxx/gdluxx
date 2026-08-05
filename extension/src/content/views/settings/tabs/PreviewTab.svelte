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
  import type { HoverPreviewMode } from '#src/content/types';

  interface PreviewTabProps {
    isFullscreen: boolean;
    showImagePreviews: boolean;
    showImageHoverPreview: HoverPreviewMode;
    showSentMarks: boolean;
    onToggleDisplayMode: () => void | Promise<void>;
    onToggleImagePreviews: (event: Event) => void | Promise<void>;
    onToggleImageHoverPreview: (event: Event) => void | Promise<void>;
    onToggleSentMarks: (event: Event) => void | Promise<void>;
    onClearSentHistory: (scope: 'host' | 'all') => void | Promise<void>;
  }

  const {
    showImagePreviews,
    showImageHoverPreview,
    showSentMarks,
    onToggleImagePreviews,
    onToggleImageHoverPreview,
    onToggleSentMarks,
    onClearSentHistory,
  }: PreviewTabProps = $props();
</script>

<div class="mx-2 my-4 max-w-[640px]">
  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Image Preview</div>
      <p>Show inline thumbnails for image results in the Images tab.</p>
      <div class="card-actions justify-end">
        <input
          id="image-previews"
          type="checkbox"
          class="toggle toggle-accent toggle-md"
          checked={showImagePreviews}
          onchange={onToggleImagePreviews}
        />
      </div>
    </div>
  </div>

  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Hover Preview</div>
      <p>Display a floating preview when hovering image URLs.</p>

      <div class="card-actions justify-end">
        <div class="flex items-center gap-3 py-3">
          <label class="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name="hover-preview"
              value="off"
              class="radio radio-sm radio-primary"
              checked={showImageHoverPreview === 'off'}
              onchange={onToggleImageHoverPreview}
            />
            <span class="text-sm">off</span>
          </label>
          <label class="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name="hover-preview"
              value="small"
              class="radio radio-sm radio-primary"
              checked={showImageHoverPreview === 'small'}
              onchange={onToggleImageHoverPreview}
            />
            <span class="text-sm">small</span>
          </label>
          <label class="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name="hover-preview"
              value="medium"
              class="radio radio-sm radio-primary"
              checked={showImageHoverPreview === 'medium'}
              onchange={onToggleImageHoverPreview}
            />
            <span class="text-sm">medium</span>
          </label>
          <label class="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name="hover-preview"
              value="large"
              class="radio radio-sm radio-primary"
              checked={showImageHoverPreview === 'large'}
              onchange={onToggleImageHoverPreview}
            />
            <span class="text-sm">large</span>
          </label>
        </div>
      </div>
    </div>
  </div>

  <div class="card bg-base-200 mb-4 shadow-xl">
    <div class="card-body">
      <div class="card-title">Sent History</div>
      <p>Mark URLs already sent to gdluxx with a badge (overlay) or a dot (gallery).</p>
      <div class="card-actions justify-end">
        <input
          id="show-sent-marks"
          type="checkbox"
          class="toggle toggle-accent toggle-md"
          checked={showSentMarks}
          onchange={onToggleSentMarks}
        />
      </div>
      <div class="card-actions justify-end gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline"
          onclick={() => onClearSentHistory('host')}
        >
          Clear for this site
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline btn-error"
          onclick={() => onClearSentHistory('all')}
        >
          Clear all
        </button>
      </div>
    </div>
  </div>
</div>
