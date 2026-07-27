/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface ApiKeySummary {
  id: string;
  name: string;
}

export interface CookieDomainMetadata {
  domain: string;
  cookieCount: number;
  expiredCount: number;
  earliestExpiry: number | null;
  syncedBy: string | null;
  updatedAt: number;
}

export interface CookieBackupView {
  hasBackup: boolean;
  domains: CookieDomainMetadata[];
  domainCount: number;
  cookieCount: number;
  syncedBy: string | null;
  updatedAt: number | null;
}

export interface CookiesPageData {
  apiKeys: ApiKeySummary[];
  cookieBackups: Record<string, CookieBackupView>;
}
