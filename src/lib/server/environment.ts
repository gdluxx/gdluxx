/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { existsSync, readFileSync, accessSync, constants } from 'fs';

// Detect if the app is running in Docker container
// Using multiple detection strategies

export function isRunningInDocker(): boolean {
  try {
    if (existsSync('/.dockerenv')) {
      return true;
    }
  } catch {
    // Ignore errors and continue
  }

  const containerEnvVars = ['CONTAINER', 'DOCKER', 'IS_DOCKER'];
  for (const envVar of containerEnvVars) {
    if (process.env[envVar]) {
      return true;
    }
  }

  try {
    if (existsSync('/proc/1/cgroup')) {
      const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
      if (
        cgroup.includes('docker') ||
        cgroup.includes('containerd') ||
        cgroup.includes('kubepods')
      ) {
        return true;
      }
    }
  } catch {
    // Ignore errors and continue
  }

  // check if /app directory exists
  try {
    if (existsSync('/app')) {
      accessSync('/app', constants.W_OK);
      return true;
    }
  } catch {
    // If /app doesn't exist we're probably not in a docker container
  }

  return false;
}

// Cach result
let _dockerDetectionResult: boolean | null = null;

export function isRunningInDockerCached(): boolean {
  if (_dockerDetectionResult === null) {
    _dockerDetectionResult = isRunningInDocker();
  }
  return _dockerDetectionResult;
}
