/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { mount, unmount } from 'svelte';
import OverlayApp from '#app/OverlayApp.svelte';
import { ensureShadowHost, injectCssIntoShadow, removeShadowHost } from '#src/content/overlayHost';
import { loadSettings, type Settings } from '#utils/persistence';
import tailwindCss from '#src/app.css?inline';

function injectStyles(root: ShadowRoot): void {
  injectCssIntoShadow(root, tailwindCss, 'gdluxx-tailwind-daisyui');
}

function parseHotkey(hotkey: string) {
  const parts = hotkey.trim().split('+');
  const key = parts.pop() || '';
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  return {
    key: key.toLowerCase(),
    ctrl: modifiers.has('ctrl') || modifiers.has('control'),
    alt: modifiers.has('alt'),
    shift: modifiers.has('shift'),
    meta: modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command'),
  };
}

function matchesHotkey(event: KeyboardEvent, definition: string): boolean {
  const hotkey = parseHotkey(definition);
  if (!!hotkey.ctrl !== event.ctrlKey) return false;
  if (!!hotkey.alt !== event.altKey) return false;
  if (!!hotkey.shift !== event.shiftKey) return false;
  if (!!hotkey.meta !== event.metaKey) return false;
  return (event.key ?? '').toLowerCase() === hotkey.key;
}

function shouldIgnoreForTyping(target: Element | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    element.isContentEditable ||
    (element as HTMLInputElement).type === 'text'
  );
}

export default defineContentScript({
  matches: [],
  runAt: 'document_idle',
  registration: 'runtime',
  main: async () => {
    let overlayInstance: ReturnType<typeof mount> | null = null;
    let hotkeySettings: Settings | null = null;
    let hotkeyListenerAttached = false;
    let storageListenerAttached = false;

    const closeOverlay = (): void => {
      if (!overlayInstance) return;
      unmount(overlayInstance);
      overlayInstance = null;
      removeShadowHost();
    };

    const openOverlay = async (): Promise<void> => {
      if (overlayInstance) return;
      const { container, root } = ensureShadowHost();
      injectStyles(root);
      overlayInstance = mount(OverlayApp, {
        target: container,
        props: {
          onclose: closeOverlay,
          shadowContainer: container,
        },
      });
    };

    const toggleOverlay = (): void => {
      if (overlayInstance) closeOverlay();
      else void openOverlay();
    };

    const loadHotkeySettings = async (): Promise<void> => {
      try {
        hotkeySettings = await loadSettings();
      } catch (error) {
        console.error('Failed to load settings for hotkey', error);
        hotkeySettings = {
          serverUrl: '',
          apiKey: '',
          hotkey: 'Alt+L',
          hotkeyEnabled: true,
          showImagePreviews: false,
          showImageHoverPreview: 'off',
        };
      }
    };

    const handleHotkey = async (event: KeyboardEvent): Promise<void> => {
      if (!hotkeySettings) {
        await loadHotkeySettings();
      }
      if (!hotkeySettings?.hotkeyEnabled) return;
      if (!hotkeySettings.hotkey) return;
      if (!matchesHotkey(event, hotkeySettings.hotkey)) return;
      if (shouldIgnoreForTyping(document.activeElement)) return;

      event.preventDefault();
      toggleOverlay();
    };

    const attachHotkeyListener = async (): Promise<void> => {
      if (hotkeyListenerAttached) return;
      document.addEventListener('keydown', (event) => {
        void handleHotkey(event);
      });
      hotkeyListenerAttached = true;
    };

    const attachStorageListener = async (): Promise<void> => {
      if (storageListenerAttached) return;
      browser.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName !== 'local') return;
        const relevant = ['gdluxx_hotkey', 'gdluxx_hotkey_enabled'];
        if (relevant.some((key) => key in changes)) {
          await loadHotkeySettings();
        }
      });
      storageListenerAttached = true;
    };

    browser.runtime.onMessage.addListener((message) => {
      if (typeof message !== 'object' || !message) return;
      if ('action' in message && message.action === 'toggleOverlay') {
        toggleOverlay();
      }
    });

    await loadHotkeySettings();
    await attachHotkeyListener();
    await attachStorageListener();
  },
});
