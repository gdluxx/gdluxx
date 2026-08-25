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
  import { SvelteSet } from 'svelte/reactivity';
  import type { Pathname } from '$app/types';
  import { Icon } from '$lib/components';
  import { signOut } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast';
  import { clientLogger } from '$lib/client/logger';

  interface NavItem {
    id: string;
    label: string;
    icon: string;
    href?: Pathname;
    children?: NavItem[];
  }

  interface Props {
    items?: NavItem[];
    defaultCollapsed?: boolean;
    onNavigate?: (item: NavItem) => void;
    isMobile?: boolean;
    user?: { id: string; name: string; email: string };
    appVersion?: string;
  }

  const {
    items = [],
    defaultCollapsed = false,
    onNavigate = () => {
      // Intentionally empty, default no-op function
    },
    isMobile = false,
    user,
    appVersion,
  }: Props = $props();

  let collapsed = $derived(isMobile ? false : defaultCollapsed);
  const expandedItems = new SvelteSet<string>();
  let activeItemId = $state<string>('');

  function toggleSidebar() {
    if (!isMobile) {
      collapsed = !collapsed;
    }
  }

  function toggleItem(itemId: string) {
    if (expandedItems.has(itemId)) {
      expandedItems.delete(itemId);
    } else {
      expandedItems.add(itemId);
    }
  }

  // Remove focus ring when user collapses/expands sidebar
  // But keep it for keyboard navigation for accessibility
  function handleSidebarClick(event: MouseEvent) {
    toggleSidebar();

    if (event.detail > 0 && event.currentTarget) {
      const target = event.currentTarget as HTMLButtonElement | null;
      target?.blur();
    }
  }

  function handleItemClick(item: NavItem) {
    activeItemId = item.id;
    onNavigate(item);
  }

  // Chevron is a separate control from the row it only toggles the
  // submenu and shouldn't trigger the row's navigation
  function handleToggleClick(event: MouseEvent, itemId: string) {
    event.stopPropagation();
    toggleItem(itemId);
  }

  function isItemExpanded(itemId: string): boolean {
    return expandedItems.has(itemId);
  }

  function handleKeydown(event: KeyboardEvent, item: NavItem) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item);
    }
  }

  function handleSidebarKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSidebar();
    }
  }

  async function handleLogout() {
    try {
      await signOut();
      toastStore.success('Logged out successfully');
      window.location.href = '/auth/login';
    } catch (error) {
      toastStore.error('Logout failed', 'An error occurred while logging out');
      clientLogger.error('Logout error:', error);
    }
  }
</script>

<nav
  class="flex h-full flex-col overflow-x-hidden bg-surface transition-all duration-300 border-r-strong {collapsed &&
  !isMobile
    ? 'w-16'
    : 'w-54'}"
  aria-label="Main navigation"
