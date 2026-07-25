/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const componentCatalog = [
  { key: 'button', label: 'Button' },
  { key: 'chip', label: 'Chip' },
  { key: 'confirm-modal', label: 'ConfirmModal' },
  { key: 'copy-tooltip', label: 'CopyTooltip' },
  { key: 'empty-state', label: 'EmptyState' },
  { key: 'file-dropzone', label: 'FileDropzone' },
  { key: 'icon', label: 'Icon' },
  { key: 'info', label: 'Info' },
  { key: 'modal', label: 'Modal' },
  { key: 'page-layout', label: 'PageLayout' },
  { key: 'spinner', label: 'Spinner' },
  { key: 'toggle', label: 'Toggle' },
  { key: 'tooltip', label: 'Tooltip' },
] as const;

export type ComponentKey = (typeof componentCatalog)[number]['key'];

export function isComponentKey(value: string | null): value is ComponentKey {
  return componentCatalog.some((component) => component.key === value);
}
