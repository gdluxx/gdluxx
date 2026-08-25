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

import type BetterSqlite3 from 'better-sqlite3';
import { optionsById } from '$lib/utils/commandOptions';

type OptionTuple = [string, string | number | boolean];

interface SiteConfigRow {
  id: number;
  cli_options: string;
}

interface ScheduleRow {
  id: string;
  commandSource: string;
  siteOptionsSnapshot: string;
}

interface ScheduleCommandSourceJson {
  urls: string[];
  userOptions: OptionTuple[];
  excludedOptions: string[];
}

function shouldFlip(tuple: OptionTuple): boolean {
  const [id, value] = tuple;
  return value === false && optionsById.get(id)?.type === 'boolean';
}

function normalizeTuples(tuples: OptionTuple[]): { tuples: OptionTuple[]; changed: boolean } {
  let changed = false;
  const normalized = tuples.map((tuple): OptionTuple => {
    if (shouldFlip(tuple)) {
      changed = true;
      return [tuple[0], true];
    }
    return tuple;
  });
  return { tuples: normalized, changed };
}

function normalizeSiteConfigs(db: BetterSqlite3.Database): number {
  const rows = db.prepare('SELECT id, cli_options FROM site_configs').all() as SiteConfigRow[];
  const update = db.prepare('UPDATE site_configs SET cli_options = ? WHERE id = ?');

  let changedCount = 0;
  for (const row of rows) {
    let parsed: OptionTuple[];
    try {
      parsed = JSON.parse(row.cli_options) as OptionTuple[];
      if (!Array.isArray(parsed)) {
        throw new Error('cli_options is not an array');
      }
    } catch {
      console.warn(`Skipping unparsable site_configs row (id=${row.id})`);
      continue;
    }

    const { tuples, changed } = normalizeTuples(parsed);
    if (changed) {
      update.run(JSON.stringify(tuples), row.id);
      changedCount++;
    }
  }
  return changedCount;
}

function normalizeSchedules(db: BetterSqlite3.Database): number {
  const rows = db
    .prepare('SELECT id, commandSource, siteOptionsSnapshot FROM schedules')
    .all() as ScheduleRow[];
  const update = db.prepare(
    'UPDATE schedules SET commandSource = ?, siteOptionsSnapshot = ? WHERE id = ?',
  );

  let changedCount = 0;
  for (const row of rows) {
    let commandSource: ScheduleCommandSourceJson;
    let snapshot: Record<string, OptionTuple[]>;
    try {
      commandSource = JSON.parse(row.commandSource) as ScheduleCommandSourceJson;
      if (!Array.isArray(commandSource.userOptions)) {
        throw new Error('commandSource.userOptions is not an array');
      }

      snapshot = JSON.parse(row.siteOptionsSnapshot) as Record<string, OptionTuple[]>;
      if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
        throw new Error('siteOptionsSnapshot is not an object');
      }
      for (const tuples of Object.values(snapshot)) {
        if (!Array.isArray(tuples)) {
          throw new Error('siteOptionsSnapshot entry is not an array');
        }
      }
    } catch {
      console.warn(`Skipping unparsable schedules row (id=${row.id})`);
      continue;
    }

    const { tuples: userOptions, changed: commandSourceChanged } = normalizeTuples(
      commandSource.userOptions,
    );

    let snapshotChanged = false;
    const normalizedSnapshot: Record<string, OptionTuple[]> = {};
    for (const [url, tuples] of Object.entries(snapshot)) {
      const result = normalizeTuples(tuples);
      normalizedSnapshot[url] = result.tuples;
      snapshotChanged ||= result.changed;
    }

    if (!commandSourceChanged && !snapshotChanged) {
      continue;
    }

    const newCommandSource = commandSourceChanged
      ? JSON.stringify({ ...commandSource, userOptions })
      : row.commandSource;
    const newSnapshot = snapshotChanged
      ? JSON.stringify(normalizedSnapshot)
      : row.siteOptionsSnapshot;

    update.run(newCommandSource, newSnapshot, row.id);
    changedCount++;
  }
  return changedCount;
}

export function normalizeBooleanOptionValues(db: BetterSqlite3.Database): void {
  const run = db.transaction(() => ({
    siteConfigsChanged: normalizeSiteConfigs(db),
    schedulesChanged: normalizeSchedules(db),
  }));
  const { siteConfigsChanged, schedulesChanged } = run();

  if (siteConfigsChanged > 0) {
    console.log(`Normalized boolean option values on ${siteConfigsChanged} site config(s).`);
  }
  if (schedulesChanged > 0) {
    console.log(`Normalized boolean option values on ${schedulesChanged} schedule(s).`);
  }
}
