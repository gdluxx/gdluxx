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
  import { PageLayout } from '$lib/components/ui';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components';
  import type { IconName } from '$lib/types/icons';

  interface SettingsPage {
    name: string;
    title: string;
    description: string;
    icon: IconName;
    href: string;
  }

  const settingsPages: SettingsPage[] = [
    {
      name: 'General',
      title: 'General',
      description: 'Manage general application preferences',
      icon: 'settings',
      href: resolve('/settings/general'),
    },
    {
      name: 'Version',
      title: 'Version',
      description: 'Manage your gallery-dl version',
      icon: 'version',
      href: resolve('/settings/version'),
    },
    {
      name: 'Account',
      title: 'Account',
      description: 'Manage user accounts',
      icon: 'user',
      href: resolve('/settings/users'),
    },
    {
      name: 'API Keys',
      title: 'API Keys',
      description: 'Manage your API keys',
      icon: 'key',
      href: resolve('/settings/apikey'),
    },
    {
      name: 'Logging',
      title: 'Logging',
      description: 'Manage your log settings',
      icon: 'log',
      href: resolve('/settings/logging'),
    },
  ];
</script>

<PageLayout title="Settings">
  {#snippet icon()}
    <Icon iconName="version" />
  {/snippet}

  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
    {#each settingsPages as page (page.name)}
      <div class="content-panel">
        <div class="flex items-start justify-between">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <Icon
                iconName={page.icon}
                size={32}
                class="text-accent-foreground"
              />
            </div>
            <div class="ml-4">
              <h3 class="text-lg font-medium text-foreground">
                {page.title}
              </h3>
              <p class="mt-1 text-sm text-muted-foreground">
                {page.description}
              </p>
            </div>
          </div>
        </div>
        <div class="mt-4">
          <a href={page.href}>
            <Button
              variant="outline-primary"
              size="sm"
              class="w-full"
            >
              Configure {page.name}
            </Button>
          </a>
        </div>
      </div>
    {/each}
  </div>
</PageLayout>
