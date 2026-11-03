/**
 * Admin Login Handler - Universal Business Logic
 * 
 * This handler contains the core logic for admin authentication
 * and can be used across any platform.
 */

import { getEnv } from '../runtime';
import { createServiceClient } from '../supabase';
import type { AdminLoginRequest, AdminLoginResponse } from '../types';

/**
 * Handle admin login - validates credentials and checks 2FA requirements
 */
export async function handleAdminLogin(body: AdminLoginRequest): Promise<AdminLoginResponse> {
  const { email, password, action } = body;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const supabase = await createServiceClient();

  // First, get user by email to check roles
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    // Log failed attempt
    await supabase.from('admin_login_attempts').insert({
      email,
      is_successful: false,
      attempt_type: 'password',
    });

    return { success: false, error: 'Invalid credentials' };
  }

  const userId = authData.user.id;

  // Check if user has admin or moderator role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const userRoles = roles?.map((r) => r.role) || [];
  const isAdminOrModerator = userRoles.includes('admin') || userRoles.includes('moderator');

  // Sign out immediately - we don't create session until 2FA is verified
  await supabase.auth.signOut();

  if (!isAdminOrModerator) {
    await supabase.from('admin_login_attempts').insert({
      email,
      user_id: userId,
      is_successful: false,
      attempt_type: 'unauthorized_role',
    });

    return { success: false, error: 'Unauthorized access' };
  }

  // If just checking role (for user panel blocking)
  if (action === 'check_user_role') {
    return {
      success: true,
      isAdmin: userRoles.includes('admin'),
    };
  }

  // Check if moderator is suspended
  if (userRoles.includes('moderator')) {
    const { data: modPerms } = await supabase
      .from('moderator_permissions')
      .select('is_suspended, suspend_reason')
      .eq('user_id', userId)
      .single();

    if (modPerms?.is_suspended) {
      return {
        success: false,
        error: `Account suspended: ${modPerms.suspend_reason || 'Contact administrator'}`,
      };
    }
  }

  // Check if 2FA is enabled
  const { data: totpData } = await supabase
    .from('admin_totp_secrets')
    .select('is_verified')
    .eq('user_id', userId)
    .single();

  const has2FA = totpData?.is_verified === true;

  // Log successful credential check
  await supabase.from('admin_login_attempts').insert({
    email,
    user_id: userId,
    is_successful: true,
    attempt_type: 'password',
  });

  if (has2FA) {
    // Requires 2FA - return userId for 2FA verification step
    return {
      success: true,
      requires2FA: true,
      userId,
    };
  }

  // No 2FA - create session directly
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError || !sessionData.session) {
    return { success: false, error: 'Failed to create session' };
  }

  return {
    success: true,
    requires2FA: false,
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    },
  };
}
