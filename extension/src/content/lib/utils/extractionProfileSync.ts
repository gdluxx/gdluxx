/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

type ConfigChangeListener = (host: string, sourceId: string) => void;

const listeners = new Set<ConfigChangeListener>();
let nextId = 0;

export function createSyncId(): string {
  nextId += 1;
  return `sync_${Date.now()}_${nextId}`;
}

export function publishExtractionConfigChange(sourceId: string, host: string): void {
  for (const cb of listeners) cb(host, sourceId);
}

export function subscribeExtractionConfigChange(cb: ConfigChangeListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
