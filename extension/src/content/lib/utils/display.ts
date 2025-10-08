/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { HoverPreviewMode } from '#src/content/types';

type ResolvedHoverMode = Exclude<HoverPreviewMode, 'off'>;

const DEFAULT_MODE: ResolvedHoverMode = 'medium';
const OFFSET = 16;

export const HOVER_PREVIEW_DIMENSIONS: Record<
  ResolvedHoverMode,
  { width: number; height: number }
> = {
  small: { width: 120, height: 120 },
  medium: { width: 200, height: 200 },
  large: { width: 320, height: 320 },
};

export const HOVER_PREVIEW_STYLES: Record<ResolvedHoverMode, { container: string; image: string }> =
  {
    small: { container: 'max-w-[160px]', image: 'h-[120px] w-[120px]' },
    medium: { container: 'max-w-[240px]', image: 'h-[200px] w-[200px]' },
    large: { container: 'max-w-[360px]', image: 'h-[320px] w-[320px]' },
  };

export function resolveHoverMode(mode: HoverPreviewMode): ResolvedHoverMode {
  if (mode === 'small' || mode === 'medium' || mode === 'large') {
    return mode;
  }
  return DEFAULT_MODE;
}

export function computeHoverPreviewPosition(
  mode: HoverPreviewMode,
  x: number,
  y: number,
): { x: number; y: number } {
  const resolved = resolveHoverMode(mode);
  const { width, height } = HOVER_PREVIEW_DIMENSIONS[resolved];

  let nextX = x + OFFSET;
  let nextY = y + OFFSET;

  if (typeof window !== 'undefined') {
    const maxX = window.innerWidth - width - OFFSET;
    const maxY = window.innerHeight - height - OFFSET;
    nextX = Math.min(Math.max(OFFSET, nextX), Math.max(OFFSET, maxX));
    nextY = Math.min(Math.max(OFFSET, nextY), Math.max(OFFSET, maxY));
  }

  return { x: nextX, y: nextY };
}
