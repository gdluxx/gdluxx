/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, User } from '$lib/server/better-auth';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session?: Session;
      user?: User;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
