/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import closeIcon from '@iconify-icons/mdi/close';
import helpCircleIcon from '@iconify-icons/mdi/help-circle';
import chevronDownIcon from '@iconify-icons/mdi/chevron-down';
import contentCopyIcon from '@iconify-icons/mdi/content-copy';
import downloadIcon from '@iconify-icons/mdi/download';
import sendIcon from '@iconify-icons/mdi/send';
import folderPlusIcon from '@iconify-icons/mdi/folder-plus';
import imageIcon from '@iconify-icons/mdi/image';
import linkIcon from '@iconify-icons/mdi/link';
import magnifyIcon from '@iconify-icons/mdi/magnify';
import arrowUpIcon from '@iconify-icons/mdi/arrow-up';
import arrowDownIcon from '@iconify-icons/mdi/arrow-down';
import deleteIcon from '@iconify-icons/mdi/delete';
import plusBoxIcon from '@iconify-icons/mdi/plus-box';
import themeLightDarkIcon from '@iconify-icons/mdi/theme-light-dark';
import cogIcon from '@iconify-icons/mdi/cog';
import eyeIcon from '@iconify-icons/mdi/eye';
import keyboardIcon from '@iconify-icons/mdi/keyboard';
import homeIcon from '@iconify-icons/mdi/home';
import filterIcon from '@iconify-icons/mdi/filter-outline';
import replaceIcon from '@iconify-icons/mdi/find-replace';

export type IconName =
  | 'box-add'
  | 'chevron-down'
  | 'close'
  | 'copy'
  | 'download-arrow'
  | 'filter-outline'
  | 'find-replace'
  | 'folder-plus'
  | 'home'
  | 'hotkey'
  | 'image'
  | 'link'
  | 'magnifying-glass'
  | 'mdi-delete'
  | 'move-down'
  | 'move-up'
  | 'preview'
  | 'question'
  | 'send'
  | 'settings'
  | 'theme';

type IconifyIconData = typeof closeIcon;

export const iconMap: Record<IconName, IconifyIconData> = {
  close: closeIcon,
  question: helpCircleIcon,
  'chevron-down': chevronDownIcon,
  copy: contentCopyIcon,
  'download-arrow': downloadIcon,
  send: sendIcon,
  'folder-plus': folderPlusIcon,
  'filter-outline': filterIcon,
  'find-replace': replaceIcon,
  image: imageIcon,
  link: linkIcon,
  'magnifying-glass': magnifyIcon,
  'move-up': arrowUpIcon,
  'move-down': arrowDownIcon,
  'mdi-delete': deleteIcon,
  'box-add': plusBoxIcon,
  theme: themeLightDarkIcon,
  settings: cogIcon,
  preview: eyeIcon,
  hotkey: keyboardIcon,
  home: homeIcon,
};
