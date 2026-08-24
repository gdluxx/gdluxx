/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

/* AUTH */
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    emailVerified INTEGER DEFAULT 0,
    name TEXT,
    warnOnSiteRuleOverride INTEGER DEFAULT 0,
    selectedTheme TEXT DEFAULT 'indigo',
    maxBatchUrls INTEGER DEFAULT 200,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    expiresAt INTEGER NOT NULL,
    userId TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER
);

/* VERSION */
CREATE TABLE IF NOT EXISTS version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current TEXT,
    latestAvailable TEXT,
    lastChecked INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

/* SERVER_LOGGING */
CREATE TABLE IF NOT EXISTS server_logging (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 1,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'simple')),
    consoleEnabled INTEGER NOT NULL DEFAULT 1,
    fileEnabled INTEGER NOT NULL DEFAULT 0,
    fileDirectory TEXT NOT NULL DEFAULT './logs',
    fileMaxSize TEXT NOT NULL DEFAULT '10m',
    fileMaxFiles TEXT NOT NULL DEFAULT '7d',
    performanceLogging INTEGER NOT NULL DEFAULT 1,
    slowQueryThreshold INTEGER NOT NULL DEFAULT 1000,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

/* JOBS */
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'no_action', 'error')),
    startTime INTEGER NOT NULL,
    endTime INTEGER,
    exitCode INTEGER,
    downloadCount INTEGER DEFAULT 0,
    skipCount INTEGER DEFAULT 0,
    batchCount INTEGER DEFAULT NULL,
    useUserConfigPath INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS job_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
);

