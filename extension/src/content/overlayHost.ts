/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

const OVERLAY_HOST_ID = 'gdluxx-linkextractor-overlay';
const OVERLAY_CONTAINER_ID = 'gdluxx-overlay-container';
const OVERLAY_STYLE_ID = 'gdluxx-overlay-base-style';

const BASE_STYLE = `
  :host {
    all: initial;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    color-scheme: light dark;
    font-size: 16px !important;
  }
  .overlay-root {
    width: 100%;
    height: 100%;
    display: contents;
  }
`;

type EnsureResult = {
  host: HTMLDivElement;
  root: ShadowRoot;
  container: HTMLDivElement;
};

function applyHostStyles(host: HTMLDivElement) {
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.zIndex = '2147483647';
}

function disableBackgroundScroll(disabled: boolean) {
  try {
    document.documentElement.style.overflow = disabled ? 'hidden' : '';
    document.body.style.overflow = disabled ? 'hidden' : '';
  } catch {
    // ignore
  }
}

export function ensureShadowHost(): EnsureResult {
  let host = document.getElementById(OVERLAY_HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    applyHostStyles(host);
    document.body.append(host);
  } else {
    applyHostStyles(host);
  }

  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  let style = root.getElementById(OVERLAY_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = OVERLAY_STYLE_ID;
    style.textContent = BASE_STYLE;
    root.append(style);
  }

  let container = root.getElementById(OVERLAY_CONTAINER_ID) as HTMLDivElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = OVERLAY_CONTAINER_ID;
    container.className = 'overlay-root';
    root.append(container);
  }

  disableBackgroundScroll(true);

  return { host, root, container };
}

export function removeShadowHost(): void {
  document.getElementById(OVERLAY_HOST_ID)?.remove();
  disableBackgroundScroll(false);
}

export const overlayIds = {
  host: OVERLAY_HOST_ID,
  container: OVERLAY_CONTAINER_ID,
};

export function injectCssIntoShadow(root: ShadowRoot, css: string, id = 'gdluxx-inline-style') {
  let style = root.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    root.append(style);
  }

  if (style.textContent !== css) {
    style.textContent = css;
  }
}

export function applyThemeToShadowRoot(root: ShadowRoot, theme: string): void {
  const container = root.getElementById(OVERLAY_CONTAINER_ID);
  if (container) {
    container.setAttribute('data-theme', theme);
  }
}
