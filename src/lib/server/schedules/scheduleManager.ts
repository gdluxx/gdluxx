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
import type { Recurrence } from './recurrence';
// getSharedDatabase, not openDatabase: these rows are written inside the
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

export type ScheduleStatus = 'active' | 'paused' | 'completed';
export type MisfirePolicy = 'skip' | 'catch_up';

export type ScheduleRecurrence = Recurrence;

// Fail direction for a corrupt recurrence column: a past one-shot, so the next
// scan completes the schedule instead of dispatching on garbage.
const FALLBACK_RECURRENCE: Recurrence = { kind: 'once', time: '00:00' };

export interface ScheduleCommandSource {
  urls: string[];
  userOptions: Array<[string, string | number | boolean]>;
  excludedOptions: string[];
}

export type ScheduleSiteOptionsSnapshot = Record<
  string,
  Array<[string, string | number | boolean]>
>;

export interface Schedule {
  id: string;
  userId: string;
  name: string;
  status: ScheduleStatus;
  timezone: string;
  recurrence: ScheduleRecurrence;
  startDate: string;
  endDate: string | null;
  misfirePolicy: MisfirePolicy;
  commandSource: ScheduleCommandSource;
  siteOptionsSnapshot: ScheduleSiteOptionsSnapshot;
  nextOccurrenceAt: number | null;
  lastOccurrenceAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface ScheduleRow {
  id: string;
  userId: string;
  name: string;
  status: string;
  timezone: string;
  recurrence: string;
  startDate: string;
  endDate: string | null;
  misfirePolicy: string;
  commandSource: string;
  siteOptionsSnapshot: string;
  nextOccurrenceAt: number | null;
  lastOccurrenceAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateScheduleInput {
  userId: string;
  name: string;
  status: ScheduleStatus;
  timezone: string;
  recurrence: ScheduleRecurrence;
  startDate: string;
  endDate: string | null;
  misfirePolicy: MisfirePolicy;
  commandSource: ScheduleCommandSource;
  siteOptionsSnapshot: ScheduleSiteOptionsSnapshot;
  nextOccurrenceAt: number | null;
}

export interface UpdateScheduleFields {
  name?: string;
  timezone?: string;
  recurrence?: ScheduleRecurrence;
  startDate?: string;
  endDate?: string | null;
  misfirePolicy?: MisfirePolicy;
  commandSource?: ScheduleCommandSource;
  siteOptionsSnapshot?: ScheduleSiteOptionsSnapshot;
  nextOccurrenceAt?: number | null;
  lastOccurrenceAt?: number | null;
  status?: ScheduleStatus;
}

export interface ClaimAdvanceFields {
  nextOccurrenceAt: number | null;
  lastOccurrenceAt: number;
  status: ScheduleStatus;
}

const SCHEDULE_COLUMNS =
  'id, userId, name, status, timezone, recurrence, startDate, endDate, misfirePolicy, ' +
  'commandSource, siteOptionsSnapshot, nextOccurrenceAt, lastOccurrenceAt, createdAt, updatedAt';

interface PreparedStatements {
  insert: Statement<
    [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string | null,
      string,
      string,
      string,
      number | null,
      number | null,
      number,
      number,
    ]
  >;
  selectById: Statement<[string]>;
  selectByIdForUser: Statement<[string, string]>;
  selectAllForUser: Statement<[string]>;
  deleteForUser: Statement<[string, string]>;
  claimAdvance: Statement<[number | null, number, string, number, string, number]>;
  setStatus: Statement<[string, number | null, number, string, string]>;
  due: Statement<[number]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    try {
      statements = {
        insert: db.prepare(`
          INSERT INTO schedules (
            id, userId, name, status, timezone, recurrence, startDate, endDate,
            misfirePolicy, commandSource, siteOptionsSnapshot, nextOccurrenceAt,
            lastOccurrenceAt, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        selectById: db.prepare(`SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE id = ?`),
        selectByIdForUser: db.prepare(
          `SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE id = ? AND userId = ?`,
        ),
        selectAllForUser: db.prepare(
          `SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE userId = ? ORDER BY createdAt DESC`,
        ),
        deleteForUser: db.prepare('DELETE FROM schedules WHERE id = ? AND userId = ?'),
        claimAdvance: db.prepare(`
          UPDATE schedules
          SET nextOccurrenceAt = ?, lastOccurrenceAt = ?, status = ?, updatedAt = ?
          WHERE id = ? AND status = 'active' AND nextOccurrenceAt = ?
        `),
        setStatus: db.prepare(`
          UPDATE schedules SET status = ?, nextOccurrenceAt = ?, updatedAt = ?
          WHERE id = ? AND userId = ?
        `),
        due: db.prepare(
          `SELECT ${SCHEDULE_COLUMNS} FROM schedules
           WHERE status = 'active' AND nextOccurrenceAt IS NOT NULL AND nextOccurrenceAt <= ?`,
        ),
      };
    } catch (error) {
      console.error('Failed to prepare schedule statements', error);
      throw error;
    }
  }
  return statements;
}

function parseJsonColumn<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to parse schedule JSON column', error);
    return fallback;
  }
}

function mapRow(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    status: row.status as ScheduleStatus,
    timezone: row.timezone,
    recurrence: parseJsonColumn<ScheduleRecurrence>(row.recurrence, FALLBACK_RECURRENCE),
    startDate: row.startDate,
    endDate: row.endDate,
    misfirePolicy: row.misfirePolicy as MisfirePolicy,
    commandSource: parseJsonColumn<ScheduleCommandSource>(row.commandSource, {
      urls: [],
      userOptions: [],
      excludedOptions: [],
    }),
    siteOptionsSnapshot: parseJsonColumn<ScheduleSiteOptionsSnapshot>(row.siteOptionsSnapshot, {}),
    nextOccurrenceAt: row.nextOccurrenceAt,
    lastOccurrenceAt: row.lastOccurrenceAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createSchedule(input: CreateScheduleInput): Schedule {
  const now = getCurrentTimestamp();
  const id = uuidv4();
  try {
    getStatements().insert.run(
      id,
      input.userId,
      input.name,
      input.status,
      input.timezone,
      JSON.stringify(input.recurrence),
      input.startDate,
      input.endDate ?? null,
      input.misfirePolicy,
      JSON.stringify(input.commandSource),
      JSON.stringify(input.siteOptionsSnapshot),
      input.nextOccurrenceAt,
      null,
      now,
      now,
    );
  } catch (error) {
    console.error('Failed to create schedule', error);
    throw error;
  }
  const row = getStatements().selectById.get(id) as ScheduleRow;
  return mapRow(row);
}

export function readSchedulesForUser(userId: string): Schedule[] {
  try {
    const rows = getStatements().selectAllForUser.all(userId) as ScheduleRow[];
    return rows.map(mapRow);
  } catch (error) {
    console.error('Failed to read schedules for user', error);
    return [];
  }
}

export function readScheduleForUser(id: string, userId: string): Schedule | null {
  try {
    const row = getStatements().selectByIdForUser.get(id, userId) as ScheduleRow | undefined;
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('Failed to read schedule for user', error);
    return null;
  }
}

export function updateSchedule(
  id: string,
  userId: string,
  fields: UpdateScheduleFields,
): Schedule | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name);
  }
  if (fields.timezone !== undefined) {
    sets.push('timezone = ?');
    params.push(fields.timezone);
  }
  if (fields.recurrence !== undefined) {
    sets.push('recurrence = ?');
    params.push(JSON.stringify(fields.recurrence));
  }
  if (fields.startDate !== undefined) {
    sets.push('startDate = ?');
    params.push(fields.startDate);
  }
  if (fields.endDate !== undefined) {
    sets.push('endDate = ?');
    params.push(fields.endDate);
  }
  if (fields.misfirePolicy !== undefined) {
    sets.push('misfirePolicy = ?');
    params.push(fields.misfirePolicy);
  }
  if (fields.commandSource !== undefined) {
    sets.push('commandSource = ?');
    params.push(JSON.stringify(fields.commandSource));
  }
  if (fields.siteOptionsSnapshot !== undefined) {
    sets.push('siteOptionsSnapshot = ?');
    params.push(JSON.stringify(fields.siteOptionsSnapshot));
  }
  if (fields.nextOccurrenceAt !== undefined) {
    sets.push('nextOccurrenceAt = ?');
    params.push(fields.nextOccurrenceAt);
  }
  if (fields.lastOccurrenceAt !== undefined) {
    sets.push('lastOccurrenceAt = ?');
    params.push(fields.lastOccurrenceAt);
  }
  if (fields.status !== undefined) {
    sets.push('status = ?');
    params.push(fields.status);
  }

  if (sets.length === 0) {
    return readScheduleForUser(id, userId);
  }

  sets.push('updatedAt = ?');
  params.push(getCurrentTimestamp());
  params.push(id, userId);

  try {
    const stmt = db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ? AND userId = ?`);
    const result = stmt.run(...params);
    if (result.changes === 0) {
      return null;
    }
  } catch (error) {
    console.error('Failed to update schedule', error);
    throw error;
  }

  return readScheduleForUser(id, userId);
}

export function deleteScheduleForUser(id: string, userId: string): boolean {
  try {
    const result = getStatements().deleteForUser.run(id, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Failed to delete schedule', error);
    throw error;
  }
}

export function setScheduleStatus(
  id: string,
  userId: string,
  fields: { status: ScheduleStatus; nextOccurrenceAt: number | null },
): Schedule | null {
  try {
    const result = getStatements().setStatus.run(
      fields.status,
      fields.nextOccurrenceAt,
      getCurrentTimestamp(),
      id,
      userId,
    );
    if (result.changes === 0) {
      return null;
    }
  } catch (error) {
    console.error('Failed to set schedule status', error);
    throw error;
  }
  return readScheduleForUser(id, userId);
}

export function readDueSchedules(nowMs: number): Schedule[] {
  try {
    const rows = getStatements().due.all(nowMs) as ScheduleRow[];
    return rows.map(mapRow);
  } catch (error) {
    console.error('Failed to read due schedules', error);
    return [];
  }
}

/**
 * Conditional advance: only applies when the schedule is still `active` and
 * `nextOccurrenceAt` still matches what the caller read the slot from. A
 * concurrent edit (pause/delete/PUT) changes one of those and the claim is
 * silently dropped rather than clobbering it — the return value is how the
 * coordinator detects that and aborts the claim transaction.
 */
export function claimAdvance(
  id: string,
  expectedNextOccurrenceAt: number,
  fields: ClaimAdvanceFields,
): number {
  try {
    const result = getStatements().claimAdvance.run(
      fields.nextOccurrenceAt,
      fields.lastOccurrenceAt,
      fields.status,
      getCurrentTimestamp(),
      id,
      expectedNextOccurrenceAt,
    );
    return result.changes;
  } catch (error) {
    console.error('Failed to claim schedule advance', error);
    throw error;
  }
}
