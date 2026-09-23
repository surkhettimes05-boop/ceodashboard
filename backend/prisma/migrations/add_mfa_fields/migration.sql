-- Migration: Add MFA Fields to User Model
-- Created: 2024-01-19
-- Purpose: Add fields for Multi-Factor Authentication (MFA) support

-- Add MFA fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMP;
