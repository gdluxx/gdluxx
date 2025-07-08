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
  | 'setup'
  | 'sort';

export interface IconConfig {
  name: IconName;
  label: string;
  category: 'navigation' | 'action' | 'status' | 'object' | 'theme' | 'work';
}

