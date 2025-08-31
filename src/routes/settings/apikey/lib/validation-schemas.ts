/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ValidationSchema } from '$lib/server/validation/validation-utils';

export const createApiKeySchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  expiresAt: {
    custom: (value) => !value || !isNaN(Date.parse(value as string)),
  },
};
