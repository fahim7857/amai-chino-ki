-- Migration 003: Add avatar_url column to user_profiles
ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT DEFAULT NULL;
