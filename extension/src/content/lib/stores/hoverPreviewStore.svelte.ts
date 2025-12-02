/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { computeHoverPreviewPosition } from '#utils/display';
import type { Settings } from '#utils/persistence';

export function createHoverPreviewStore() {
  let url = $state<string | null>(null);
  let visible = $state(false);
  let position = $state({ x: 0, y: 0 });
  let imageError = $state(false);

  function show(previewUrl: string, event: MouseEvent | FocusEvent, settings: Settings) {
    if (settings.showImageHoverPreview === 'off') return;

    url = previewUrl;
    visible = true;
    imageError = false;

    if (event instanceof MouseEvent) {
      updatePositionFromPoint(event.clientX, event.clientY, settings);
    } else {
      const target = event.target as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        updatePositionFromPoint(rect.right, rect.top, settings);
      }
    }
  }

  function hide() {
    visible = false;
    url = null;
  }

  function updatePosition(event: MouseEvent, settings: Settings) {
    if (!visible || settings.showImageHoverPreview === 'off') return;
    updatePositionFromPoint(event.clientX, event.clientY, settings);
  }

  function updatePositionFromPoint(x: number, y: number, settings: Settings) {
    if (settings.showImageHoverPreview === 'off') return;
    position = computeHoverPreviewPosition(settings.showImageHoverPreview, x, y);
  }

  function setImageError(error: boolean) {
    imageError = error;
  }

  function hideIfDisabled(settings: Settings) {
    if (settings.showImageHoverPreview === 'off' && visible) {
      visible = false;
      url = null;
      imageError = false;
    }
  }

  return {
    // State (read-only)
    get url() {
      return url;
    },
    get visible() {
      return visible;
    },
    get position() {
      return position;
    },
    get imageError() {
      return imageError;
    },

    show,
    hide,
    updatePosition,
    setImageError,
    hideIfDisabled,
  };
}

export type HoverPreviewStore = ReturnType<typeof createHoverPreviewStore>;
