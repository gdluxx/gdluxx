import { getSharedDatabase } from '$lib/server/database';

export interface JobQueueSettings {
  maxConcurrent: number;
  perHostEnabled: boolean;
  maxConcurrentPerHost: number;
  sameHostDelayMs: number;
}

export const DEFAULT_JOB_QUEUE_SETTINGS: JobQueueSettings = {
  maxConcurrent: 5,
  perHostEnabled: false,
  maxConcurrentPerHost: 1,
  sameHostDelayMs: 2000,
};

export const jobQueueSettingsManager = {
  read(): JobQueueSettings {
    const row = getSharedDatabase()
      .prepare('SELECT maxConcurrent, perHostEnabled, maxConcurrentPerHost, sameHostDelayMs FROM job_queue_settings WHERE id = 1')
      .get() as
      | { maxConcurrent: number; perHostEnabled: number; maxConcurrentPerHost: number; sameHostDelayMs: number }
      | undefined;
    return row
      ? {
          maxConcurrent: row.maxConcurrent,
          perHostEnabled: Boolean(row.perHostEnabled),
          maxConcurrentPerHost: row.maxConcurrentPerHost,
          sameHostDelayMs: row.sameHostDelayMs,
        }
      : DEFAULT_JOB_QUEUE_SETTINGS;
  },

  write(settings: JobQueueSettings): void {
    const db = getSharedDatabase();
    const now = Date.now();
    db.prepare(`
      INSERT INTO job_queue_settings
        (id, maxConcurrent, perHostEnabled, maxConcurrentPerHost, sameHostDelayMs, createdAt, updatedAt)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        maxConcurrent = excluded.maxConcurrent,
        perHostEnabled = excluded.perHostEnabled,
        maxConcurrentPerHost = excluded.maxConcurrentPerHost,
        sameHostDelayMs = excluded.sameHostDelayMs,
        updatedAt = excluded.updatedAt
    `).run(
      settings.maxConcurrent,
      settings.perHostEnabled ? 1 : 0,
      settings.maxConcurrentPerHost,
      settings.sameHostDelayMs,
      now,
      now,
    );
  },
};
