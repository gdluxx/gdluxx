/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { isAPIError } from 'better-auth/api';
import { auth } from '$lib/server/auth/better-auth';
import {
  getSessionTokenById,
  listActiveSessions,
  sessionExists,
} from '$lib/server/auth/sessionManager';
import { serverLogger as logger } from '$lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/**
 * Better-auth surfaces failures as `APIError` with a machine-readable `code` in
 * the body. Map the ones a user can actually act on; everything else collapses
 * to a generic message outside dev so internals aren't leaked.
 */
function getClientSafeMessage(error: unknown, fallback: string): string {
  if (isAPIError(error)) {
    const code = (error.body as { code?: string } | undefined)?.code;

    switch (code) {
      case 'INVALID_PASSWORD':
        return 'Current password is incorrect.';
      case 'PASSWORD_TOO_SHORT':
        return 'Password must be at least 8 characters.';
      case 'PASSWORD_TOO_LONG':
        return 'Password must be at most 128 characters.';
      case 'CHANGE_EMAIL_DISABLED':
        return 'Changing the email address is disabled on this server.';
      case 'USER_NOT_FOUND':
        return 'Account not found.';
      default:
        return dev ? error.message : fallback;
    }
  }

  if (dev && error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;

  if (!user) {
    redirect(302, '/auth/login');
  }

  const currentSessionId = locals.session?.session.id;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    sessions: listActiveSessions(user.id).map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    })),
  };
};

export const actions: Actions = {
  changeEmail: async ({ request, locals }) => {
    const user = locals.user;

    if (!user) {
      return fail(401, { error: 'Not authenticated.', success: false });
    }

    try {
      const formData = await request.formData();
      const newEmail = String(formData.get('newEmail') ?? '')
        .trim()
        .toLowerCase();
      const currentPassword = String(formData.get('currentPassword') ?? '');

      if (!newEmail) {
        return fail(400, { error: 'A new email address is required.', success: false });
      }
      if (newEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(newEmail)) {
        return fail(400, { error: 'Enter a valid email address.', success: false });
      }
      if (!currentPassword) {
        return fail(400, {
          error: 'Your current password is required to change the email address.',
          success: false,
        });
      }
      if (newEmail === user.email.toLowerCase()) {
        return fail(400, { error: 'That is already your email address.', success: false });
      }

      const ctx = await auth.$context;

      const accounts = await ctx.internalAdapter.findAccounts(user.id);
      const credential = accounts.find(
        (account) => account.providerId === 'credential' && account.password,
      );
      const passwordOk = credential?.password
        ? await ctx.password.verify({ hash: credential.password, password: currentPassword })
        : false;

      if (!passwordOk) {
        return fail(400, { error: 'Current password is incorrect.', success: false });
      }

      await auth.api.changeEmail({
        body: { newEmail },
        headers: request.headers,
      });

      const storedEmail = (await ctx.internalAdapter.findUserById(user.id))?.email ?? '';

      if (storedEmail.toLowerCase() !== newEmail) {
        return fail(400, {
          error: 'Email address could not be changed. It may already be in use.',
          success: false,
        });
      }

      return {
        success: true,
        message: `Email address updated to ${storedEmail}.`,
      };
    } catch (error) {
      logger.error('Error changing account email:', error);
      return fail(500, {
        error: getClientSafeMessage(error, 'The email address could not be changed.'),
        success: false,
      });
    }
  },

  revokeSession: async ({ request, locals }) => {
    const user = locals.user;

    if (!user) {
      return fail(401, { error: 'Not authenticated.', success: false });
    }

    try {
      const formData = await request.formData();
      const sessionId = String(formData.get('sessionId') ?? '');

      if (!sessionId) {
        return fail(400, { error: 'A session is required.', success: false });
      }

      const currentSessionId = locals.session?.session?.id;

      if (!currentSessionId || sessionId === currentSessionId) {
        return fail(400, {
          error: 'Use "Sign out everywhere" to end the session you are currently using.',
          success: false,
        });
      }

      const token = getSessionTokenById(sessionId, user.id);

      if (!token) {
        return fail(404, { error: 'That session no longer exists.', success: false });
      }

      await auth.api.revokeSession({
        body: { token },
        headers: request.headers,
      });

      if (sessionExists(sessionId, user.id)) {
        return fail(500, { error: 'The session could not be revoked.', success: false });
      }

      return {
        success: true,
        message: 'Session revoked.',
        revokedSessionId: sessionId,
      };
    } catch (error) {
      logger.error('Error revoking session:', error);
      return fail(500, {
        error: getClientSafeMessage(error, 'The session could not be revoked.'),
        success: false,
      });
    }
  },

  revokeOtherSessions: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated.', success: false });
    }

    try {
      await auth.api.revokeOtherSessions({ headers: request.headers });

      return {
        success: true,
        message: 'Signed out of all other devices.',
      };
    } catch (error) {
      logger.error('Error revoking other sessions:', error);
      return fail(500, {
        error: getClientSafeMessage(error, 'Other devices could not be signed out.'),
        success: false,
      });
    }
  },
};
