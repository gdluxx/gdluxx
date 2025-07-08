/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import type { ValidationSchema } from './validation-utils';

export const commandStreamSchema: ValidationSchema = {
  url: { 
    required: true, 
    minLength: 1,
    pattern: /^https?:\/\/.+/
  }
};

export const externalApiSchema: ValidationSchema = {
  apiKey: { required: true, minLength: 1 },
  urlToProcess: { 
    required: true, 
    minLength: 1, 
    pattern: /^https?:\/\/.+/ 
  }
};

export const jobIdSchema: ValidationSchema = {
  jobId: { required: true, minLength: 1 }
};