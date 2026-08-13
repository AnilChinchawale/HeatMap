import { NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limit: 100 requests per minute
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100
};

// Stricter limits for specific endpoints
const ENDPOINT_CONFIGS: Record<string, RateLimitConfig> = {
  '/api/signals': { windowMs: 30 * 1000, maxRequests: 60 },      // 60 per 30s
  '/api/push/subscribe': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  '/api/push/unsubscribe': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/markets': { windowMs: 60 * 1000, maxRequests: 120 },
  '/api/predictions': { windowMs: 60 * 1000, maxRequests: 60 },
  '/api/alerts': { windowMs: 60 * 1000, maxRequests: 20 },        // 20 per minute — conservative for admin operations
};

/**
 * Get client identifier from request
 * Uses IP address or a combination of IP + User-Agent fingerprint
 */
function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Create a simple fingerprint from IP + User-Agent hash
  const userAgent = request.headers.get('user-agent') || '';
  const fingerprint = `${ip}:${userAgent.slice(0, 50)}`;
  
  return fingerprint;
}

/**
 * Get endpoint-specific rate limit config
 */
function getConfigForEndpoint(pathname: string): RateLimitConfig {
  for (const [endpoint, config] of Object.entries(ENDPOINT_CONFIGS)) {
    if (pathname.startsWith(endpoint)) {
      return config;
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * Check if request is within rate limit
 * Returns { allowed, remaining, resetTime, limit }
 */
export function checkRateLimit(
  request: Request
): { allowed: boolean; remaining: number; resetTime: number; limit: number; retryAfter?: number } {
  const pathname = new URL(request.url).pathname;
  const config = getConfigForEndpoint(pathname);
  const clientId = getClientIdentifier(request);
  const now = Date.now();
  
  const key = `${pathname}:${clientId}`;
  const entry = rateLimitStore.get(key);
  
  // Clean up expired entries periodically (simple approach)
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(key);
  }
  
  // Get or create entry
  let currentEntry = rateLimitStore.get(key);
  if (!currentEntry || now > currentEntry.resetTime) {
    currentEntry = {
      count: 0,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, currentEntry);
  }
  
  // Check if limit exceeded
  if (currentEntry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((currentEntry.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: currentEntry.resetTime,
      limit: config.maxRequests,
      retryAfter
    };
  }
  
  // Increment count
  currentEntry.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - currentEntry.count,
    resetTime: currentEntry.resetTime,
    limit: config.maxRequests
  };
}

/**
 * Apply rate limiting to a request
 * Returns NextResponse if rate limited, null if allowed
 */
export function applyRateLimit(request: Request): NextResponse | null {
  const result = checkRateLimit(request);
  
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
        limit: result.limit,
        windowMs: getConfigForEndpoint(new URL(request.url).pathname).windowMs
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
          'Retry-After': String(result.retryAfter)
        }
      }
    );
  }
  
  return null;
}

/**
 * Get rate limit headers for successful requests
 */
export function getRateLimitHeaders(request: Request): Record<string, string> {
  const result = checkRateLimit(request);
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000))
  };
}

/**
 * Middleware wrapper for API routes
 * Usage: export const GET = withRateLimit(async (request) => { ... })
 */
export function withRateLimit(
  handler: (request: Request) => Promise<NextResponse>
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    // Check rate limit first
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Call the handler
    const response = await handler(request);
    
    // Add rate limit headers to successful response
    const headers = getRateLimitHeaders(request);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  };
}

/**
 * Get current rate limit status for a client
 */
export function getRateLimitStatus(request: Request): {
  limit: number;
  remaining: number;
  resetTime: number;
  windowMs: number;
} {
  const pathname = new URL(request.url).pathname;
  const config = getConfigForEndpoint(pathname);
  const result = checkRateLimit(request);
  
  return {
    limit: result.limit,
    remaining: result.remaining,
    resetTime: result.resetTime,
    windowMs: config.windowMs
  };
}