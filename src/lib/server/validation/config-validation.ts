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

export const configUpdateSchema: ValidationSchema = {
  content: {
    required: true,
    minLength: 1,
    custom: value => {
      if (typeof value !== 'string') {
        return false;
      }
      try {
        JSON.parse(value as string);
        return true;
      } catch {
        return false;
      }
    },
  },
};
