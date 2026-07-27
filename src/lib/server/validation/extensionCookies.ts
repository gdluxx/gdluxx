/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { z } from 'zod';
import type { StoredCookie } from '$lib/server/cookieBackupManager';

export const MAX_COOKIES_PER_DOMAIN = 200;
export const MAX_DOMAINS = 500;
export const MAX_TOTAL_BYTES = 2_000_000;

const syncedBySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(200))
  .optional();

export const cookieSameSiteSchema = z.enum(['no_restriction', 'lax', 'strict', 'unspecified']);

export const storedCookieSchema: z.ZodType<StoredCookie> = z.object({
  // An empty cookie name is legal (`document.cookie = '=value'`) and the
  // browser returns it, so rejecting it would 400 the whole domain sync
  name: z.string().max(4096),
  value: z.string().max(8192),
  domain: z.string().min(1, 'Cookie domain is required').max(255),
  path: z.string().max(2048).default('/'),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  hostOnly: z.boolean().optional(),
  sameSite: cookieSameSiteSchema.optional(),
  session: z.boolean().optional(),
  expirationDate: z.number().nonnegative().optional(),
});

export const cookieUpsertSchema = z.object({
  domain: z.string().min(1, 'Domain is required').max(255),
  cookies: z
    .array(storedCookieSchema)
    .max(MAX_COOKIES_PER_DOMAIN, `Domain exceeds maximum of ${MAX_COOKIES_PER_DOMAIN} cookies.`),
  syncedBy: syncedBySchema,
});

export type CookieUpsertPayload = z.infer<typeof cookieUpsertSchema>;