/* EXTENSION_PROFILE_BACKUPS */
CREATE TABLE IF NOT EXISTS extension_profile_backups (
    api_key_id TEXT PRIMARY KEY,
    bundle_json TEXT NOT NULL,
    profile_count INTEGER NOT NULL DEFAULT 0,
    synced_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

/* EXTENSION_SUB_BACKUPS */
CREATE TABLE IF NOT EXISTS extension_sub_backups (
    api_key_id TEXT PRIMARY KEY,
    bundle_json TEXT NOT NULL,
    profile_count INTEGER NOT NULL DEFAULT 0,
    synced_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

/* EXTENSION EXTRACTION PROFILES BACKUP */
CREATE TABLE IF NOT EXISTS extension_extraction_backups (
    api_key_id TEXT PRIMARY KEY REFERENCES apiKey(id) ON DELETE CASCADE,
    bundle_json TEXT NOT NULL,
    profile_count INTEGER NOT NULL DEFAULT 0,
    synced_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

/* EXTENSION COOKIE BACKUP */
CREATE TABLE IF NOT EXISTS extension_cookie_backups (
    api_key_id TEXT PRIMARY KEY REFERENCES apiKey(id) ON DELETE CASCADE,
    bundle_json TEXT NOT NULL,
    domain_count INTEGER NOT NULL DEFAULT 0,
    cookie_count INTEGER NOT NULL DEFAULT 0,
    synced_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

/* SITE_CONFIGS */
CREATE TABLE IF NOT EXISTS site_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_pattern TEXT NOT NULL,
    display_name TEXT NOT NULL,
    cli_options TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(site_pattern)
);

/* SUPPORTED_SITES - Retrieved from gallery-dl */
CREATE TABLE IF NOT EXISTS supported_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    url_pattern TEXT NOT NULL,
    category TEXT,
    capabilities TEXT,
    auth_supported INTEGER DEFAULT 0,
    last_fetched INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

/* SITE_DATA_META */
CREATE TABLE IF NOT EXISTS site_data_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_fetch_attempt INTEGER NOT NULL,
    last_successful_fetch INTEGER NOT NULL,
    sites_count INTEGER DEFAULT 0,
    fetch_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_startTime ON jobs(startTime);
CREATE INDEX IF NOT EXISTS idx_jobs_status_startTime ON jobs(status, startTime);
CREATE INDEX IF NOT EXISTS idx_jobs_downloadCount ON jobs(downloadCount);
CREATE INDEX IF NOT EXISTS idx_job_outputs_jobId ON job_outputs(jobId);
CREATE INDEX IF NOT EXISTS idx_job_outputs_timestamp ON job_outputs(timestamp);
CREATE INDEX IF NOT EXISTS idx_job_outputs_jobId_timestamp ON job_outputs(jobId, timestamp);
CREATE INDEX IF NOT EXISTS idx_site_configs_pattern ON site_configs(site_pattern);
CREATE INDEX IF NOT EXISTS idx_supported_sites_pattern ON supported_sites(url_pattern);
CREATE INDEX IF NOT EXISTS idx_supported_sites_category ON supported_sites(category);

/* SCHEDULES */
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
    timezone TEXT NOT NULL,
    recurrence TEXT NOT NULL,           -- JSON, shape validated by Zod
    startDate TEXT NOT NULL,            -- 'YYYY-MM-DD' wall-clock anchor date
    endDate TEXT,                       -- 'YYYY-MM-DD', inclusive, schedule tz
    misfirePolicy TEXT NOT NULL CHECK (misfirePolicy IN ('skip', 'catch_up')),
    commandSource TEXT NOT NULL,        -- JSON { urls, userOptions, excludedOptions }
    siteOptionsSnapshot TEXT NOT NULL,  -- JSON { [url]: [ [optionId, value], ... ] }
    nextOccurrenceAt INTEGER,           -- epoch ms; NULL when paused or completed
    lastOccurrenceAt INTEGER,           -- last claimed slot, any outcome
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    CHECK (status = 'active' OR nextOccurrenceAt IS NULL)
);

/* SCHEDULE_RUNS one row per claimed occurrence, manual run, or recovery */
CREATE TABLE IF NOT EXISTS schedule_runs (
    id TEXT PRIMARY KEY,
    scheduleId TEXT REFERENCES schedules(id) ON DELETE SET NULL,
    userId TEXT NOT NULL,               -- denormalized owner; deliberately no FK
    scheduleName TEXT NOT NULL,         -- denormalized for post-delete history
    trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'catch_up', 'manual', 'recovery')),
    outcome TEXT NOT NULL CHECK (outcome IN ('dispatching', 'launched', 'partial',
        'launch_failed', 'skipped_overlap', 'skipped_misfire')),
    scheduledFor INTEGER NOT NULL,      -- occurrence slot (epoch ms); manual/recovery = now
    urlCount INTEGER NOT NULL,
    launchedCount INTEGER NOT NULL DEFAULT 0,
    missedFrom INTEGER,                 -- misfire window, when applicable
    missedTo INTEGER,
    missedCount INTEGER,
    truncated INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

/* SCHEDULE_RUN_JOBS links an occurrence to the jobs it launched */
CREATE TABLE IF NOT EXISTS schedule_run_jobs (
    runId TEXT NOT NULL REFERENCES schedule_runs(id) ON DELETE CASCADE,
    jobId TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    PRIMARY KEY (runId, jobId)
);

/* SCHEDULE_NOTIFICATIONS */
CREATE TABLE IF NOT EXISTS schedule_notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,               -- denormalized owner; deliberately no FK
    scheduleId TEXT REFERENCES schedules(id) ON DELETE SET NULL,
    scheduleName TEXT NOT NULL,
    runId TEXT,                         -- informational; no FK
    type TEXT NOT NULL CHECK (type IN ('missed_skipped', 'missed_caught_up',
        'overlap_skipped', 'launch_failed')),
    occurrenceCount INTEGER NOT NULL DEFAULT 1,
    rangeStart INTEGER,
    rangeEnd INTEGER,
    acknowledgedAt INTEGER,             -- NULL = unread; set = acknowledged/archived
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(userId);
CREATE INDEX IF NOT EXISTS idx_schedules_due ON schedules(status, nextOccurrenceAt);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(scheduleId, createdAt);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_user ON schedule_runs(userId, createdAt);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_dispatching ON schedule_runs(outcome, createdAt);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_runs_slot
    ON schedule_runs(scheduleId, scheduledFor) WHERE trigger IN ('scheduled', 'catch_up');
CREATE INDEX IF NOT EXISTS idx_schedule_run_jobs_job ON schedule_run_jobs(jobId);
CREATE INDEX IF NOT EXISTS idx_schedule_notifications_user
    ON schedule_notifications(userId, acknowledgedAt, createdAt);
CREATE INDEX IF NOT EXISTS idx_schedule_notifications_coalesce
    ON schedule_notifications(scheduleId, type, acknowledgedAt);