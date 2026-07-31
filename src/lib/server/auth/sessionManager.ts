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
  listActive: Statement<[string, string]>;
  selectToken: Statement<[string, string]>;
  exists: Statement<[string, string]>;
}

let statements: PreparedStatements | null = null;

function getStatements(): PreparedStatements {
  if (!statements) {
    const db = getSharedDatabase();

    try {
      statements = {
        listActive: db.prepare(
          `SELECT id, expiresAt, createdAt, updatedAt, ipAddress, userAgent
           FROM session
           WHERE userId = ? AND expiresAt > ?
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

function toIsoString(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function listActiveSessions(userId: string): ActiveSession[] {
  try {
    const rows = getStatements().listActive.all(userId, new Date().toISOString()) as SessionRow[];

    return rows.map((row) => ({
      id: row.id,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      expiresAt: toIsoString(row.expiresAt),
      ipAddress: emptyToNull(row.ipAddress),
      userAgent: emptyToNull(row.userAgent),
    }));
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
