/**
 * Form result type definitions for SvelteKit form actions
 * Following project TypeScript best practices: explicit interfaces over inline type assertions
 */

import type { ApiKey } from '$lib/apikey';

export interface ApiKeyCreateSuccessResult {
  success: boolean;
  apiKey?: ApiKey;
  plainKey?: string;
}

export interface ApiKeyDeleteSuccessResult {
  success: boolean;
  message?: string;
  deletedKeyId?: string;
}

export interface FormFailureResult {
  error?: string;
}

export interface ConfigSaveSuccessResult {
  success?: boolean;
  transformed?: boolean;
  content?: string;
}

export function isApiKeyCreateSuccess(data: unknown): data is ApiKeyCreateSuccessResult {
  return typeof data === 'object' && data !== null && 'success' in data;
}

export function isApiKeyDeleteSuccess(data: unknown): data is ApiKeyDeleteSuccessResult {
  return typeof data === 'object' && data !== null && 'success' in data;
}

export function isFormFailure(data: unknown): data is FormFailureResult {
  return typeof data === 'object' && data !== null;
}

export function isConfigSaveSuccess(data: unknown): data is ConfigSaveSuccessResult {
  return typeof data === 'object' && data !== null;
}
