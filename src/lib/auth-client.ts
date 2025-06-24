import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:5173', // TODO: Add to env
});

export const { signIn, signUp, signOut, getSession, useSession } = authClient;
