import { NextResponse } from 'next/server';

// Alert configuration storage (in production, use a database)
interface AlertConfig {
  id: string;
  userId: string;
  type: 'keyword' | 'severity' | 'region' | 'flight';
  value: string;
  channel: 'telegram' | 'webhook' | 'email';
  destination: string; // chat_id, webhook URL, or email
  enabled: boolean;
  created: number;
  lastTriggered?: number;
}

// In-memory storage (replace with Redis/PostgreSQL in production)
const alerts: Map<string, AlertConfig> = new Map();
const triggeredAlerts: Map<string, number> = new Map(); // Alert ID -> last trigger time

// Rate limiting: Don't send same alert more than once per 5 minutes
const ALERT_COOLDOWN = 5 * 60 * 1000;

// Telegram bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Keywords that trigger immediate alerts
const CRITICAL_KEYWORDS = [
  'nuclear strike', 'nuclear attack', 'missile launch', 'icbm',
  'declaration of war', 'state of emergency', 'martial law',
  'invasion', 'ground troops', 'full scale', 'ww3', 'world war',
  'chemical weapon', 'biological weapon', 'emp', 'cyber attack',
  'oil embargo', 'strait of hormuz closed', 'suez blocked',
  'assassination', 'coup', 'revolution',
];

interface AlertSignal {
  title: string;
  summary?: string | null;
  severity: string;
  source: string;
  category: string;
  timeAgo: string;
  sourceUrl?: string | null;
  region?: string | null;
  callsign?: string | null;
}

// Check if text matches alert criteria
function matchesAlert(alert: AlertConfig, signal: AlertSignal): boolean {
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
      return !!(signal.callsign?.toUpperCase().startsWith(alert.value.toUpperCase()));
    default:
      return false;
  }
}

// Send Telegram message
async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram not configured, would send:', message);
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
    });
    return response.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

interface WebhookPayload {
  alert?: AlertConfig;
  signal?: AlertSignal;
  message: string;
  test?: boolean;
}

// Send webhook
async function sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error('Webhook send error:', error);
    return false;
  }
}

// Format alert message
function formatAlertMessage(signal: AlertSignal, alertType: string): string {
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

📍 Source: ${signal.source}
🏷️ Category: ${signal.category}
⏰ ${signal.timeAgo}

${signal.summary ? `\n${signal.summary.substring(0, 200)}...` : ''}

${signal.sourceUrl ? `\n🔗 <a href="${signal.sourceUrl}">Read more</a>` : ''}

---
Alert type: ${alertType}
🌐 <a href="https://globenews.live">GlobeNews Live</a>`;
}

// Process signals and trigger alerts
export async function POST(request: Request) {
  try {
    const { action, ...data } = await request.json();
    
    switch (action) {
      case 'create': {
        // Create new alert
        const alert: AlertConfig = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: data.userId || 'anonymous',
          type: data.type,
          value: data.value,
          channel: data.channel || 'telegram',
          destination: data.destination,
          enabled: true,
          created: Date.now(),
        };
        alerts.set(alert.id, alert);
        return NextResponse.json({ success: true, alert });
      }
      
      case 'delete': {
        alerts.delete(data.id);
        return NextResponse.json({ success: true });
      }
      
      case 'list': {
        const userAlerts = Array.from(alerts.values())
          .filter(a => !data.userId || a.userId === data.userId);
        return NextResponse.json({ alerts: userAlerts });
      }
      
      case 'process': {
        // Process signals and trigger matching alerts
        const signals = data.signals || [];
        const triggered: string[] = [];
        
        for (const signal of signals) {
          // Check for critical keywords first
          const text = `${signal.title} ${signal.summary || ''}`.toLowerCase();
          const hasCriticalKeyword = CRITICAL_KEYWORDS.some(kw => text.includes(kw));
          
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
          processed: signals.length,
          triggered: triggered.length,
          triggeredAlerts: triggered,
        });
      }
      
      case 'test': {
        // Send a test alert
        const testSignal = {
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
          sent = await sendTelegram(data.destination, message);
        } else if (data.channel === 'webhook') {
          sent = await sendWebhook(data.destination, { test: true, message });
        }
        
        return NextResponse.json({ success: sent, message: sent ? 'Test alert sent!' : 'Failed to send' });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Alert API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Get alert statistics
export async function GET() {
  return NextResponse.json({
    totalAlerts: alerts.size,
    activeAlerts: Array.from(alerts.values()).filter(a => a.enabled).length,
    criticalKeywords: CRITICAL_KEYWORDS.length,
    cooldownMinutes: ALERT_COOLDOWN / 60000,
    telegramConfigured: !!TELEGRAM_BOT_TOKEN,
    usage: {
      createAlert: 'POST /api/alerts { action: "create", type: "keyword|severity|region|flight", value: "...", channel: "telegram|webhook", destination: "..." }',
      listAlerts: 'POST /api/alerts { action: "list", userId?: "..." }',
      deleteAlert: 'POST /api/alerts { action: "delete", id: "..." }',
      processSignals: 'POST /api/alerts { action: "process", signals: [...] }',
      testAlert: 'POST /api/alerts { action: "test", channel: "telegram", destination: "123456789" }',
    },
  });
}
