import { NextResponse } from 'next/server';
import { validateAlertsApiKey } from '@/lib/auth';
import { validateWebhookUrl } from '@/lib/url-validation';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Type Definitions ─────────────────────────────────────────────────────────

const VALID_ACTIONS = ['create', 'delete', 'list', 'process', 'test'] as const;
type AlertAction = typeof VALID_ACTIONS[number];

const VALID_ALERT_TYPES = ['keyword', 'severity', 'region', 'flight'] as const;
type AlertType = typeof VALID_ALERT_TYPES[number];

const VALID_CHANNELS = ['telegram', 'webhook', 'email'] as const;
type AlertChannel = typeof VALID_CHANNELS[number];

interface AlertConfig {
  id: string;
  userId: string;
  type: AlertType;
  value: string;
  channel: AlertChannel;
  destination: string; // resolved destination (validated)
  enabled: boolean;
  created: number;
  lastTriggered?: number;
}

interface SignalInput {
  title: string;
  severity: string;
  source?: string;
  category?: string;
  region?: string;
  callsign?: string;
  summary?: string;
  sourceUrl?: string;
  timeAgo?: string;
  id?: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

// In-memory storage (replace with Redis/PostgreSQL in production)
const alerts: Map<string, AlertConfig> = new Map();
const triggeredAlerts: Map<string, number> = new Map(); // Alert ID -> last trigger time

// Per-client test cooldown tracking
const testCooldowns: Map<string, number> = new Map();
const TEST_COOLDOWN_MS = 30 * 1000; // 30 seconds between test operations per client

// Rate limiting: Don't send same alert more than once per 5 minutes
const ALERT_COOLDOWN = 5 * 60 * 1000;

// ─── Telegram Configuration ───────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Returns the set of allowed Telegram chat IDs from server-side environment.
 * Never expose this list to clients unnecessarily.
 */
function getAllowedTelegramChatIds(): Set<string> {
  const raw = process.env.ALLOWED_TELEGRAM_CHAT_IDS || '';
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && /^\d+$/.test(id));
  return new Set(ids);
}

/**
 * Validates that a Telegram chat ID is on the server-side allowlist.
 */
function isAllowedTelegramDestination(chatId: string): boolean {
  const allowed = getAllowedTelegramChatIds();
  return allowed.has(chatId.trim());
}

// ─── Critical Keywords ────────────────────────────────────────────────────────

const CRITICAL_KEYWORDS = [
  'nuclear strike', 'nuclear attack', 'missile launch', 'icbm',
  'declaration of war', 'state of emergency', 'martial law',
  'invasion', 'ground troops', 'full scale', 'ww3', 'world war',
  'chemical weapon', 'biological weapon', 'emp', 'cyber attack',
  'oil embargo', 'strait of hormuz closed', 'suez blocked',
  'assassination', 'coup', 'revolution',
];

// ─── Alert Matching ───────────────────────────────────────────────────────────

function matchesAlert(alert: AlertConfig, signal: SignalInput): boolean {
  const text = `${signal.title} ${signal.summary || ''}`.toLowerCase();

  switch (alert.type) {
    case 'keyword':
      return text.includes(alert.value.toLowerCase());
    case 'severity':
      return signal.severity === alert.value;
    case 'region':
      return signal.region?.toLowerCase() === alert.value.toLowerCase() ||
             text.includes(alert.value.toLowerCase());
    case 'flight':
      return signal.callsign?.toUpperCase().startsWith(alert.value.toUpperCase()) || false;
    default:
      return false;
  }
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram not configured, skipping send');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

// ─── Webhook (SSRF-Protected) ─────────────────────────────────────────────────

/**
 * Sends a webhook payload to a validated URL.
 * URL must pass SSRF validation before the request is made.
 * Response body is never returned to the caller.
 * Redirects are blocked (redirect: 'manual').
 * Request has a 5-second timeout.
 */
async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<boolean> {
  // Validate URL against SSRF blocklist (includes DNS resolution)
  const validation = await validateWebhookUrl(url);
  if (!validation.valid) {
    console.error(`Webhook URL rejected: ${validation.error}`);
    return false;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'manual', // Do not follow redirects — prevents redirect-based SSRF bypass
      signal: AbortSignal.timeout(5000),
    });

    // If we get a redirect response, block it
    if (response.status >= 300 && response.status < 400) {
      console.error('Webhook redirect blocked');
      return false;
    }

    // Consume and discard response body to prevent leaking it to the caller
    // The ok status is the only information we return
    const success = response.ok;

    // Drain the body to release resources but don't use the content
    try {
      await response.text();
    } catch {
      // Ignore body read errors
    }

    return success;
  } catch (error) {
    console.error('Webhook send error:', error);
    return false;
  }
}

// ─── Alert Message Formatting ─────────────────────────────────────────────────

