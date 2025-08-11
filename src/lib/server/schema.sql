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
CREATE INDEX IF NOT EXISTS idx_job_outputs_jobId ON job_outputs(jobId);
CREATE INDEX IF NOT EXISTS idx_job_outputs_timestamp ON job_outputs(timestamp);
CREATE INDEX IF NOT EXISTS idx_site_configs_pattern ON site_configs(site_pattern);
CREATE INDEX IF NOT EXISTS idx_supported_sites_pattern ON supported_sites(url_pattern);
CREATE INDEX IF NOT EXISTS idx_supported_sites_category ON supported_sites(category);