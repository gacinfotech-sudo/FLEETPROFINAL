import os from 'os';
import { execSync } from 'child_process';

export interface LanCandidate {
  interfaceName: string;
  address: string;
  isDefaultRoute: boolean;
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function getDefaultRouteInterface(): string | undefined {
  try {
    if (process.platform === 'darwin') {
      const out = execSync('route get default 2>/dev/null').toString();
      const match = out.match(/interface:\s*(\S+)/);
      return match?.[1];
    }
    if (process.platform === 'linux') {
      const out = execSync('ip route show default 2>/dev/null').toString();
      const match = out.match(/dev\s+(\S+)/);
      return match?.[1];
    }
    if (process.platform === 'win32') {
      const out = execSync('powershell -NoProfile -Command "(Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Sort-Object -Property RouteMetric | Select-Object -First 1 -ExpandProperty InterfaceAlias)"').toString();
      return out.trim() || undefined;
    }
  } catch {
    // best-effort only — fall back to "no default route detected" and let
    // the caller show every private-range candidate instead.
  }
  return undefined;
}

/** Active, non-virtual, private-range IPv4 addresses this machine can be reached on from the LAN. */
export function detectLanCandidates(): LanCandidate[] {
  const nets = os.networkInterfaces();
  const defaultIface = getDefaultRouteInterface();
  const candidates: LanCandidate[] = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    // Docker/VM-only bridges and VPN tunnels do not represent the office
    // Wi-Fi/Ethernet path other laptops actually use.
    if (/^(docker|veth|br-|utun|tun|tap|vboxnet|vmnet|awdl|llw)/i.test(name)) continue;

    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue; // APIPA, no real link
      if (!isPrivateIPv4(addr.address)) continue;

      candidates.push({
        interfaceName: name,
        address: addr.address,
        isDefaultRoute: name === defaultIface,
      });
    }
  }

  // Recommended URL first: the interface carrying the default route (i.e.
  // the actual Wi-Fi/Ethernet uplink), then everything else.
  candidates.sort((a, b) => Number(b.isDefaultRoute) - Number(a.isDefaultRoute));
  return candidates;
}

export function getPort(): number {
  return Number(process.env.PORT) || 5000;
}
