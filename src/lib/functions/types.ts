/**
 * Shared Types for Universal Functions
 * 
 * These types are used across all platforms and can be imported
 * by both the frontend and backend.
 */

// ============ Authentication Types ============

export interface AdminLoginRequest {
  email: string;
  password: string;
  action?: 'check_user_role' | 'login';
}

export interface AdminLoginResponse {
  success: boolean;
  isAdmin?: boolean;
  requires2FA?: boolean;
  userId?: string;
  session?: {
    access_token: string;
    refresh_token: string;
  };
  error?: string;
}

export interface TOTPVerifyRequest {
  user_id: string;
  token?: string;
  action?: 'check_lockout' | 'verify';
  email?: string;
  password?: string;
}

export interface TOTPVerifyResponse {
  success?: boolean;
  locked?: boolean;
  failed_attempts?: number;
  remaining_attempts?: number;
  locked_until?: string;
  session?: {
    access_token: string;
    refresh_token: string;
  };
  error?: string;
}

export interface TOTPSetupRequest {
  action: 'setup' | 'status';
}

export interface TOTPSetupResponse {
  success?: boolean;
  enabled?: boolean;
  setup?: boolean;
  secret?: string;
  otpauthUri?: string;
  backupCodes?: string[];
  error?: string;
}

// ============ Payment Types ============

export interface PaystackInitializeRequest {
  email: string;
  amount: number; // in kobo
  points: number;
  userId: string;
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  error?: string;
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    status: string;
    metadata?: {
      user_id: string;
      points: string;
    };
  };
}

// ============ Email Types ============

export interface SendVerificationEmailRequest {
  email: string;
  type: 'code' | 'link';
}

export interface SendVerificationEmailResponse {
  success: boolean;
  message?: string;
  type?: string;
  expiresIn?: number;
  error?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string; // Brevo API key
  from_email: string;
  from_name: string;
}

export interface TestSMTPRequest {
  to: string;
  smtpConfig: SMTPConfig;
}

// ============ Verification Types ============

export interface VerifyScreenshotRequest {
  action?: 'generate_comment';
  adId: string;
  userId: string;
  taskType?: string;
  tiktokName?: string;
  tiktokUsername?: string;
  screenshots?: string[];
  expectedComment?: string;
  advertiserDisplayName?: string;
}

export interface VerifyScreenshotResponse {
  approved?: boolean;
  verified?: boolean;
  needsReview?: boolean;
  status?: 'approved' | 'rejected' | 'needs_review';
  reason?: string;
  points?: number;
  confidence?: number;
  comment?: string;
  error?: string;
}

export interface VerifyFollowRequest {
  action: 'verify_follow_screenshot' | 'verify_follow_scrape';
  adId: string;
  userId: string;
  advertiserUsername: string;
  performerUsername: string;
  screenshot?: string;
}

export interface VerifyFollowResponse {
  verified: boolean;
  needsReview?: boolean;
  points?: number;
  confidence?: number;
  reason?: string;
  message?: string;
  error?: string;
}

// ============ Moderator Types ============

export interface CreateModeratorRequest {
  email: string;
  password: string;
  pages?: string[];
  invited_by?: string;
}

export interface CreateModeratorResponse {
  success: boolean;
  user_id?: string;
  error?: string;
}

// ============ AI Types ============

export interface AIAnalysisResult {
  status: 'approved' | 'rejected' | 'manual_review';
  confidence_score: number;
  failed_reason: string | null;
  detected_actions: {
    liked: boolean;
    saved: boolean;
    commented: boolean;
    followed: boolean;
  };
  advertiser_name_found?: boolean;
  fraud_indicators?: string[];
}
