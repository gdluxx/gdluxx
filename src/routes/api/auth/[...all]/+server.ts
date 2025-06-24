import { auth } from '$lib/server/better-auth';
import type { RequestHandler } from '@sveltejs/kit';

const handler: RequestHandler = async ({ request }) => {
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
