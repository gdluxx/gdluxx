import { createAuthClient } from 'better-auth/client';
import { browser } from '$app/environment';

export const authClient = createAuthClient({
  baseURL: browser ? window.location.origin : undefined,
});

export const { signIn, signUp, signOut, getSession, useSession } = authClient;
