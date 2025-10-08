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
import PopupApp from '../../src/popup/PopupApp.svelte';
import './style.css';

const root = document.getElementById('app');

if (!root) {
  console.error('Failed to find popup root element');
} else {
  const popup = mount(PopupApp, {
    target: root,
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unmount(popup);
    });
  }
}
