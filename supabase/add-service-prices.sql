-- Migration: add service_prices JSONB column to tutor_profiles
-- Stores per-service pricing, e.g. {"essays": 50, "sat-act": 65, "activities": 45}
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS service_prices jsonb DEFAULT '{}';
