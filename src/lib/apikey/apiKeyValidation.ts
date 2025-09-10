/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { API_KEY_VALIDATION } from './validation-schemas';

export function validateApiKeyName(name: string): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return API_KEY_VALIDATION.NAME.REQUIRED_MESSAGE;
  if (trimmed.length > 100) return API_KEY_VALIDATION.NAME.LENGTH_MESSAGE;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return API_KEY_VALIDATION.NAME.CHARSET_MESSAGE;
  return null;
}

export function validateExpirationDate(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return API_KEY_VALIDATION.EXPIRES_AT.INVALID_MESSAGE;
  if (ms <= Date.now()) return API_KEY_VALIDATION.EXPIRES_AT.PAST_MESSAGE;
  return null;
}

export function validateApiKeyInput(name: string, expiresAt?: string): string | null {
  return validateApiKeyName(name) || validateExpirationDate(expiresAt);
}

export { API_KEY_VALIDATION } from './validation-schemas';
