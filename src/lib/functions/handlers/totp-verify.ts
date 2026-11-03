/**
 * TOTP Verification Handler - Universal Business Logic
 * 
 * Handles TOTP (Time-based One-Time Password) verification for admin 2FA.
 */

import { createServiceClient } from '../supabase';
import type { TOTPVerifyRequest, TOTPVerifyResponse } from '../types';

// RFC 4648 Base32 decode
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate TOTP code from secret and time
 */
async function generateTOTP(secret: string, timeStep = 30): Promise<string> {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setBigUint64(0, BigInt(time));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const hmac = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
  const hmacArray = new Uint8Array(hmac);

  const offset = hmacArray[hmacArray.length - 1] & 0x0f;
  const code =
    ((hmacArray[offset] & 0x7f) << 24) |
    ((hmacArray[offset + 1] & 0xff) << 16) |
    ((hmacArray[offset + 2] & 0xff) << 8) |
    (hmacArray[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, '0');
}

/**
 * Verify TOTP code with time window tolerance
 */
async function verifyTOTPCode(secret: string, token: string): Promise<boolean> {
  // Check current and adjacent time windows
  for (const offset of [0, -1, 1]) {
    const time = Math.floor(Date.now() / 1000 / 30) + offset;
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setBigUint64(0, BigInt(time));

    const key = base32Decode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const hmacArray = new Uint8Array(hmac);

    const byteOffset = hmacArray[hmacArray.length - 1] & 0x0f;
    const code =
      ((hmacArray[byteOffset] & 0x7f) << 24) |
      ((hmacArray[byteOffset + 1] & 0xff) << 16) |
      ((hmacArray[byteOffset + 2] & 0xff) << 8) |
      (hmacArray[byteOffset + 3] & 0xff);

    const expectedToken = String(code % 1000000).padStart(6, '0');

    if (expectedToken === token) {
      return true;
    }
  }

  return false;
}

/**
 * Handle TOTP verification
 */
export async function handleTOTPVerify(body: TOTPVerifyRequest): Promise<TOTPVerifyResponse> {
  const { user_id, token, action, email, password } = body;

  const supabase = await createServiceClient();

  // Check lockout status
  if (action === 'check_lockout') {
    const { data: totpData } = await supabase
      .from('admin_totp_secrets')
      .select('failed_attempts, locked_until')
      .eq('user_id', user_id)
      .single();

    if (!totpData) {
      return { locked: false, failed_attempts: 0 };
    }

    // Check if currently locked
    if (totpData.locked_until) {
      const lockedUntil = new Date(totpData.locked_until);
      if (lockedUntil > new Date()) {
        return {
          locked: true,
          locked_until: totpData.locked_until,
          failed_attempts: totpData.failed_attempts,
        };
      }

      // Lock expired, reset
      await supabase
        .from('admin_totp_secrets')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('user_id', user_id);
    }

    return {
      locked: false,
      failed_attempts: totpData.failed_attempts,
      remaining_attempts: Math.max(0, 3 - totpData.failed_attempts),
    };
  }

  // Verify TOTP code
  if (!user_id || !token) {
    return { success: false, error: 'User ID and token are required' };
  }

  // Check for lockout first
  const { data: totpData, error: totpError } = await supabase
    .from('admin_totp_secrets')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (totpError || !totpData) {
    return { success: false, error: '2FA not configured' };
  }

  // Check if locked
  if (totpData.locked_until) {
    const lockedUntil = new Date(totpData.locked_until);
    if (lockedUntil > new Date()) {
      return {
        success: false,
        locked: true,
        locked_until: totpData.locked_until,
        error: 'Account temporarily locked due to failed attempts',
      };
    }
  }

  // Check for backup code first
  const backupCodes = totpData.backup_codes || [];
  const isBackupCode = backupCodes.includes(token.toUpperCase());

  let isValid = false;

  if (isBackupCode) {
    // Remove used backup code
    const updatedCodes = backupCodes.filter((c: string) => c !== token.toUpperCase());
    await supabase
      .from('admin_totp_secrets')
      .update({ backup_codes: updatedCodes })
      .eq('user_id', user_id);

    isValid = true;
  } else {
    // Verify TOTP
    isValid = await verifyTOTPCode(totpData.secret_encrypted, token);
  }

  if (!isValid) {
    // Increment failed attempts
    const newAttempts = (totpData.failed_attempts || 0) + 1;
    const updates: any = { failed_attempts: newAttempts };

    // Lock after 3 failed attempts
    if (newAttempts >= 3) {
      const lockUntil = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
      updates.locked_until = lockUntil.toISOString();
    }

    await supabase.from('admin_totp_secrets').update(updates).eq('user_id', user_id);

    // Log failed attempt
    await supabase.from('admin_login_attempts').insert({
      email: email || '',
      user_id,
      is_successful: false,
      attempt_type: 'totp',
    });

    if (newAttempts >= 3) {
      return {
        success: false,
        locked: true,
        error: 'Account locked for 6 hours due to failed attempts',
      };
    }

    return {
      success: false,
      remaining_attempts: 3 - newAttempts,
      error: `Invalid code. ${3 - newAttempts} attempts remaining.`,
    };
  }

  // Success - reset failed attempts
  await supabase
    .from('admin_totp_secrets')
    .update({ failed_attempts: 0, locked_until: null })
    .eq('user_id', user_id);

  // Log successful 2FA
  await supabase.from('admin_login_attempts').insert({
    email: email || '',
    user_id,
    is_successful: true,
    attempt_type: 'totp',
  });

  // Create session if email/password provided
  if (email && password) {
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return { success: false, error: 'Failed to create session' };
    }

    return {
      success: true,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    };
  }

  return { success: true };
}
