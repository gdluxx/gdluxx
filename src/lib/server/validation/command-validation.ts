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
import { validateConfigArray } from './validation-utils';
import { API_LIMITS } from '../constants';

export const commandStreamSchema: ValidationSchema = {
  url: {
    required: true,
    minLength: 1,
    pattern: /^https?:\/\/.+/,
  },
};

const URL_PATTERN = /^https?:\/\/.+/;

export const externalApiSchema: ValidationSchema = {
  // single URL
  urlToProcess: {
    required: false,
    minLength: 1,
    pattern: URL_PATTERN,
  },
  // array of URLs
  urls: {
    required: false,
    custom: (value: unknown) =>
      Array.isArray(value) &&
      validateConfigArray(
        value,
        API_LIMITS.MAX_BATCH_URLS,
        (u: unknown) => typeof u === 'string' && URL_PATTERN.test(u.trim()),
      ),
  },
};

export const jobIdSchema: ValidationSchema = {
  jobId: { required: true, minLength: 1 },
};