>
  <!-- Desktop header only -->
  {#if !isMobile}
    <div class="p-2 border-b-strong">
      <button
        onclick={handleSidebarClick}
        onkeydown={handleSidebarKeydown}
        class="flex w-full cursor-pointer items-center gap-3 rounded-sm py-2 pl-3 text-muted-foreground transition-colors hover:bg-surface-hover focus:bg-surface-active focus:outline-hidden focus:border-focus"
        aria-label={collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
        aria-expanded={!collapsed}
        aria-controls="nav-items-list"
        tabindex="0"
      >
        <span
          class="flex flex-shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <Icon
            iconName="double-chevron-left"
            size={24}
            class="transition-transform {collapsed ? 'rotate-180' : ''}"
          />
        </span>
      </button>

      <!-- Tooltip for desktop collapsed state -->
      {#if collapsed}
        <div
          id="navigation-tooltip"
          class="sr-only"
          role="tooltip"
        >
          Navigation
        </div>
      {/if}
    </div>
  {/if}

  <!-- Nav items -->
  <div
    class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2"
    id="nav-items-container"
    aria-labelledby={collapsed && !isMobile ? undefined : 'nav-heading'}
  >
    <ul
      id="nav-items-list"
      role="list"
      class="space-y-1"
    >
      {#each items as item (item.id)}
        <li>
          {#if item.children && (!collapsed || isMobile)}
            <div
              class="flex w-full items-stretch gap-1 rounded-sm text-foreground transition-colors {activeItemId ===
              item.id
                ? 'bg-surface-selected text-foreground'
                : ''}"
            >
              <button
                onclick={() => handleItemClick(item)}
                onkeydown={(e) => handleKeydown(e, item)}
                class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                aria-current={activeItemId === item.id ? 'page' : undefined}
                tabindex="0"
              >
                <span
                  class="size-5 flex-shrink-0"
                  aria-hidden="true"
                >
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html item.icon}
                </span>
                <span class="min-w-0 flex-1 truncate text-left text-sm font-medium">
                  {item.label}
                </span>
              </button>
              <button
                type="button"
                onclick={(e) => handleToggleClick(e, item.id)}
                class="flex flex-shrink-0 cursor-pointer items-center rounded-sm px-2 text-foreground transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                aria-expanded={isItemExpanded(item.id)}
                aria-controls="{item.id}-submenu"
                aria-label={isItemExpanded(item.id)
                  ? `Collapse ${item.label} submenu`
                  : `Expand ${item.label} submenu`}
              >
                <Icon
                  iconName="chevron-right"
                  size={16}
                  class="transition-all duration-200 {isItemExpanded(item.id) ? 'rotate-90' : ''}"
                  ariaLabel=""
                />
              </button>
            </div>
          {:else}
            <button
              onclick={() => handleItemClick(item)}
              onkeydown={(e) => handleKeydown(e, item)}
              class="flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-foreground transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:ring-2 focus:ring-primary/20 focus:outline-hidden {activeItemId ===
              item.id
                ? 'bg-surface-selected text-foreground'
                : ''}"
              aria-current={activeItemId === item.id ? 'page' : undefined}
              aria-describedby={collapsed && !isMobile ? `${item.id}-tooltip` : undefined}
              tabindex="0"
            >
              <span
                class="size-5 flex-shrink-0"
                aria-hidden="true"
              >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html item.icon}
              </span>
              {#if !collapsed || isMobile}
                <span class="min-w-0 flex-1 truncate text-left text-sm font-medium">
                  {item.label}
                </span>
              {/if}
            </button>
          {/if}

          <!-- Tooltip for collapsed state desktop only) -->
          {#if collapsed && !isMobile}
            <div
              id="{item.id}-tooltip"
              class="sr-only"
              role="tooltip"
            >
              {item.label}
            </div>
          {/if}

          <!-- Child items -->
          {#if item.children && isItemExpanded(item.id) && (!collapsed || isMobile)}
            <ul
              id="{item.id}-submenu"
              class="border-strong bg-surface-elevated mt-1 ml-2 space-y-1 rounded-md p-1 shadow-sm"
              role="list"
              aria-label="{item.label} submenu"
            >
              {#each item.children as child (child.id)}
                <li>
                  <button
                    onclick={() => handleItemClick(child)}
                    onkeydown={(e) => handleKeydown(e, child)}
                    class="flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:ring-2 focus:ring-primary/20 focus:outline-hidden {activeItemId ===
                    child.id
                      ? 'bg-surface-selected text-foreground'
                      : ''}"
                    aria-current={activeItemId === child.id ? 'page' : undefined}
                    tabindex="0"
                  >
                    <span
                      class="size-4 flex-shrink-0"
                      aria-hidden="true"
                    >
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html child.icon}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-left">
                      {child.label}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  {#if user}
    <div class="p-4 border-t-strong">
      {#if !collapsed || isMobile}
        <div class="flex flex-row items-center">
          <div
            class="flex w-full cursor-default items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground"
          >
            <!-- Avatar -->
            <div
              class="flex size-8 items-center justify-center rounded-full bg-surface-selected text-sm font-semibold text-primary"
            >
              {user.name[0].toUpperCase()}
            </div>

            {#if !collapsed}
              <div class="flex-1 text-left">
                <div class="text-sm font-medium">{user.name}</div>
              </div>
            {/if}
          </div>

          <div>
            <button
              onclick={() => {
                handleLogout();
              }}
              class="cursor-pointer rounded-sm p-1.5 text-muted-foreground hover:bg-surface-hover focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon
                iconName="logout"
                size={24}
              />
            </button>
          </div>
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center gap-2 py-4">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-surface-selected text-sm font-semibold text-primary"
          >
            {user.name[0].toUpperCase()}
          </div>
          <button
            onclick={() => {
              handleLogout();
            }}
            class="cursor-pointer rounded-sm p-2 text-muted-foreground hover:bg-surface-hover focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
            title="Sign out"
            aria-label="Sign out"
          >
            <Icon
              iconName="logout"
              size={24}
            />
          </button>
        </div>
      {/if}
    </div>
  {/if}

  {#if appVersion}
    <div
      class="cursor-default px-2 py-2 text-center text-xs text-muted-foreground border-t-strong"
      title={collapsed && !isMobile ? `gdluxx v${appVersion}` : undefined}
    >
      {collapsed && !isMobile ? `v${appVersion}` : `gdluxx v${appVersion}`}
    </div>
  {/if}
</nav>
