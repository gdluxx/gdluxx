/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { GlobalEffectsConfig } from '#src/content/types';

export function registerGlobalEffects(config: GlobalEffectsConfig): () => void {
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      config.onClose();
    }
  };

  const handleSaveShortcut = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = (event.key ?? '').toLowerCase();
    if (key !== 's') return;
    if (event.repeat) return;
    if (!config.canSaveProfile()) return;

    event.preventDefault();
    config.saveProfile().catch((error) => {
      console.error('Shortcut save failed', error);
    });
  };

  window.addEventListener('keydown', handleEscape);
  window.addEventListener('keydown', handleSaveShortcut);

  return () => {
    window.removeEventListener('keydown', handleEscape);
    window.removeEventListener('keydown', handleSaveShortcut);
  };
}

export function focusElementOnce(getElement: () => HTMLElement | null | undefined): void {
  queueMicrotask(() => {
    const element = getElement();
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  });
}
