-- Migration for Google OAuth Support
-- This migration adds the necessary tables for NextAuth.js OAuth integration

-- Make passwordHash optional for OAuth-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Account table for OAuth providers
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    
    CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT accounts_provider_provider_account_id_key 
        UNIQUE (provider, provider_account_id)
);

-- Session table for NextAuth sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Verification token table for email verification
CREATE TABLE verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT verification_tokens_identifier_token_key 
        UNIQUE (identifier, token)
);

-- Indexes for better query performance
CREATE INDEX accounts_user_id_idx ON accounts(user_id);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
