/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/**
 * Zod schema for `POST /api/config/merge`.
 *
 * `jsonValueSchema` mirrors the recursive union in
 * `src/lib/server/validation/catalog-validation.ts`
 */

import { z } from 'zod';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const configMergeSchema = z.object({
  path: z.array(z.string().min(1).max(128)).min(1).max(8),
  value: jsonValueSchema,
  overwrite: z.boolean().optional().default(false),
});
export type ConfigMergeInput = z.infer<typeof configMergeSchema>;
