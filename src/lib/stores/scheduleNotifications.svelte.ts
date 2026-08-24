/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { browser } from '$app/environment';
import type { ScheduleNotificationItem } from '$lib/types/schedules';
import { clientLogger as logger } from '$lib/client/logger';

interface ListParams {
  unreadOnly: boolean;
  limit: number;
  offset: number;
}

const DEFAULT_LIST_LIMIT = 100;

let unreadCount = $state(0);
let notifications = $state<ScheduleNotificationItem[]>([]);
let listLoading = $state(false);
let listParams = $state<ListParams>({ unreadOnly: false, limit: DEFAULT_LIST_LIMIT, offset: 0 });

function buildListQuery(params: ListParams): string {
  const parts = [`limit=${params.limit}`, `offset=${params.offset}`];
  if (params.unreadOnly) {
    parts.push('unread=true');
  }
  return `/api/schedule-notifications?${parts.join('&')}`;
}

// Fetch failures leave prior state untouched (last-good state) rather than
// resetting the badge/list to zero, so a transient network error never
// flashes a false "no notifications" state.
async function loadSummary(): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    const response = await fetch('/api/schedule-notifications/summary');
    const payload = await response.json();
    if (payload.success && payload.data) {
      unreadCount = payload.data.unread as number;
    }
  } catch (error) {
    logger.error('Failed to load schedule notifications summary:', error);
  }
}

// Seeds the store from the server-rendered initial page (avoids a fetch
// flash), then lets the summary catch up — mirrors jobStore.initializeWithJobs.
function initializeWithNotifications(items: ScheduleNotificationItem[]): void {
  notifications = items;
  void loadSummary();
}

async function loadList(params: Partial<ListParams> = {}): Promise<void> {
  if (!browser) {
    return;
  }
  listParams = { ...listParams, ...params };
  listLoading = true;
  try {
    const response = await fetch(buildListQuery(listParams));
    const payload = await response.json();
    if (payload.success && payload.data) {
      notifications = payload.data.notifications as ScheduleNotificationItem[];
    }
  } catch (error) {
    logger.error('Failed to load schedule notifications:', error);
  } finally {
    listLoading = false;
  }
}

async function acknowledge(id: string): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    const response = await fetch(`/api/schedule-notifications/${id}/acknowledge`, {
      method: 'POST',
    });
    const payload = await response.json();
    if (payload.success && payload.data) {
      const updated = payload.data as ScheduleNotificationItem;
      const index = notifications.findIndex((n) => n.id === id);
      if (index >= 0) {
        notifications[index] = updated;
      }
    }
  } catch (error) {
    logger.error(`Failed to acknowledge notification ${id}:`, error);
  } finally {
    await loadSummary();
  }
}

async function remove(ids: string[]): Promise<void> {
  if (!browser || ids.length === 0) {
    return;
  }
  try {
    const response = await fetch('/api/schedule-notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const payload = await response.json();
    if (payload.success) {
      const idSet = new Set(ids);
      notifications = notifications.filter((n) => !idSet.has(n.id));
    }
  } catch (error) {
    logger.error('Failed to delete notifications:', error);
  } finally {
    await loadSummary();
  }
}

async function clearAcknowledged(): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    const response = await fetch('/api/schedule-notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged: true }),
    });
    const payload = await response.json();
    if (payload.success) {
      notifications = notifications.filter((n) => n.acknowledgedAt === null);
    }
  } catch (error) {
    logger.error('Failed to clear acknowledged notifications:', error);
  } finally {
    await loadSummary();
  }
}

export const scheduleNotificationStore = {
  get unreadCount() {
    return unreadCount;
  },
  get notifications() {
    return notifications;
  },
  get listLoading() {
    return listLoading;
  },
  get listParams() {
    return listParams;
  },
  loadSummary,
  initializeWithNotifications,
  loadList,
  acknowledge,
  remove,
  clearAcknowledged,
};
