import { resolve4, resolve6 } from 'dns/promises';

/**
 * Allowed ports for webhook URLs.
 * Only standard HTTPS port and common webhook ports.
 */
const ALLOWED_PORTS = new Set([443, 8443]);

/**
 * Checks if an IP address is in a blocked range (private, loopback, link-local, metadata).
 */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Invalid IPv4 → block
  }

  const [a, b, c, d] = parts;

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;

  // Private: 10.0.0.0/8
  if (a === 10) return true;

  // Private: 172.16.0.0/12
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;

  // Private: 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // Link-local: 169.254.0.0/16 (includes cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // Current network: 0.0.0.0/8
  if (a === 0) return true;

  // Broadcast: 255.255.255.255
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  // Shared address space: 100.64.0.0/10
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;

  // IETF Protocol Assignments: 192.0.0.0/24
  if (a === 192 && b === 0 && c === 0) return true;

  // Documentation: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;

  // Benchmarking: 198.18.0.0/15
  if (a === 198 && b !== undefined && (b === 18 || b === 19)) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a blocked range.
 */
function isBlockedIPv6(ip: string): boolean {
  let normalized = ip.toLowerCase().trim();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }

  // Loopback: ::1
  if (normalized === '::1') return true;

  // Unspecified: ::
  if (normalized === '::') return true;

  // Unique local: fc00::/7 (fc00:: to fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local: fe80::/10
  if (normalized.startsWith('fe80')) return true;

  // IPv4-mapped IPv6: ::ffff:x.x.x.x
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    if (ipv4Part.includes('.')) {
      return isBlockedIPv4(ipv4Part);
    }
  }

  // IPv4-compatible IPv6: ::x.x.x.x (deprecated but possible)
  if (normalized.startsWith('::') && !normalized.startsWith('::ffff:')) {
    const remainder = normalized.slice(2);
    if (remainder.includes('.')) {
      return isBlockedIPv4(remainder);
    }
  }

  return false;
}

/**
 * Validates a hostname against common localhost aliases.
 */
function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Direct localhost
  if (lower === 'localhost') return true;

  // Localhost aliases
  if (lower === 'localhost.localdomain') return true;

  // Single-label hostnames (no dots) — often resolve to local
  // Only block known dangerous ones
  if (lower === 'wpad') return true;

  // Cloud metadata hostnames
  if (lower === 'metadata.google.internal') return true;
  if (lower === 'metadata.internal') return true;

  // Kubernetes internal
  if (lower.endsWith('.cluster.local')) return true;
  if (lower.endsWith('.svc.local')) return true;

  return false;
}

/**
 * Validates a webhook URL for SSRF protection.
 *
 * This function provides the strongest practical SSRF protection appropriate for
 * a server-side webhook feature:
 *
 * 1. Parses the URL using the URL constructor
 * 2. Restricts protocol to HTTPS only
 * 3. Rejects credentials in URLs
 * 4. Rejects blocked hostnames (localhost, etc.)
 * 5. Restricts to allowed ports
 * 6. Resolves the hostname via DNS and validates all resolved IPs
 * 7. Rejects private/loopback/link-local/metadata IPv4 and IPv6 addresses
 *
 * KNOWN LIMITATION — DNS Rebinding / TOCTOU:
 * DNS resolution and the subsequent fetch() are separate operations. A malicious
 * DNS server could return a safe IP during validation but a different (private) IP
 * when fetch() resolves the hostname again. This is an inherent TOCTOU limitation
 * of userspace SSRF protection in Node.js without custom DNS resolver hooks or
 * connect-time IP inspection. For complete protection against DNS rebinding,
 * a network-level firewall or proxy that inspects resolved addresses at connect
 * time would be required. This implementation provides the strongest practical
 * protection achievable at the application layer.
 */
export async function validateWebhookUrl(urlString: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  // 1. Parse URL
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }

  // 2. Protocol: HTTPS only
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS webhooks are allowed' };
  }

  // 3. Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with credentials are not allowed' };
  }

  // 4. Reject blocked hostnames
  if (isBlockedHostname(parsed.hostname)) {
    return { valid: false, error: 'Destination hostname is not allowed' };
  }

  // 5. Validate port
  const port = parsed.port ? parseInt(parsed.port, 10) : 443; // Default HTTPS port
  if (!ALLOWED_PORTS.has(port)) {
    return { valid: false, error: `Port ${port} is not allowed for webhooks` };
  }

  // 6. Check if hostname is a raw IP address
  const hostname = parsed.hostname;

  // Check for IPv6 literal in URL (brackets removed by URL parser)
  if (hostname.includes(':')) {
    // IPv6 address
    if (isBlockedIPv6(hostname)) {
      return { valid: false, error: 'Destination address is not allowed' };
    }
    // IPv6 literal is valid and not blocked
    return { valid: true };
  }

  // Check for IPv4 literal
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(hostname)) {
    if (isBlockedIPv4(hostname)) {
      return { valid: false, error: 'Destination address is not allowed' };
    }
    // Raw IPv4 that's not blocked
    return { valid: true };
  }

  // 7. DNS resolution — resolve hostname and validate all resolved IPs
  try {
    const [ipv4Results, ipv6Results] = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
    ]);

    const resolvedAddresses: string[] = [];

    if (ipv4Results.status === 'fulfilled') {
      resolvedAddresses.push(...ipv4Results.value);
    }
    if (ipv6Results.status === 'fulfilled') {
      resolvedAddresses.push(...ipv6Results.value);
    }

    if (resolvedAddresses.length === 0) {
      return { valid: false, error: 'Hostname could not be resolved' };
    }

    // Validate ALL resolved addresses — reject if any are blocked
    for (const addr of resolvedAddresses) {
      if (addr.includes(':')) {
        if (isBlockedIPv6(addr)) {
          return { valid: false, error: 'Resolved address is not allowed' };
        }
      } else {
        if (isBlockedIPv4(addr)) {
          return { valid: false, error: 'Resolved address is not allowed' };
        }
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'DNS resolution failed' };
  }
}
