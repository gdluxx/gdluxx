/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/* eslint-disable no-console */

import type { Statement } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
// getSharedDatabase, not openDatabase: upsertCoalesced runs inside the
// coordinator's transaction on the shared connection; a per-module connection
// would sit outside it.
import { getSharedDatabase } from '$lib/server/database';

const db = getSharedDatabase();

// Re-declared locally rather than imported from settingsManager, which sits
// on a live import cycle (logger.ts -> loggingManager.ts -> settingsManager.ts
// -> logger.ts) that would drag winston into this module.
function getCurrentTimestamp(): number {
  return Date.now();
}

export type NotificationType =
  | 'missed_skipped'
  | 'missed_caught_up'
  | 'overlap_skipped'
  | 'launch_failed';

export interface ScheduleNotification {
  id: string;
  userId: string;
  scheduleId: string | null;
  scheduleName: string;
  runId: string | null;
  type: NotificationType;
  occurrenceCount: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  acknowledgedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface ScheduleNotificationRow {
  id: string;
  userId: string;
  scheduleId: string | null;
  scheduleName: string;
  runId: string | null;
  type: string;
  occurrenceCount: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  acknowledgedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertCoalescedInput {
  userId: string;
  scheduleId: string | null;
  scheduleName: string;
  runId: string | null;
  type: NotificationType;
  rangeStart: number | null;
  rangeEnd: number | null;
}

export interface ReadForUserOptions {
  unreadOnly?: boolean;
  limit: number;
  offset: number;
}

export type DeleteForUserSelector = { ids: string[] } | { acknowledged: true };

const NOTIFICATION_COLUMNS =
  'id, userId, scheduleId, scheduleName, runId, type, occurrenceCount, rangeStart, ' +
  'rangeEnd, acknowledgedAt, createdAt, updatedAt';

interface PreparedStatements {
  update: Statement<[number | null, string | null, string, number, string | null, string]>;
  insert: Statement<
    [
      string,
      string,
      string | null,
      string,
      string | null,
      string,
      number,
      number | null,
      number | null,
      number,
      number,
    ]
  >;
  selectById: Statement<[string]>;
  countUnread: Statement<[string]>;
  acknowledge: Statement<[number, number, string, string]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    try {
      statements = {
        // scheduleId matched with plain `=`, never `IS`: a NULL scheduleId
        // (schedule already deleted) can never match a row here by design,
        // so a deleted schedule's events always fall through to INSERT below.
        update: db.prepare(`
          UPDATE schedule_notifications
          SET occurrenceCount = occurrenceCount + 1,
              rangeEnd = MAX(COALESCE(rangeEnd, 0), ?),
              runId = ?,
              scheduleName = ?,
              updatedAt = ?
          WHERE scheduleId = ? AND type = ? AND acknowledgedAt IS NULL
        `),
        insert: db.prepare(`
          INSERT INTO schedule_notifications (
            id, userId, scheduleId, scheduleName, runId, type, occurrenceCount,
            rangeStart, rangeEnd, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        selectById: db.prepare(
          `SELECT ${NOTIFICATION_COLUMNS} FROM schedule_notifications WHERE id = ?`,
        ),
        countUnread: db.prepare(
          'SELECT COUNT(*) AS count FROM schedule_notifications WHERE userId = ? AND acknowledgedAt IS NULL',
        ),
        acknowledge: db.prepare(`
          UPDATE schedule_notifications
          SET acknowledgedAt = COALESCE(acknowledgedAt, ?), updatedAt = ?
          WHERE id = ? AND userId = ?
        `),
      };
    } catch (error) {
      console.error('Failed to prepare schedule notification statements', error);
      throw error;
    }
  }
  return statements;
}

function mapRow(row: ScheduleNotificationRow): ScheduleNotification {
  return {
    id: row.id,
    userId: row.userId,
    scheduleId: row.scheduleId,
    scheduleName: row.scheduleName,
    runId: row.runId,
    type: row.type as NotificationType,
    occurrenceCount: row.occurrenceCount,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    acknowledgedAt: row.acknowledgedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Atomic UPDATE-then-INSERT: folds into the live unacknowledged row for this
 * (scheduleId, type) when one exists, otherwise starts a fresh one. Runs
 * inside the caller's transaction — no transaction is opened here.
 */
export function upsertCoalesced(input: UpsertCoalescedInput): void {
  const now = getCurrentTimestamp();
  try {
    const updateResult = getStatements().update.run(
      input.rangeEnd,
      input.runId,
      input.scheduleName,
      now,
      input.scheduleId,
      input.type,
    );
    if (updateResult.changes === 0) {
      getStatements().insert.run(
        uuidv4(),
        input.userId,
        input.scheduleId,
        input.scheduleName,
        input.runId,
        input.type,
        1,
        input.rangeStart,
        input.rangeEnd,
        now,
        now,
      );
    }
  } catch (error) {
    console.error('Failed to upsert coalesced schedule notification', error);
    throw error;
  }
}

export function readForUser(userId: string, options: ReadForUserOptions): ScheduleNotification[] {
  try {
    const unreadClause = options.unreadOnly ? 'AND acknowledgedAt IS NULL' : '';
    const stmt = db.prepare(
      `SELECT ${NOTIFICATION_COLUMNS} FROM schedule_notifications
       WHERE userId = ? ${unreadClause}
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
    );
    const rows = stmt.all(userId, options.limit, options.offset) as ScheduleNotificationRow[];
    return rows.map(mapRow);
  } catch (error) {
    console.error('Failed to read schedule notifications for user', error);
    return [];
  }
}

export function countUnreadForUser(userId: string): number {
  try {
    const row = getStatements().countUnread.get(userId) as { count: number };
    return row.count;
  } catch (error) {
    console.error('Failed to count unread schedule notifications', error);
    return 0;
  }
}

export function acknowledge(id: string, userId: string): ScheduleNotification | null {
  const now = getCurrentTimestamp();
  try {
    const result = getStatements().acknowledge.run(now, now, id, userId);
    if (result.changes === 0) {
      return null;
    }
  } catch (error) {
    console.error('Failed to acknowledge schedule notification', error);
    throw error;
  }
  const row = getStatements().selectById.get(id) as ScheduleNotificationRow | undefined;
  return row ? mapRow(row) : null;
}

export function deleteForUser(userId: string, selector: DeleteForUserSelector): number {
  try {
    if ('acknowledged' in selector && selector.acknowledged) {
      const stmt = db.prepare(
        'DELETE FROM schedule_notifications WHERE userId = ? AND acknowledgedAt IS NOT NULL',
      );
      return stmt.run(userId).changes;
    }

    const ids = 'ids' in selector ? selector.ids : [];
    if (ids.length === 0) {
      return 0;
    }
    const placeholders = ids.map(() => '?').join(', ');
    const stmt = db.prepare(
      `DELETE FROM schedule_notifications WHERE userId = ? AND id IN (${placeholders})`,
    );
    return stmt.run(userId, ...ids).changes;
  } catch (error) {
    console.error('Failed to delete schedule notifications', error);
    throw error;
  }
}
