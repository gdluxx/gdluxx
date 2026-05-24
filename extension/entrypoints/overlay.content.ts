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
import GalleryApp from '#views/gallerized/GalleryApp.svelte';
import { ensureShadowHost, injectCssIntoShadow, removeShadowHost } from '#src/content/overlayHost';
import { matchesHotkey, shouldIgnoreForTyping } from '#utils/hotkeys';
import { getSettings, warmSettings, attachSettingsListener } from '#src/shared/settings';
import { loadGallerizedSettings, GALLERIZED_STORAGE_KEY } from '#utils/gallerizedStorage';
import tailwindCss from '#src/app.css?inline';
import galleryCss from '#views/gallerized/gallery.css?inline';
import browser from 'webextension-polyfill';
import type { GallerizedSettings } from '#src/content/types';

const GALLERY_HOST_ID = 'gz-gallery-host';
const GALLERY_CONTAINER_ID = 'gz-gallery-container';

function ensureGalleryShadowHost(): { root: ShadowRoot; container: HTMLDivElement } {
  let host = document.getElementById(GALLERY_HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = GALLERY_HOST_ID;
    host.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:2147483645;pointer-events:none';
    document.body.append(host);
  }
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  let container = root.getElementById(GALLERY_CONTAINER_ID) as HTMLDivElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = GALLERY_CONTAINER_ID;
    container.style.cssText = 'position:relative;width:100%;height:100%';
    root.append(container);
  }
  return { root, container };
}

function removeGalleryShadowHost(): void {
  document.getElementById(GALLERY_HOST_ID)?.remove();
}

function injectStyles(root: ShadowRoot): void {
  injectCssIntoShadow(root, tailwindCss, 'gdluxx-tailwind-daisyui');
}

export default defineContentScript({
  matches: [],
  runAt: 'document_idle',
  registration: 'runtime',
  main: async () => {
    let overlayInstance: ReturnType<typeof mount> | null = null;
    let galleryInstance: ReturnType<typeof mount> | null = null;
    let hotkeyListenerAttached = false;

    const mountGallery = (): void => {
      if (galleryInstance) return;
      const { root, container } = ensureGalleryShadowHost();
      injectCssIntoShadow(root, galleryCss, 'gz-gallery-styles');
      galleryInstance = mount(GalleryApp, { target: container });
    };

    const unmountGallery = (): void => {
      if (!galleryInstance) return;
      unmount(galleryInstance);
      galleryInstance = null;
      removeGalleryShadowHost();
    };

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

    const sendCurrentTabToGdluxx = async (): Promise<void> => {
      const settings = getSettings();
      if (!settings) return;

      // Validate gdluxx configuration
      if (!settings.serverUrl || !settings.apiKey) {
        await browser.runtime.sendMessage({
          action: 'showNotification',
          title: 'gdluxx Extension',
          message: "You haven't configured gdluxx URL and API Key in extension settings",
        });
        return;
      }

      const tabUrl = window.location.href;
      const tabTitle = document.title;

      try {
        const response = (await browser.runtime.sendMessage({
          action: 'sendUrl',
          apiUrl: settings.serverUrl,
          apiKey: settings.apiKey,
          tabUrl: tabUrl,
          tabTitle: tabTitle,
        })) as { success: boolean; message: string };

        if (response && response.success) {
          await browser.runtime.sendMessage({
            action: 'showNotification',
            title: 'gdluxx Extension',
            message: response.message || 'URL sent successfully to gdluxx!',
          });
        } else {
          await browser.runtime.sendMessage({
            action: 'showNotification',
            title: 'gdluxx Extension',
            message: response?.message || 'Failed to send URL to gdluxx',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await browser.runtime.sendMessage({
          action: 'showNotification',
          title: 'gdluxx Extension',
          message: `Network error: ${errorMessage}`,
        });
      }
    };

    // overlay hotkey takes priority
    const handleHotkey = (event: KeyboardEvent): void => {
      const settings = getSettings();
      if (!settings) return; // Settings not loaded yet

      // Check overlay hotkey first
      if (settings.hotkeyEnabled && settings.hotkey) {
        if (matchesHotkey(event, settings.hotkey)) {
          if (shouldIgnoreForTyping(document.activeElement)) return;
          event.preventDefault();
          toggleOverlay();
          return; // Important: prevent checking other hotkeys
        }
      }

      // Check send-tab hotkey second
      if (settings.sendTabHotkeyEnabled && settings.sendTabHotkey) {
        if (matchesHotkey(event, settings.sendTabHotkey)) {
          if (shouldIgnoreForTyping(document.activeElement)) return;
          event.preventDefault();
          void sendCurrentTabToGdluxx(); // Intentionally ignore returned promise
          return;
        }
      }
    };

    const attachHotkeyListener = async (): Promise<void> => {
      if (hotkeyListenerAttached) return;
      document.addEventListener('keydown', (event) => {
        handleHotkey(event);
      });
      hotkeyListenerAttached = true;
    };

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message !== 'object' || !message) return;
      if ('action' in message && message.action === 'toggleOverlay') {
        toggleOverlay();
      }
    });

    await warmSettings();
    attachSettingsListener();
    await attachHotkeyListener();

    // Mount gallery if enabled
    const gallerizedSettings = await loadGallerizedSettings();
    if (gallerizedSettings.enabled) {
      mountGallery();
    }

    // Watch for gallerized enable/disable changes
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !(GALLERIZED_STORAGE_KEY in changes)) return;
      const newSettings = changes[GALLERIZED_STORAGE_KEY].newValue as
        | GallerizedSettings
        | undefined;
      if (newSettings?.enabled && !galleryInstance) {
        mountGallery();
      } else if (!newSettings?.enabled && galleryInstance) {
        unmountGallery();
      }
    });
  },
});
