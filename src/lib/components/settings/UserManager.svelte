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
  import { Chip } from '$lib/components/ui';

  interface Props {
    user?: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
      image?: string | null;
    };
  }

  const { user }: Props = $props();
</script>

<div class="content-panel">
  <div class="cursor-default">
    <div class="px-4 py-2 sm:p-2">
      <div class="overflow-y-auto rounded-sm border-strong">
        <table class="min-w-full">
          <thead class="bg-surface border-b-strong">
            <tr>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                Username
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                Email
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                Created
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium tracking-wider text-foreground uppercase"
              >
                Status
              </th>
              <th
                scope="col"
                class="relative px-6 py-3"
              >
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y bg-surface-elevated">
            {#if user}
              <tr>
                <td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-foreground">
                  {user.name}
                </td>
                <td class="px-6 py-4 text-sm whitespace-nowrap text-foreground">
                  {user.email}
                </td>
                <td class="px-6 py-4 text-sm whitespace-nowrap text-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <Chip
                    dismissible={false}
                    size="sm"
                    label="Active"
                    variant="outline-primary"
                  />
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap"> </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
