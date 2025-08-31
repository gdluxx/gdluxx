/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import optionsData from '$lib/assets/options.json';
import type { Option, OptionsData } from '$lib/types/options';
import { serverLogger as logger } from '$lib/server/logger';

const validOptions = new Map<string, Option>();
Object.values(optionsData as OptionsData).forEach((category) => {
  category.options.forEach((option) => {
    validOptions.set(option.id, option as Option);
  });
});

export function validateOptionValue(option: Option, value: unknown): string | null {
  if (option.type === 'boolean') {
    return typeof value === 'boolean' ? String(value) : null;
  }

  if (option.type === 'number') {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) ? String(num) : null;
  }

  if (option.type === 'range') {
    const num = Number(value);
    return !isNaN(num) && isFinite(num) ? String(num) : null;
  }

  if (option.type === 'string') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  return null;
}

export function validateAndBuildCliArgs(argsMap: Map<string, unknown>): string[] {
  const cliArgs: string[] = [];

  for (const [optionId, value] of argsMap) {
    const option = validOptions.get(optionId);
    if (!option) {
      logger.warn(`Unknown option: ${optionId}`);
      continue;
    }

    const validatedValue = validateOptionValue(option, value);
    if (validatedValue === null) {
      logger.warn(`Invalid value for option ${optionId}:`, value);
      continue;
    }

    if (option.type === 'boolean') {
      if (validatedValue === 'true') {
        cliArgs.push(option.command);
      }
    } else {
      cliArgs.push(option.command, validatedValue);
    }
  }

  return cliArgs;
}

export { validOptions };
