/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import spriteMarkup from '#assets/sprite.svg?raw';

const SPRITE_ELEMENT_ID = 'gdluxx-icon-sprite';
const mountedRoots = new WeakSet<Document | ShadowRoot>();

function resolveSpriteRoot(node: Node | null): Document | ShadowRoot | null {
  if (!node) return null;

  const root = node.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot) {
    return root;
  }

  if ('ownerDocument' in node && node.ownerDocument) {
    return node.ownerDocument;
  }

  if (typeof document !== 'undefined') {
    return document;
  }

  return null;
}

function createSpriteElement(root: Document | ShadowRoot): SVGSVGElement | null {
  const doc = root instanceof Document ? root : root.ownerDocument;
  if (!doc) return null;

  const container = doc.createElement('div');
  container.innerHTML = spriteMarkup.trim();
  const svg = container.querySelector('svg');
  if (!svg) return null;

  svg.id = SPRITE_ELEMENT_ID;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';

  return svg as SVGSVGElement;
}

export function ensureSpriteMounted(root: Document | ShadowRoot): void {
  if (mountedRoots.has(root)) return;

  if (typeof (root as Document | ShadowRoot).getElementById === 'function') {
    const existing = (root as Document | ShadowRoot).getElementById(SPRITE_ELEMENT_ID);
    if (existing) {
      mountedRoots.add(root);
      return;
    }
  }

  const sprite = createSpriteElement(root);
  if (!sprite) return;

  if (root instanceof Document) {
    if (!root.body) return;
    root.body.prepend(sprite);
  } else {
    root.prepend(sprite);
  }

  mountedRoots.add(root);
}

export function ensureGlobalSprite(): void {
  if (typeof document === 'undefined') return;
  ensureSpriteMounted(document);
}

export function getSpriteHref(iconName: string): string {
  return `#${iconName}`;
}

export function ensureSpriteForNode(node: Node | null): void {
  if (!node) return;

  const attempt = () => {
    const root = resolveSpriteRoot(node);
    if (!root) return false;
    ensureSpriteMounted(root);

    // When the node lives inside a ShadowRoot, also ensure the global document
    if ('ownerDocument' in node && node.ownerDocument) {
      ensureSpriteMounted(node.ownerDocument);
    }
    return true;
  };

  if (attempt()) return;

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {
      if (attempt()) return;
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (attempt()) return;
          if (typeof setTimeout === 'function') {
            setTimeout(() => {
              attempt();
            }, 0);
          }
        });
      } else if (typeof setTimeout === 'function') {
        setTimeout(() => {
          attempt();
        }, 0);
      }
    });
  } else if (typeof setTimeout === 'function') {
    setTimeout(() => {
      attempt();
    }, 0);
  }
}

export const SPRITE_ID = SPRITE_ELEMENT_ID;
