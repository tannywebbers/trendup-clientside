/**
 * Paystack Payment Handler - Universal Business Logic
 */

import { getEnv, requireEnv } from '../runtime';
import { createServiceClient } from '../supabase';
import type { PaystackInitializeRequest, PaystackInitializeResponse } from '../types';

/**
 * Initialize Paystack payment
 */
export async function handlePaystackInitialize(
  body: PaystackInitializeRequest
): Promise<PaystackInitializeResponse> {
  const PAYSTACK_SECRET_KEY = getEnv('PAYSTACK_SECRET_KEY');
  const APP_URL = getEnv('APP_URL') || 'http://localhost:5173';
  const SUPABASE_URL = requireEnv('SUPABASE_URL');

  if (!PAYSTACK_SECRET_KEY) {
    console.error('PAYSTACK_SECRET_KEY not configured');
    return { authorization_url: '', access_code: '', reference: '', error: 'Paystack not configured' };
  }

  const { email, amount, points, userId } = body;

  console.log('Initializing payment:', { email, amount, points, userId });

  if (!email || !amount || !points || !userId) {
    return { authorization_url: '', access_code: '', reference: '', error: 'Missing required fields' };
  }

  const callbackUrl = `${SUPABASE_URL}/functions/v1/paystack-verify`;

  console.log('Callback URL:', callbackUrl);

  // Initialize Paystack transaction
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount, // in kobo
      callback_url: callbackUrl,
      metadata: {
        user_id: userId,
        points: points.toString(),
        custom_fields: [
          {
            display_name: 'Streak Points',
            variable_name: 'tikpoints',
            value: points.toString(),
          },
        ],
      },
    }),
  });

  const paystackData = await paystackResponse.json();

  console.log('Paystack response:', paystackData);

  if (!paystackData.status) {
    console.error('Paystack error:', paystackData);
    return {
      authorization_url: '',
      access_code: '',
      reference: '',
      error: paystackData.message || 'Payment initialization failed',
    };
  }

  return {
    authorization_url: paystackData.data.authorization_url,
    access_code: paystackData.data.access_code,
    reference: paystackData.data.reference,
  };
}

/**
 * Verify Paystack payment (called from callback)
 */
export async function handlePaystackVerify(reference: string): Promise<{
  success: boolean;
  redirectUrl: string;
}> {
  const PAYSTACK_SECRET_KEY = getEnv('PAYSTACK_SECRET_KEY');
  const APP_URL = getEnv('APP_URL') || 'http://localhost:5173';

  if (!PAYSTACK_SECRET_KEY) {
    console.error('Missing PAYSTACK_SECRET_KEY');
    return { success: false, redirectUrl: `${APP_URL}/dashboard/wallet?payment=error&reason=config` };
  }

  if (!reference) {
    console.error('No reference provided');
    return { success: false, redirectUrl: `${APP_URL}/dashboard/wallet?payment=error&reason=no_reference` };
  }

  const supabase = await createServiceClient();

  // Verify transaction with Paystack
  console.log('Verifying with Paystack...');
  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const verifyData = await verifyResponse.json();
  console.log('Paystack verification response:', JSON.stringify(verifyData, null, 2));

  if (!verifyData.status || verifyData.data.status !== 'success') {
    console.error('Payment verification failed:', verifyData);
    return { success: false, redirectUrl: `${APP_URL}/dashboard/wallet?payment=failed&reason=not_successful` };
  }

  const { user_id, points } = verifyData.data.metadata;
  const amountPaid = verifyData.data.amount / 100; // Convert from kobo to naira

  console.log('Payment details:', { user_id, points, amountPaid });

  if (!user_id || !points) {
    console.error('Missing metadata:', verifyData.data.metadata);
    return { success: false, redirectUrl: `${APP_URL}/dashboard/wallet?payment=error&reason=missing_metadata` };
  }

  const pointsToAdd = parseInt(points);
  if (!Number.isFinite(pointsToAdd) || pointsToAdd <= 0) {
    console.error('Invalid points:', points);
    return { success: false, redirectUrl: `${APP_URL}/dashboard/wallet?payment=error&reason=invalid_points` };
  }

  // Credit points using RPC function
  const { data: creditResult, error: creditError } = await supabase.rpc('credit_purchase_points', {
    _user_id: user_id,
    _points: pointsToAdd,
    _amount_paid: amountPaid,
    _reference: reference,
  });

  if (creditError) {
    console.error('Error crediting purchase points:', creditError);
    return { success: false, redirectUrl: `${APP_URL}/dashboard/wallet?payment=error&reason=credit_failed` };
  }

  const alreadyProcessed = Boolean((creditResult as any)?.already_processed);
  console.log('credit_purchase_points result:', creditResult);

  return {
    success: true,
    redirectUrl: `${APP_URL}/dashboard/wallet?payment=success&points=${pointsToAdd}&already_processed=${alreadyProcessed}`,
  };
}

/**
 * Handle Paystack webhook
 */
export async function handlePaystackWebhook(
  body: string,
  signature: string | null
): Promise<{ success: boolean; message: string }> {
  const PAYSTACK_SECRET_KEY = getEnv('PAYSTACK_SECRET_KEY');

  if (!PAYSTACK_SECRET_KEY) {
    return { success: false, message: 'Server not configured' };
  }

  // Verify webhook signature
  if (signature) {
    // Create HMAC-SHA512 hash
    const encoder = new TextEncoder();
    const keyData = encoder.encode(PAYSTACK_SECRET_KEY);
    const messageData = encoder.encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hash = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hash !== signature) {
      console.error('Invalid webhook signature');
      return { success: false, message: 'Invalid signature' };
    }

    console.log('Signature verified successfully');
  }

  const event = JSON.parse(body);
  console.log('Webhook event:', event.event);

  // Only process successful charges
  if (event.event !== 'charge.success') {
    console.log('Ignoring event:', event.event);
    return { success: true, message: 'Event ignored' };
  }

  const data = event.data;
  const { user_id, points } = data.metadata || {};
  const reference = data.reference;
  const amountPaid = data.amount / 100;

  console.log('Processing payment:', { user_id, points, reference, amountPaid });

  if (!user_id || !points || !reference) {
    console.error('Missing required metadata:', data.metadata);
    return { success: false, message: 'Missing metadata' };
  }

  const supabase = await createServiceClient();

  const pointsToAdd = parseInt(points);
  if (!Number.isFinite(pointsToAdd) || pointsToAdd <= 0) {
    console.error('Invalid points:', points);
    return { success: false, message: 'Invalid points' };
  }

  const { error: creditError } = await supabase.rpc('credit_purchase_points', {
    _user_id: user_id,
    _points: pointsToAdd,
    _amount_paid: amountPaid,
    _reference: reference,
  });

  if (creditError) {
    console.error('Error crediting purchase points:', creditError);
    return { success: false, message: 'Failed to process purchase' };
  }

  console.log('Webhook processed successfully!');
  return { success: true, message: 'Payment processed' };
}
