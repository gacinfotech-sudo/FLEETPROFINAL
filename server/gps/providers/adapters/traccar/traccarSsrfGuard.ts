// Outbound SSRF defense for tenant-supplied Traccar base URLs.
//
// GPS-PROVIDER-RESEARCH.md §4 (Standard Webhooks spec, adopted as the
// project's vendor-neutral security baseline) is explicit that this class of
// risk is "directly relevant" to any tenant-configurable provider base URL,
// not just inbound webhooks: "This applies to FleetPro's own outbound calls
// to a tenant-supplied ... GPS provider base URL". A self-hosted Traccar
// `apiBaseUrl` is exactly that — a Tenant Owner/Manager-supplied URL — so
// every outbound Traccar request is screened here first.
//
// Scope, honestly stated: this blocks literal private/loopback/link-local/
// metadata IPs and blocks the same ranges after a DNS lookup for hostnames.
// It does NOT pin the resolved IP for the lifetime of the TCP connection, so
// it does not fully close a DNS-rebinding race (resolve-then-connect can
// still observe a different IP than the one checked here). Full rebinding
// protection needs a custom dispatcher/agent that connects to the
// already-checked IP directly; that is a larger, cross-provider piece of
// infrastructure flagged as a follow-up in this task's report rather than
// built ad hoc inside one adapter.

import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

export class TraccarSsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`Traccar base URL is not permitted: ${reason}`);
    this.name = 'TraccarSsrfBlockedError';
  }
}

function ipv4Blocked(ip: string): string | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return null;
  const [a, b] = parts;
  if (a === 127) return 'loopback (127.0.0.0/8)';
  if (a === 10) return 'private (10.0.0.0/8)';
  if (a === 172 && b >= 16 && b <= 31) return 'private (172.16.0.0/12)';
  if (a === 192 && b === 168) return 'private (192.168.0.0/16)';
  if (a === 169 && b === 254) return 'link-local / cloud metadata (169.254.0.0/16)';
  if (a === 0) return 'unspecified (0.0.0.0/8)';
  if (a >= 224) return 'multicast/reserved';
  return null;
}

function ipv6Blocked(ip: string): string | null {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return 'loopback (::1)';
  if (normalized === '::') return 'unspecified (::)';
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return 'link-local (fe80::/10)';
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return 'unique local (fc00::/7)';
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — unwrap and re-check the IPv4 rules.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  return null;
}

function blockedReasonForIp(ip: string): string | null {
  const version = isIP(ip);
  if (version === 4) return ipv4Blocked(ip);
  if (version === 6) return ipv6Blocked(ip);
  return null;
}

/**
 * Throws TraccarSsrfBlockedError if `url`'s host is a literal private/
 * loopback/link-local/metadata IP, or resolves to one via DNS.
 */
export async function assertPublicTraccarUrl(url: URL): Promise<void> {
  const hostname = url.hostname;

  const literalReason = blockedReasonForIp(hostname);
  if (literalReason) throw new TraccarSsrfBlockedError(literalReason);

  if (hostname === 'localhost') {
    throw new TraccarSsrfBlockedError('loopback hostname (localhost)');
  }

  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    for (const record of records) {
      const reason = blockedReasonForIp(record.address);
      if (reason) throw new TraccarSsrfBlockedError(`hostname resolves to ${reason}`);
    }
  } catch (error) {
    if (error instanceof TraccarSsrfBlockedError) throw error;
    // DNS resolution failure is a connectivity problem, not an SSRF
    // decision — let the subsequent fetch() surface it as provider_unavailable.
  }
}
