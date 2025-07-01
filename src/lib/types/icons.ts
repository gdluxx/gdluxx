/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export type IconName =
  | 'key'
  | 'close'
  | 'close-light'
  | 'copy-clipboard'
  | 'delete'
  | 'play'
  | 'double-chevron-left'
  | 'json'
  | 'version'
  | 'dark'
  | 'light'
  | 'ui'
  | 'job'
  | 'log'
  | 'loading'
  | 'chevron-right'
  | 'plus'
  | 'user'
  | 'minimize'
  | 'logout'
  | 'lock'
  | 'circle'
  | 'menu'
  | 'magnifying-glass'
  | 'settings'
  | 'run'
  | 'setup';

export interface IconConfig {
  name: IconName;
  label: string;
  category: 'navigation' | 'action' | 'status' | 'object' | 'theme' | 'work';
}

export const ICON_CATALOG: IconConfig[] = [
  { name: 'key', label: 'Key', category: 'object' },
  { name: 'close', label: 'Close', category: 'navigation' },
  { name: 'close-light', label: 'Close Light', category: 'navigation' },
  { name: 'copy-clipboard', label: 'Copy to Clipboard', category: 'action' },
  { name: 'delete', label: 'Delete', category: 'action' },
  { name: 'play', label: 'Play', category: 'action' },
  { name: 'double-chevron-left', label: 'Double Chevron Left', category: 'navigation' },
  { name: 'json', label: 'JSON', category: 'object' },
  { name: 'version', label: 'Version', category: 'work' },
  { name: 'dark', label: 'Dark Mode', category: 'theme' },
  { name: 'light', label: 'Light Mode', category: 'theme' },
  { name: 'ui', label: 'UI', category: 'work' },
  { name: 'job', label: 'Job', category: 'work' },
  { name: 'log', label: 'Log', category: 'work' },
  { name: 'loading', label: 'Loading', category: 'status' },
  { name: 'chevron-right', label: 'Chevron Right', category: 'navigation' },
  { name: 'plus', label: 'Plus', category: 'action' },
  { name: 'user', label: 'User', category: 'action' },
  { name: 'setup', label: 'Setup', category: 'action' },
  { name: 'minimize', label: 'Minimize', category: 'action' },
  { name: 'logout', label: 'Logout', category: 'action' },
  { name: 'lock', label: 'Lock', category: 'object' },
  { name: 'circle', label: 'Circle', category: 'object' },
  { name: 'menu', label: 'Menu', category: 'navigation' },
  { name: 'magnifying-glass', label: 'Magnifying Glass', category: 'object' },
  { name: 'settings', label: 'Settings', category: 'navigation' },
  { name: 'run', label: 'Run', category: 'object' },
];
