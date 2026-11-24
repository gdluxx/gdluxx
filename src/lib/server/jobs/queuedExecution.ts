/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { z } from 'zod';
import type { GalleryDlMode } from '$lib/types/gallery-dl-mode';

// Bump whenever PROHIBITED_OPTION_IDS gets stricter. stored payloads replay
// their argv without re-validation, so older versions must be refused.
export const QUEUED_EXECUTION_VERSION = 1;

const queuedExecutionSchema = z.object({
  version: z.literal(QUEUED_EXECUTION_VERSION),
  policy: z.enum(['restricted', 'unrestricted']),
  kind: z.enum(['single', 'batch']),
  url: z.string().min(1),
  urls: z.array(z.string().min(1)).min(1).optional(),
  cliArgs: z.array(z.string()),
  options: z
    .object({
      fallbackUrls: z.array(z.string()).optional(),
      fallbackCliArgs: z.array(z.string()).optional(),
      fallbackDiagnostic: z.string().optional(),
      cookieUrl: z.string().optional(),
    })
    .optional(),
});

export type QueuedExecution = z.infer<typeof queuedExecutionSchema>;

export type QueuedExecutionInput = Omit<QueuedExecution, 'version' | 'policy'>;

export type ParsedQueuedExecution =
  | { ok: true; payload: QueuedExecution }
  | { ok: false; reason: string };

export const QUEUED_EXECUTION_MESSAGES = {
  invalid:
    "This job's stored command is missing or invalid, so it cannot be started. Submit the URL again.",
  version:
    "This job's stored command was saved by a different version of gdluxx and cannot be started. Submit the URL again.",
  policy:
    'This job was queued while gallery-dl ran in Unrestricted mode, and the server now runs Restricted. Submit the URL again.',
} as const;

export function buildQueuedExecution(
  input: QueuedExecutionInput,
  policy: GalleryDlMode,
): QueuedExecution {
  return { version: QUEUED_EXECUTION_VERSION, policy, ...input };
}

export function parseQueuedExecution(
  raw: string | null | undefined,
  currentPolicy: GalleryDlMode,
): ParsedQueuedExecution {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? '');
  } catch {
    return { ok: false, reason: QUEUED_EXECUTION_MESSAGES.invalid };
  }

  const version = (value as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version !== QUEUED_EXECUTION_VERSION) {
    return { ok: false, reason: QUEUED_EXECUTION_MESSAGES.version };
  }

  const parsed = queuedExecutionSchema.safeParse(value);
  if (!parsed.success || (parsed.data.kind === 'batch' && !parsed.data.urls)) {
    return { ok: false, reason: QUEUED_EXECUTION_MESSAGES.invalid };
  }

  if (parsed.data.policy === 'unrestricted' && currentPolicy === 'restricted') {
    return { ok: false, reason: QUEUED_EXECUTION_MESSAGES.policy };
  }

  return { ok: true, payload: parsed.data };
}

export function queuedExecutionHosts(payload: QueuedExecution): string[] {
  const urls = payload.kind === 'batch' ? (payload.urls ?? []) : [payload.url];
  const hosts = new Set<string>();
  for (const url of urls) {
    try {
      hosts.add(new URL(url).hostname.toLowerCase().replace(/\.$/, ''));
    } catch {
      hosts.add('unknown');
    }
  }
  return [...hosts];
}
