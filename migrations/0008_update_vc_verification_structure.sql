-- Migration: Update VC verification structure
-- Remove DID field, add name field for VP verification
-- Add email and name fields to VC sessions
-- Date: 2025-11-10

-- Update member_profiles table to add verified_name field
ALTER TABLE member_profiles ADD COLUMN verified_name TEXT;

-- Add comment for clarity
-- verified_name: Name extracted from VP verification (階級卡中的姓名)
-- linked_vc_did: Remove this field as DID is just transaction code

-- Note: We keep linked_vc_did for now to avoid breaking changes
-- It will be ignored in new verification logic

-- Add new fields to vc_verification_sessions table
ALTER TABLE vc_verification_sessions ADD COLUMN extracted_email TEXT;
ALTER TABLE vc_verification_sessions ADD COLUMN extracted_name TEXT;

-- Note: Keep extracted_did for backward compatibility but it will be ignored
