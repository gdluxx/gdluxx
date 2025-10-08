<!--
  Copyright (C) 2025 jsouthgb

  This file is part of gdluxx.

  gdluxx is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License version 2 (GPL-2.0),
  as published by the Free Software Foundation.
-->

<script lang="ts">
  import App from './App.svelte';

  interface OverlayProps {
    onclose: () => void;
    shadowContainer: HTMLElement;
  }

  const { onclose, shadowContainer }: OverlayProps = $props();
</script>

<App
  {onclose}
  {shadowContainer}
/>
