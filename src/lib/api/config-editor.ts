/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface ConfigContent {
  content: string;
  source?: 'config' | 'example';
  mtimeISO?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchConfigContent(endpoint: string): Promise<ConfigContent> {
  const response = await fetch(endpoint, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result: ApiEnvelope<ConfigContent> = await response.json();
  if (!result?.success || !result?.data?.content) {
    throw new Error(result?.error ?? 'Invalid response format from server');
  }

  return result.data;
}

export async function fetchExampleConfig(): Promise<string> {
  const response = await fetch('/config-example.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const content = await response.text();

  try {
    JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON format in example configuration');
  }

  return content;
}