function formatAlertMessage(signal: SignalInput, alertType: string): string {
  const severityEmoji: Record<string, string> = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🟢',
    INFO: 'ℹ️',
  };

  const emoji = severityEmoji[signal.severity] || '📰';

  return `${emoji} <b>${signal.severity} ALERT</b>

<b>${signal.title}</b>

📍 Source: ${signal.source || 'Unknown'}
🏷️ Category: ${signal.category || 'General'}
⏰ ${signal.timeAgo || 'Unknown'}

${signal.summary ? `\n${signal.summary.substring(0, 200)}...` : ''}

${signal.sourceUrl ? `\n🔗 <a href="${signal.sourceUrl}">Read more</a>` : ''}

---
Alert type: ${alertType}
🌐 <a href="https://globenews.live">GlobeNews Live</a>`;
}

// ─── Input Validation Helpers ─────────────────────────────────────────────────

function isValidAction(action: unknown): action is AlertAction {
  return typeof action === 'string' && (VALID_ACTIONS as readonly string[]).includes(action);
}

function isValidAlertType(type: unknown): type is AlertType {
  return typeof type === 'string' && (VALID_ALERT_TYPES as readonly string[]).includes(type);
}

function isValidChannel(channel: unknown): channel is AlertChannel {
  return typeof channel === 'string' && (VALID_CHANNELS as readonly string[]).includes(channel);
}

function isValidSignal(signal: unknown): signal is SignalInput {
  if (typeof signal !== 'object' || signal === null) return false;
  const s = signal as Record<string, unknown>;
  if (typeof s.title !== 'string' || s.title.length === 0) return false;
  if (typeof s.severity !== 'string' || s.severity.length === 0) return false;
  return true;
}

/**
 * Validates a destination for the given channel.
 * For Telegram: must be on the server-side allowlist.
 * For webhook: must pass SSRF validation (async, done at send time).
 * For email: basic format check.
 */
