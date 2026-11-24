/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { JOB_QUEUE } from '$lib/server/constants';

export interface JobQueueConfig {
  maxConcurrent: number;
  maxConcurrentPerHost: number | null;
  sameHostDelayMs: number;
}

interface IntegerRange {
  MIN: number;
  MAX: number;
}

type Env = Record<string, string | undefined>;

function readInteger(
  env: Env,
  name: string,
  range: IntegerRange,
  warnings: string[],
): number | undefined {
  const raw = env[name]?.trim();
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  if (/^\d+$/.test(raw) && value >= range.MIN && value <= range.MAX) {
    return value;
  }

  warnings.push(
    `Invalid ${name} value; expected a whole number from ${range.MIN} to ${range.MAX}. Using the default.`,
  );
  return undefined;
}

export function resolveJobQueueConfig(env: Env): { config: JobQueueConfig; warnings: string[] } {
  const warnings: string[] = [];

  const maxConcurrent =
    readInteger(env, 'GDLUXX_MAX_CONCURRENT_JOBS', JOB_QUEUE.MAX_CONCURRENT_JOBS, warnings) ??
    JOB_QUEUE.MAX_CONCURRENT_JOBS.DEFAULT;
  const maxConcurrentPerHost =
    readInteger(
      env,
      'GDLUXX_MAX_CONCURRENT_JOBS_PER_HOST',
      JOB_QUEUE.MAX_CONCURRENT_JOBS_PER_HOST,
      warnings,
    ) ?? null;
  const sameHostDelaySeconds =
    readInteger(
      env,
      'GDLUXX_SAME_HOST_START_DELAY_SECONDS',
      JOB_QUEUE.SAME_HOST_START_DELAY_SECONDS,
      warnings,
    ) ?? 0;

  return {
    config: { maxConcurrent, maxConcurrentPerHost, sameHostDelayMs: sameHostDelaySeconds * 1000 },
    warnings,
  };
}

const resolvedJobQueueConfig = resolveJobQueueConfig(process.env);

export const JOB_QUEUE_CONFIG: JobQueueConfig = resolvedJobQueueConfig.config;
export const JOB_QUEUE_CONFIG_WARNINGS: readonly string[] = resolvedJobQueueConfig.warnings;
