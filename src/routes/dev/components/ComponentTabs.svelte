<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import { resolve } from '$app/paths';
  import { componentCatalog, type ComponentKey } from './catalog';

  interface Props {
    activeKey: ComponentKey;
  }

  const { activeKey }: Props = $props();
</script>

<nav
  class="overflow-x-auto border-b border-border"
  aria-label="Component examples"
>
  <div class="flex min-w-max gap-1">
    {#each componentCatalog as component (component.key)}
      <a
        href={resolve(`/dev/components?component=${component.key}`)}
        aria-current={component.key === activeKey ? 'page' : undefined}
        class="border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors focus:ring-2 focus:ring-focus focus:outline-hidden {component.key ===
        activeKey
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground'}"
      >
        {component.label}
      </a>
    {/each}
  </div>
</nav>
