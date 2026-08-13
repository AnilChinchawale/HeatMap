import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Validates the Authorization: Bearer <key> header against the server-side ALERTS_API_KEY.
 * Uses timing-safe comparison to prevent timing attacks.
 * Fails closed: if ALERTS_API_KEY is not configured, all requests are rejected.
 *
 * IMPORTANT: ALERTS_API_KEY must NOT be prefixed with NEXT_PUBLIC_ — it is server-side only.
 */
export function validateAlertsApiKey(request: Request): {
  valid: boolean;
  response?: NextResponse;
} {
  const configuredKey = process.env.ALERTS_API_KEY;

  // Fail closed: if no API key is configured, reject all requests
  if (!configuredKey || configuredKey.length === 0) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Service not configured' },
        { status: 503 }
      ),
    };
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  // Extract Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid authorization format' },
        { status: 401 }
      ),
    };
  }

  const providedKey = parts[1];

  if (!providedKey || providedKey.length === 0) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  // Timing-safe comparison
  // Both buffers must be the same length for timingSafeEqual.
  // If lengths differ, we still perform a comparison against a dummy
  // to avoid leaking length information via timing.
  const providedBuffer = Buffer.from(providedKey, 'utf-8');
  const configuredBuffer = Buffer.from(configuredKey, 'utf-8');

  let isValid: boolean;
  if (providedBuffer.length !== configuredBuffer.length) {
    // Compare against configured key with itself to maintain constant-time behavior,
    // but always return false
    timingSafeEqual(configuredBuffer, configuredBuffer);
    isValid = false;
  } else {
    isValid = timingSafeEqual(providedBuffer, configuredBuffer);
  }

  if (!isValid) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid API key' },
        { status: 403 }
      ),
    };
  }

  return { valid: true };
}
