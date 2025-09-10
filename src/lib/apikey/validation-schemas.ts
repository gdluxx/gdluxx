/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export const API_KEY_VALIDATION = {
  NAME: {
    REQUIRED_MESSAGE: 'Name is required',
    LENGTH_MESSAGE: 'Name must be at most 100 characters',
    CHARSET_MESSAGE: 'Name may contain only letters, numbers, underscores, and hyphens',
    DUPLICATE_MESSAGE: 'An API key with this name already exists',
  },
  EXPIRES_AT: {
    INVALID_MESSAGE: 'Expiration date must be a valid date',
    PAST_MESSAGE: 'Expiration date must be in the future',
  },
  SERVER: {
    LOAD_FAILED: 'Failed to load API keys',
    CREATION_FAILED: 'Failed to create API key',
  },
} as const;

// Compatibility shim for existing server-side validation helper shape
export const createApiKeySchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  expiresAt: {
    custom: (value: unknown) => !value || !Number.isNaN(Date.parse(String(value))),
  },
};
