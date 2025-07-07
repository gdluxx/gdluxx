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
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    REQUIRED_MESSAGE: 'I think you dropped your API key name',
    DUPLICATE_MESSAGE: 'You already thought of this API key name, get a fresh idea',
    TOO_LONG_MESSAGE: 'That API key name is getting a bit wordy, keep it under 100 characters',
  },
  EXPIRATION: {
    MAX_YEARS: 1,
    PAST_MESSAGE: 'Stop living in the past, expiration date must be in the future',
    TOO_FAR_MESSAGE:
      'Expiration date cannot be more than 1 year in the future, consider a non-expiring key',
    OVERFLOW_MESSAGE:
      'Whoa, time traveler! Expiration date is too far in the future (maximum ~68 years)',
  },
  SERVER: {
    CREATION_FAILED: 'Something went sideways while creating your API key, please try again',
    LOAD_FAILED: 'Failed to load your API keys from the vault',
    DELETE_FAILED: 'Could not delete that API key, it might be stuck',
    NOT_FOUND: 'That API key seems to have vanished into the digital ether',
  },
} as const;

export function validateApiKeyName(name: string): string | null {
  if (!name?.trim()) {
    return API_KEY_VALIDATION.NAME.REQUIRED_MESSAGE;
  }

  if (name.trim().length > API_KEY_VALIDATION.NAME.MAX_LENGTH) {
    return API_KEY_VALIDATION.NAME.TOO_LONG_MESSAGE;
  }

  return null;
}

export function validateExpirationDate(expirationDate: string): string | null {
  const expDate = new Date(expirationDate);
  const now = new Date();

  if (expDate <= now) {
    return API_KEY_VALIDATION.EXPIRATION.PAST_MESSAGE;
  }

  // Max 1 year expiration date
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + API_KEY_VALIDATION.EXPIRATION.MAX_YEARS);
  if (expDate > maxDate) {
    return API_KEY_VALIDATION.EXPIRATION.TOO_FAR_MESSAGE;
  }

  // integer overflow (68 years limit)
  const expiresInSeconds: number = Math.floor((expDate.getTime() - Date.now()) / 1000);
  const maxInt32 = 2147483647; // Maximum 32-bit signed integer
  if (expiresInSeconds > maxInt32) {
    return API_KEY_VALIDATION.EXPIRATION.OVERFLOW_MESSAGE;
  }

  return null;
}

// For frontend use
export function validateApiKeyInput(name: string, expirationDate?: string): string | null {
  // Validate name
  const nameError: string | null = validateApiKeyName(name);
  if (nameError) {
    return nameError;
  }

  // Validate expiration if provided
  if (expirationDate) {
    const expirationError: string | null = validateExpirationDate(expirationDate);
    if (expirationError) {
      return expirationError;
    }
  }

  return null;
}