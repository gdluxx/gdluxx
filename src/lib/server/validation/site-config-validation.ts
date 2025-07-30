/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ValidationSchema } from './validation-utils';
import type { Option, OptionsData } from '$lib/types/options';
import optionsData from '$lib/assets/options.json';

// map for CLI option validation
const validOptions = new Map<string, Option>();
Object.values(optionsData as OptionsData).forEach(category => {
  category.options.forEach(option => {
    validOptions.set(option.id, option as Option);
  });
});

// Security validation patterns
const DANGEROUS_CHARS = [';', '|', '&', '`', '$', '(', ')', '<', '>', '"', "'", '\\'];
const URL_PATTERN = /^https?:\/\/.+/;
// Removed unused DOMAIN_PATTERN
const WILDCARD_PATTERN =
  /^\*$|^(\*\.|[a-zA-Z0-9])([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function containsDangerousChars(str: string): boolean {
  return DANGEROUS_CHARS.some(char => str.includes(char));
}

function validateCliOptionValue(optionId: string, value: unknown): boolean {
  const option = validOptions.get(optionId);
  if (!option) {
    return false;
  }

  if (option.type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (option.type === 'number') {
    const num = Number(value);
    return !isNaN(num) && isFinite(num);
  }

  if (option.type === 'string' || option.type === 'range') {
    const str = String(value).trim();

    if (containsDangerousChars(str)) {
      return false;
    }

    if (str.length === 0 || str.length > 500) {
      return false;
    }

    return true;
  }

  return false;
}

function validateSitePattern(pattern: string): boolean {
  const trimmed = pattern.trim();

  if (containsDangerousChars(trimmed)) {
    return false;
  }

  // Either wildcard or a valid domain pattern
  if (trimmed === '*') {
    return true;
  }
  return WILDCARD_PATTERN.test(trimmed);
}

function validateDisplayName(name: string): boolean {
  const trimmed = name.trim();

  if (containsDangerousChars(trimmed)) {
    return false;
  }

  return trimmed.length >= 1 && trimmed.length <= 100;
}

function validateCliOptions(options: unknown): boolean {
  if (!Array.isArray(options)) {
    return false;
  }
  if (options.length > 50) {
    return false;
  }

  for (const option of options) {
    if (!Array.isArray(option) || option.length !== 2) {
      return false;
    }
    const [optionId, value] = option;

    if (typeof optionId !== 'string' || !validateCliOptionValue(optionId, value)) {
      return false;
    }
  }

  return true;
}

export const siteConfigSchema: ValidationSchema = {
  site_pattern: {
    required: true,
    minLength: 1,
    maxLength: 253, // Max domain length
    custom: value => {
      if (typeof value !== 'string') {
        return false;
      }
      return validateSitePattern(value);
    },
  },
  display_name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    custom: value => {
      if (typeof value !== 'string') {
        return false;
      }
      return validateDisplayName(value);
    },
  },
  cli_options: {
    required: true,
    custom: validateCliOptions,
  },
  is_default: {
    custom: value => typeof value === 'boolean',
  },
  enabled: {
    custom: value => typeof value === 'boolean',
  },
};

export const siteConfigUpdateSchema: ValidationSchema = {
  site_pattern: {
    minLength: 1,
    maxLength: 253,
    custom: value => {
      if (typeof value !== 'string') {
        return false;
      }
      return validateSitePattern(value);
    },
  },
  display_name: {
    minLength: 1,
    maxLength: 100,
    custom: value => {
      if (typeof value !== 'string') {
        return false;
      }
      return validateDisplayName(value);
    },
  },
  cli_options: {
    custom: validateCliOptions,
  },
  is_default: {
    custom: value => typeof value === 'boolean',
  },
  enabled: {
    custom: value => typeof value === 'boolean',
  },
};

export const siteConfigIdSchema: ValidationSchema = {
  configId: {
    required: true,
    pattern: /^\d+$/,
  },
};

export const urlTestSchema: ValidationSchema = {
  url: {
    required: true,
    minLength: 1,
    maxLength: 2048,
    pattern: URL_PATTERN,
    custom: value => {
      if (typeof value !== 'string') {
        return false;
      }
      const trimmed = value.trim();

      if (containsDangerousChars(trimmed)) {
        return false;
      }
      try {
        new URL(trimmed);
        return true;
      } catch {
        return false;
      }
    },
  },
};

export const bulkSiteConfigSchema: ValidationSchema = {
  configs: {
    required: true,
    custom: value => {
      if (!Array.isArray(value)) {
        return false;
      }

      if (value.length > 20) {
        return false;
      }

      for (const config of value) {
        if (typeof config !== 'object' || !config) {
          return false;
        }

        try {
          if (!config.site_pattern || !config.display_name) {
            return false;
          }
        } catch {
          return false;
        }
      }

      return true;
    },
  },
};

export {
  validateSitePattern,
  validateDisplayName,
  validateCliOptions,
  validateCliOptionValue,
  containsDangerousChars,
};
