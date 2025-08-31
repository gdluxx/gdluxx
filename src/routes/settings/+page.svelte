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
  import { PageLayout } from '$lib/components/ui';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import { VersionIcon, LogIcon, KeyIcon } from '$lib/components/icons';
  import type { IconName } from '$lib/types/icons';

  const settingsPages = [
    {
      name: 'General',
      title: 'General Settings',
      description: 'Manage general application preferences',
      icon: 'settings' as IconName,
      href: '/settings/general',
    },
    {
      name: 'Version',
      title: 'Version Manager',
      description: 'Manage your gallery-dl version',
      icon: VersionIcon,
      href: '/settings/version',
    },
    {
      name: 'Users',
      title: 'User Manager',
      description: 'Manage user accounts',
      icon: 'user' as IconName,
      href: '/settings/users',
    },
    {
      name: 'API Keys',
      title: 'Key Manager',
      description: 'Manage your API keys',
      icon: KeyIcon,
      href: '/settings/apikey',
    },
    {
      name: 'Logging',
      title: 'Logging Manager',
      description: 'Manage your log settings',
      icon: LogIcon,
      href: '/settings/logging',
    },
  ];
</script>

<PageLayout title="Settings" description="Configure your gdluxx application">
  {#snippet icon()}
    <VersionIcon />
  {/snippet}

  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
    {#each settingsPages as page (page.name)}
      <div class="content-panel">
        <div class="flex items-start justify-between">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              {#if typeof page.icon === 'string'}
                <Icon iconName={page.icon} size={32} class="text-accent-foreground" />
              {:else}
                <page.icon size={32} class="text-accent-foreground" />
              {/if}
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-medium text-foreground">
                {page.title}
              </h3>
              <p class="text-sm text-muted-foreground mt-1">
                {page.description}
              </p>
            </div>
          </div>
        </div>
        <div class="mt-4">
          <a href={page.href}>
            <Button variant="outline-primary" size="sm" class="w-full">
              Configure {page.name}
            </Button>
          </a>
        </div>
      </div>
    {/each}
  </div>
</PageLayout>
