import 'dotenv/config';
import { detectLanCandidates, getPort } from './lib/lan-network';

async function timedFetch(url: string, init?: RequestInit) {
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
    return { ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - start, error: (err as Error).message };
  }
}

async function main() {
  const port = getPort();
  const candidates = detectLanCandidates();

  if (candidates.length === 0) {
    console.log('❌ No LAN IPv4 address detected — cannot verify LAN-reachable access.');
    process.exit(1);
  }

  const target = candidates[0];
  const base = `http://${target.address}:${port}`;
  console.log(`Checking FleetPro at ${base} (interface: ${target.interfaceName})\n`);

  let allOk = true;

  const health = await timedFetch(`${base}/api/health`);
  console.log(`API /api/health        : ${health.ok ? `OK (${health.ms}ms)` : `FAIL${health.error ? ` — ${health.error}` : ` (HTTP ${health.status})`}`}`);
  allOk &&= health.ok;

  const frontend = await timedFetch(`${base}/`);
  console.log(`Frontend  /             : ${frontend.ok ? `OK (${frontend.ms}ms)` : `FAIL${frontend.error ? ` — ${frontend.error}` : ` (HTTP ${frontend.status})`}`}`);
  allOk &&= frontend.ok;

  const csrf = await timedFetch(`${base}/api/csrf-token`);
  console.log(`Auth      /api/csrf-token: ${csrf.ok ? `OK (${csrf.ms}ms)` : `FAIL${csrf.error ? ` — ${csrf.error}` : ` (HTTP ${csrf.status})`}`}`);
  allOk &&= csrf.ok;

  console.log();
  if (allOk) {
    console.log(`✅ FleetPro is reachable from the LAN at ${base}`);
  } else {
    console.log('❌ One or more checks failed. Confirm the server is running (`npm run dev`),');
    console.log('   HOST=0.0.0.0 in .env, and the firewall allows inbound connections on this port.');
    process.exit(1);
  }
}

main();
