import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { jobQueueSettingsManager } from '$lib/server/jobQueueSettings';
import { jobQueue } from '$lib/server/jobs/jobQueue';

const schema = z.object({
  maxConcurrent: z.number().int().min(1).max(100),
  perHostEnabled: z.boolean(),
  maxConcurrentPerHost: z.number().int().min(1).max(100),
  sameHostDelayMs: z.number().int().min(0).max(3_600_000),
}).strict();

export const GET: RequestHandler = ({ locals }) => {
  requireUser(locals);
  return json({ success: true, data: jobQueueSettingsManager.read() }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  requireUser(locals);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return json({ success: false, error: parsed.error.issues.map((issue) => issue.message).join(', ') }, { status: 400 });
  }
  jobQueueSettingsManager.write(parsed.data);
  jobQueue.capacityChanged();
  return json({ success: true, message: 'Queue settings updated' });
};
