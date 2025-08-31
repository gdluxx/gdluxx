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
  import { Icon } from '$lib/components';
  import { signOut } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast';

  interface NavItem {
    id: string;
    label: string;
    icon: string;
    href?: string;
    children?: NavItem[];
  }

  interface Props {
    items?: NavItem[];
    defaultCollapsed?: boolean;
    onNavigate?: (item: NavItem) => void;
    isMobile?: boolean;
    user?: { id: string; name: string; email: string };
  }

  const {
    items = [],
    defaultCollapsed = false,
    onNavigate = () => {
      // Intentionally empty, default no-op function
    },
    isMobile = false,
    user,
  }: Props = $props();

  let collapsed = $state(defaultCollapsed);
  let expandedItems = $state<Set<string>>(new Set());
  let activeItemId = $state<string>('');

  // Don't allow collapse on mobile - mobile is handled by layout
  $effect(() => {
    if (isMobile) {
      collapsed = false;
    }
  });

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
    expandedItems = new Set(expandedItems);
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
    if (collapsed) {
      onNavigate(item);
    } else {
      if (item.children) {
        toggleItem(item.id);
      } else {
        onNavigate(item);
      }
    }
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
      console.error('Logout error:', error);
    }
  }
</script>

<nav
  class="flex h-full flex-col bg-surface border-r-strong transition-all duration-300 overflow-x-hidden {collapsed &&
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
        class="cursor-pointer w-full flex items-center gap-3 pl-3 py-2 rounded-sm text-muted-foreground hover:bg-surface-hover focus:bg-surface-active focus:outline-hidden focus:border-focus transition-colors"
        aria-label={collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
        aria-expanded={!collapsed}
        aria-controls="nav-items-list"
        tabindex="0"
      >
        <span class="flex-shrink-0 flex items-center justify-center" aria-hidden="true">
          <Icon
            iconName="double-chevron-left"
            size={24}
            class="transition-transform {collapsed ? 'rotate-180' : ''}"
          />
        </span>
      </button>

      <!-- Tooltip for desktop collapsed state -->
      {#if collapsed}
        <div id="navigation-tooltip" class="sr-only" role="tooltip">Navigation</div>
      {/if}
    </div>
  {/if}

  <!-- Nav items -->
  <div
    class="flex-1 overflow-y-auto overflow-x-hidden p-2"
    id="nav-items-container"
    aria-labelledby={collapsed && !isMobile ? undefined : 'nav-heading'}
  >
    <ul id="nav-items-list" role="list" class="space-y-1">
      {#each items as item (item.id)}
        <li>
          <button
            onclick={() => handleItemClick(item)}
            onkeydown={e => handleKeydown(e, item)}
            class="cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-sm text-foreground hover:bg-surface-hover focus:bg-surface-hover focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-colors {activeItemId ===
            item.id
              ? 'bg-surface-selected text-foreground'
              : ''}"
            aria-expanded={item.children ? isItemExpanded(item.id) : undefined}
            aria-current={activeItemId === item.id ? 'page' : undefined}
            aria-describedby={collapsed && !isMobile ? `${item.id}-tooltip` : undefined}
            tabindex="0"
          >
            <span class="flex-shrink-0 size-5" aria-hidden="true">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html item.icon}
            </span>
            {#if !collapsed || isMobile}
              <span class="flex-1 text-left text-sm font-medium">
                {item.label}
              </span>

              <!-- Children items -->
              {#if item.children}
                <Icon
                  iconName="chevron-right"
                  size={16}
                  class="transition-all duration-200 {isItemExpanded(item.id) ? 'rotate-90' : ''}"
                  ariaLabel="Expand/Collapse"
                />
              {/if}
            {/if}
          </button>

          <!-- Tooltip for collapsed state desktop only) -->
          {#if collapsed && !isMobile}
            <div id="{item.id}-tooltip" class="sr-only" role="tooltip">
              {item.label}
            </div>
          {/if}

          <!-- Child items -->
          {#if item.children && isItemExpanded(item.id) && (!collapsed || isMobile)}
            <ul class="mt-1 ml-2 space-y-1" role="list" aria-label="{item.label} submenu">
              {#each item.children as child (child.id)}
                <li>
                  <button
                    onclick={() => handleItemClick(child)}
                    onkeydown={e => handleKeydown(e, child)}
                    class="cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm text-muted-foreground hover:bg-surface-hover focus:bg-surface-hover focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-colors {activeItemId ===
                    child.id
                      ? 'bg-surface-selected text-foreground'
                      : ''}"
                    aria-current={activeItemId === child.id ? 'page' : undefined}
                    tabindex="0"
                  >
                    <span class="size-4" aria-hidden="true">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html child.icon}
                    </span>
                    <span class="flex-1 text-left">
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
    <div class="border-t-strong p-4">
      {#if !collapsed || isMobile}
        <div class="flex flex-row items-center">
          <div
            class="cursor-default w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-surface-hover transition-colors"
          >
            <!-- Avatar -->
            <div
              class="size-8 rounded-full bg-surface-selected flex items-center justify-center text-primary font-semibold text-sm"
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
              class="cursor-pointer ml-2 p-1.5 rounded-sm text-muted-foreground hover:bg-surface-hover focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon iconName="logout" size={24} />
            </button>
          </div>
        </div>
      {:else}
        <div class="flex justify-center py-4 flex-col items-center gap-2">
          <div
            class="size-8 rounded-full bg-surface-selected flex items-center justify-center text-primary font-semibold text-sm"
          >
            {user.name[0].toUpperCase()}
          </div>
          <button
            onclick={() => {
              handleLogout();
            }}
            class="cursor-pointer ml-2 p-1.5 rounded-sm text-muted-foreground hover:bg-surface-hover focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            title="Sign out"
            aria-label="Sign out"
          >
            <Icon iconName="logout" size={24} />
          </button>
        </div>
      {/if}
    </div>
  {/if}
</nav>
