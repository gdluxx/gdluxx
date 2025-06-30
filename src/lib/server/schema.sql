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

/* LOGGING */
CREATE TABLE IF NOT EXISTS logging (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'INFO',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

/* API_KEYS */
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hashedKey TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);