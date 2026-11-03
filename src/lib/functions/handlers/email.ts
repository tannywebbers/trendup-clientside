/**
 * Email Handler - Universal Business Logic
 */

import { getEnv } from '../runtime';
import { createServiceClient } from '../supabase';
import type { SendVerificationEmailRequest, SendVerificationEmailResponse, SMTPConfig } from '../types';

/**
 * Send verification email
 */
export async function handleSendVerificationEmail(
  body: SendVerificationEmailRequest
): Promise<SendVerificationEmailResponse> {
  const supabase = await createServiceClient();

  const { email, type = 'code' } = body;

  if (!email) {
    return { success: false, error: 'Email is required' };
  }

  // Fetch SMTP config
  const { data: smtpConfig, error: smtpError } = await supabase
    .from('smtp_config')
    .select('*')
    .eq('is_enabled', true)
    .maybeSingle();

  if (smtpError || !smtpConfig) {
    console.error('SMTP config error:', smtpError);
    return { success: false, error: 'Email service not configured' };
  }

  // Fetch email verification settings
  const { data: verificationSettings } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'email_verification')
    .maybeSingle();

  const settings = (verificationSettings?.value as {
    code_expiry_minutes?: number;
    link_expiry_minutes?: number;
  }) || {};

  const expiryMinutes = type === 'code' ? settings.code_expiry_minutes || 10 : settings.link_expiry_minutes || 60;

  // Generate verification code or token
  const code =
    type === 'code'
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : crypto.randomUUID();

  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Store verification record
  const { error: insertError } = await supabase.from('email_verifications').insert({
    email,
    code,
    verification_type: type,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    console.error('Error storing verification:', insertError);
    return { success: false, error: 'Failed to create verification' };
  }

  // Build email content
  const appUrl = getEnv('APP_URL') || 'https://tikxaz.lovable.app';
  const verificationLink = `${appUrl}/verify?token=${code}&email=${encodeURIComponent(email)}`;

  let emailSubject: string;
  let emailHtml: string;

  if (type === 'code') {
    emailSubject = 'Your Verification Code';
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ec4899; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Verify Your Email</h2>
          <p>Enter this verification code to complete your registration:</p>
          <div class="code">${code}</div>
          <p>This code expires in ${expiryMinutes} minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TrendUp. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    emailSubject = 'Verify Your Email';
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ec4899, #06b6d4); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Verify Your Email</h2>
          <p>Click the button below to verify your email address:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" class="button">Verify Email</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          <p>This link expires in ${expiryMinutes} minutes.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} TrendUp. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send email via Brevo HTTP API
  const brevoApiKey = smtpConfig.smtp_password;

  if (!brevoApiKey) {
    return { success: false, error: 'Email API key not configured' };
  }

  const brevoPayload = {
    sender: {
      name: smtpConfig.from_name || 'TrendUp',
      email: smtpConfig.from_email,
    },
    to: [{ email }],
    subject: emailSubject,
    htmlContent: emailHtml,
  };

  console.log('Sending verification email to:', email);

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(brevoPayload),
  });

  if (!brevoResponse.ok) {
    const errorData = await brevoResponse.text();
    console.error('Brevo API error:', errorData);
    return { success: false, error: 'Failed to send email' };
  }

  console.log('Verification email sent successfully to:', email);

  return {
    success: true,
    message: 'Verification email sent',
    type,
    expiresIn: expiryMinutes,
  };
}

/**
 * Test SMTP configuration
 */
export async function handleTestSMTP(to: string, smtpConfig: SMTPConfig): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!to) {
    return { success: false, error: 'Email address is required' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return { success: false, error: 'Invalid email format' };
  }

  if (!smtpConfig?.password || !smtpConfig?.from_email) {
    return { success: false, error: 'Incomplete configuration' };
  }

  console.log(`Sending test email to: ${to}`);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 ${smtpConfig.from_name || 'TrendUp'}</h1>
        </div>
        <div class="content">
          <h2>✅ Email Configuration Working!</h2>
          <p>Your email configuration is set up correctly.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': smtpConfig.password,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: smtpConfig.from_name || 'TrendUp',
        email: smtpConfig.from_email,
      },
      to: [{ email: to }],
      subject: `${smtpConfig.from_name || 'TrendUp'} - Test Email`,
      htmlContent,
    }),
  });

  const brevoData = await brevoResponse.json();

  if (!brevoResponse.ok) {
    console.error('Brevo API error:', brevoData);
    return { success: false, error: brevoData.message || 'Failed to send email' };
  }

  console.log('Test email sent successfully');
  return { success: true, message: `Test email sent to ${to}` };
}
