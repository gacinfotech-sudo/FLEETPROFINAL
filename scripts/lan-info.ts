import 'dotenv/config';
import os from 'os';
import { detectLanCandidates, getPort } from './lib/lan-network';

async function checkHealth(url: string): Promise<'OK' | 'DOWN'> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok ? 'OK' : 'DOWN';
  } catch {
    return 'DOWN';
  }
}

async function main() {
  const port = getPort();
  const candidates = detectLanCandidates();
  const host = process.env.HOST || '0.0.0.0';

  console.log('\nFleetPro Local Access\n');
  console.log('Host Computer:');
  console.log(os.hostname());
  console.log();

  if (host !== '0.0.0.0' && host !== '::') {
    console.log(`⚠️  HOST is set to "${host}" — the server will NOT accept connections`);
    console.log('   from other devices until HOST=0.0.0.0 in .env, then restart with `npm run dev`.\n');
  }

  if (candidates.length === 0) {
    console.log('No active private LAN IPv4 address was detected on this machine.');
    console.log('Connect to office Wi-Fi/Ethernet and re-run `npm run lan:info`.\n');
    return;
  }

  const recommended = candidates[0];
  const recommendedUrl = `http://${recommended.address}:${port}`;
  console.log('Recommended LAN URL:');
  console.log(recommendedUrl);
  console.log();

  const others = candidates.slice(1);
  if (others.length > 0) {
    console.log('Additional Available URLs:');
    for (const c of others) {
      console.log(`http://${c.address}:${port}  (${c.interfaceName})`);
    }
    console.log();
  }

  const health = await checkHealth(`http://127.0.0.1:${port}`);
  console.log('Health:');
  console.log(`Frontend: ${health}`);
  console.log(`API: ${health}`);
  console.log(`Authentication: ${health === 'OK' ? 'reachable' : 'DOWN'}`);
  console.log();

  if (health === 'DOWN') {
    console.log('Server does not appear to be running. Start it with `npm run lan:start`.\n');
  } else {
    console.log('Public Internet Exposure: Disabled (LAN-only — do not port-forward this on your router)\n');
  }
}

main();
