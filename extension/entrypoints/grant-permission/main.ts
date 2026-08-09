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
import PermissionGrantApp from '../../src/popup/PermissionGrantApp.svelte';
import '../popup/style.css';

const root = document.getElementById('app');

if (!root) {
  console.error('Failed to find permission page root element');
} else {
  const app = mount(PermissionGrantApp, { target: root });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unmount(app);
    });
  }
}
