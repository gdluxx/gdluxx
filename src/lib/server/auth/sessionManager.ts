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
import { getSharedDatabase } from '$lib/server/database';

export interface ActiveSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface SessionRow {
  id: string;
  createdAt: string | number;
  updatedAt: string | number;
  expiresAt: string | number;
  ipAddress: string | null;
  userAgent: string | null;
}

interface PreparedStatements {
  listActive: Statement<[string]>;
  selectToken: Statement<[string, string]>;
  exists: Statement<[string, string]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    const db = getSharedDatabase();

    try {
      statements = {
        // No expiresAt comparison here: the column's on-disk representation
        // (ISO text today, possibly epoch ms from a future adapter) isn't
        // known at query time, and SQLite's type-ordering would silently
        // misfilter a mix (AUTH-019c).
        listActive: db.prepare(
          `SELECT id, expiresAt, createdAt, updatedAt, ipAddress, userAgent
           FROM session
           WHERE userId = ?
           ORDER BY createdAt DESC`,
        ),
        selectToken: db.prepare('SELECT token FROM session WHERE id = ? AND userId = ?'),
        exists: db.prepare('SELECT 1 AS present FROM session WHERE id = ? AND userId = ?'),
      };
    } catch (error) {
      console.error('Failed to prepare session statements:', error);
      throw error;
    }
  }

  return statements;
}

/** better-auth stores a missing IP/UA as `''` on some requests, not NULL. */
function emptyToNull(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  return value;
}

// A positive expiresAt below this is almost certainly epoch-seconds (or another
// wrong unit) rather than a genuine epoch-ms expiry decades in the past.
const EPOCH_MS_PLAUSIBILITY_FLOOR = 1_000_000_000_000;

/** Bare numbers are epoch milliseconds, never seconds. */
function toEpochMs(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toIsoString(value: string | number | null): string {
  const epochMs = toEpochMs(value);
  if (epochMs === null) {
    return '';
  }
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function listActiveSessions(userId: string): ActiveSession[] {
  try {
    const rows = getStatements().listActive.all(userId) as SessionRow[];
    const now = Date.now();

    let unparseableCount = 0;
    let implausibleEpochCount = 0;

    const normalized = rows.map((row) => {
      const expiresAtMs = toEpochMs(row.expiresAt);
      if (expiresAtMs === null) {
        unparseableCount += 1;
      } else if (expiresAtMs > 0 && expiresAtMs < EPOCH_MS_PLAUSIBILITY_FLOOR) {
        implausibleEpochCount += 1;
      }
      return {
        row,
        expiresAtMs,
        createdAtMs: toEpochMs(row.createdAt) ?? 0,
      };
    });

    // A representation change that silently emptied this list would cost the
    // user the per-session revoke control with no signal, so surface it rather
    // than letting the filter below swallow it quietly.
    if (unparseableCount > 0 || implausibleEpochCount > 0) {
      console.warn(
        `listActiveSessions: ${unparseableCount} session row(s) had unparseable expiresAt and ` +
          `${implausibleEpochCount} had an implausible epoch value; both were treated as expired. ` +
          `Investigate possible wrong-unit storage.`,
      );
    }

    return (
      normalized
        // Fail closed for display: a session whose expiry can't be parsed is
        // excluded rather than assumed active.
        .filter(({ expiresAtMs }) => expiresAtMs !== null && expiresAtMs > now)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .map(({ row }) => ({
          id: row.id,
          createdAt: toIsoString(row.createdAt),
          updatedAt: toIsoString(row.updatedAt),
          expiresAt: toIsoString(row.expiresAt),
          ipAddress: emptyToNull(row.ipAddress),
          userAgent: emptyToNull(row.userAgent),
        }))
    );
  } catch (error) {
    console.error('Failed to list active sessions:', error);
    return [];
  }
}

export function getSessionTokenById(sessionId: string, userId: string): string | null {
  try {
    const row = getStatements().selectToken.get(sessionId, userId) as { token: string } | undefined;

    return row?.token ?? null;
  } catch (error) {
    console.error('Failed to resolve session token:', error);
    return null;
  }
}

export function sessionExists(sessionId: string, userId: string): boolean {
  try {
    const row = getStatements().exists.get(sessionId, userId) as { present: number } | undefined;

    return row !== undefined;
  } catch (error) {
    console.error('Failed to check session existence:', error);
    // Fail closed: an unreadable DB must not be reported as "revoked"
    return true;
  }
}
