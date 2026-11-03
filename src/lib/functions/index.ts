/**
 * Universal Functions - Main Export
 * 
 * This module exports all handlers and utilities for use across platforms.
 */

// Runtime utilities
export * from './runtime';

// Supabase client factory
export * from './supabase';

// Shared types
export * from './types';

// Business logic handlers
export { handleAdminLogin } from './handlers/admin-login';
export { handleTOTPVerify } from './handlers/totp-verify';
export { handlePaystackInitialize, handlePaystackVerify, handlePaystackWebhook } from './handlers/paystack';
export { handleSendVerificationEmail, handleTestSMTP } from './handlers/email';
