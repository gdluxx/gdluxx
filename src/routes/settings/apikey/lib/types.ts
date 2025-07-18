/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface ApiKey {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  expiresAt?: string | null;
}

export interface NewApiKeyResponse {
  apiKey: ApiKey;
  plainKey: string;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresAt?: string;
}