function validateDestinationSync(destination: unknown, channel: AlertChannel): string | null {
  if (typeof destination !== 'string' || destination.trim().length === 0) {
    return 'Destination is required';
  }

  const trimmed = destination.trim();

  switch (channel) {
    case 'telegram': {
      // Must be a numeric chat ID on the allowlist
      if (!/^\d+$/.test(trimmed)) {
        return 'Invalid Telegram chat ID format';
      }
      if (!isAllowedTelegramDestination(trimmed)) {
        return 'Telegram destination is not in the allowed list';
      }
      return null;
    }
    case 'webhook': {
      // Basic URL format check (full SSRF validation is async, done at send time)
      try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:') {
          return 'Only HTTPS webhooks are allowed';
        }
        if (url.username || url.password) {
          return 'URLs with credentials are not allowed';
        }
      } catch {
        return 'Invalid webhook URL';
      }
      return null;
    }
    case 'email': {
      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return 'Invalid email format';
      }
      return null;
    }
    default:
      return 'Unsupported channel';
  }
}

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';
  return ip;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Rate limiting — before any processing
  const rateLimitResponse = applyRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // 2. Authentication
  const authResult = validateAlertsApiKey(request);
  if (!authResult.valid) {
    return authResult.response;
  }

  // 3. Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  // 4. Validate action
  const { action, ...data } = body;
  if (!isValidAction(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 }
    );
  }

  switch (action) {
    case 'create': {
      // Validate required fields
      if (!isValidAlertType(data.type)) {
        return NextResponse.json(
          { error: `Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const channel: AlertChannel = isValidChannel(data.channel) ? data.channel : 'telegram';

      if (typeof data.value !== 'string' || data.value.trim().length === 0) {
        return NextResponse.json({ error: 'Alert value is required' }, { status: 400 });
      }

      if (data.value.length > 200) {
        return NextResponse.json({ error: 'Alert value exceeds maximum length (200)' }, { status: 400 });
      }

      // Validate destination for channel
      const destError = validateDestinationSync(data.destination, channel);
      if (destError) {
        return NextResponse.json({ error: destError }, { status: 400 });
      }

      // For webhook destinations, perform full async SSRF validation at create time
      if (channel === 'webhook') {
        const ssrfCheck = await validateWebhookUrl(String(data.destination).trim());
        if (!ssrfCheck.valid) {
          return NextResponse.json({ error: ssrfCheck.error || 'Invalid webhook URL' }, { status: 400 });
        }
      }

      const alert: AlertConfig = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: typeof data.userId === 'string' ? data.userId : 'anonymous',
        type: data.type,
        value: String(data.value).trim(),
        channel: channel,
        destination: String(data.destination).trim(),
        enabled: true,
        created: Date.now(),
      };
      alerts.set(alert.id, alert);

      // Return alert without exposing destination details unnecessarily
      return NextResponse.json({
        success: true,
        alert: {
          id: alert.id,
          type: alert.type,
          value: alert.value,
          channel: alert.channel,
          enabled: alert.enabled,
          created: alert.created,
        },
      });
    }

    case 'delete': {
      if (typeof data.id !== 'string' || data.id.trim().length === 0) {
        return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
      }
      alerts.delete(data.id.trim());
      return NextResponse.json({ success: true });
    }

    case 'list': {
      const userId = typeof data.userId === 'string' ? data.userId : undefined;
      const userAlerts = Array.from(alerts.values())
        .filter((a) => !userId || a.userId === userId)
        .map((a) => ({
          id: a.id,
          type: a.type,
          value: a.value,
          channel: a.channel,
          enabled: a.enabled,
          created: a.created,
          lastTriggered: a.lastTriggered,
        }));
      return NextResponse.json({ alerts: userAlerts });
    }

    case 'process': {
      // Validate signals array
      if (!Array.isArray(data.signals)) {
        return NextResponse.json(
          { error: 'Signals must be an array' },
          { status: 400 }
        );
      }

      if (data.signals.length > 100) {
        return NextResponse.json(
          { error: 'Too many signals (max 100)' },
          { status: 400 }
        );
      }

      // Validate each signal
      const validSignals: SignalInput[] = [];
      for (const signal of data.signals) {
        if (!isValidSignal(signal)) {
          return NextResponse.json(
            { error: 'Each signal must have a title (string) and severity (string)' },
            { status: 400 }
          );
        }
        validSignals.push(signal);
      }

      const triggered: string[] = [];

      for (const signal of validSignals) {
        // Check for critical keywords
        const text = `${signal.title} ${signal.summary || ''}`.toLowerCase();
        const hasCriticalKeyword = CRITICAL_KEYWORDS.some((kw) => text.includes(kw));

        for (const alert of Array.from(alerts.values())) {
          if (!alert.enabled) continue;

          // Check cooldown
          const lastTrigger = triggeredAlerts.get(alert.id) || 0;
          if (Date.now() - lastTrigger < ALERT_COOLDOWN) continue;

          // Check if matches
          const matches = matchesAlert(alert, signal) ||
            (hasCriticalKeyword && alert.type === 'severity' && alert.value === 'CRITICAL');

          if (matches) {
            const message = formatAlertMessage(signal, `${alert.type}: ${alert.value}`);

            let sent = false;
            if (alert.channel === 'telegram') {
              sent = await sendTelegram(alert.destination, message);
            } else if (alert.channel === 'webhook') {
              sent = await sendWebhook(alert.destination, {
                alert: alert,
                signal: signal,
                message: message,
              });
            }

            if (sent) {
              triggeredAlerts.set(alert.id, Date.now());
              triggered.push(alert.id);
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        processed: validSignals.length,
        triggered: triggered.length,
      });
    }

    case 'test': {
      // Validate channel
      if (!isValidChannel(data.channel)) {
        return NextResponse.json(
          { error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` },
          { status: 400 }
        );
      }

      // Per-client test cooldown (separate from rate limiter)
      const clientId = getClientId(request);
      const lastTest = testCooldowns.get(clientId) || 0;
      if (Date.now() - lastTest < TEST_COOLDOWN_MS) {
        const retryAfter = Math.ceil((TEST_COOLDOWN_MS - (Date.now() - lastTest)) / 1000);
        return NextResponse.json(
          { error: `Test cooldown active. Try again in ${retryAfter} seconds.` },
          { status: 429 }
        );
      }

      // Validate destination
      const testDestError = validateDestinationSync(data.destination, data.channel);
      if (testDestError) {
        return NextResponse.json({ error: testDestError }, { status: 400 });
      }

      const testSignal: SignalInput = {
        title: '🧪 Test Alert from GlobeNews Live',
        severity: 'HIGH',
        source: 'System',
        category: 'test',
        timeAgo: 'just now',
        summary: 'This is a test alert to verify your notification settings are working correctly.',
        sourceUrl: 'https://globenews.live',
      };

      const message = formatAlertMessage(testSignal, 'test');

      let sent = false;
      if (data.channel === 'telegram') {
        sent = await sendTelegram(String(data.destination).trim(), message);
      } else if (data.channel === 'webhook') {
        // Full SSRF validation for webhook
        const ssrfCheck = await validateWebhookUrl(String(data.destination).trim());
        if (!ssrfCheck.valid) {
          return NextResponse.json({ error: ssrfCheck.error || 'Invalid webhook URL' }, { status: 400 });
        }
        sent = await sendWebhook(String(data.destination).trim(), { test: true, message });
      }

      // Record test cooldown
      testCooldowns.set(clientId, Date.now());

      return NextResponse.json({
        success: sent,
        message: sent ? 'Test alert sent!' : 'Failed to send test alert',
      });
    }

    default:
      // This should be unreachable due to isValidAction check above
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

/**
 * Returns minimal operational information about the alerts system.
 * Requires authentication.
 * Does NOT expose:
 * - API usage documentation
 * - Telegram configuration status
 * - Subscriber IDs
 * - Internal implementation details
 */
export async function GET(request: Request) {
  // Rate limiting
  const rateLimitResponse = applyRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Authentication
  const authResult = validateAlertsApiKey(request);
  if (!authResult.valid) {
    return authResult.response;
  }

  return NextResponse.json({
    totalAlerts: alerts.size,
    activeAlerts: Array.from(alerts.values()).filter((a) => a.enabled).length,
  });
}
