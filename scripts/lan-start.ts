import 'dotenv/config';
import net from 'net';
import { spawn } from 'child_process';
import os from 'os';
import { detectLanCandidates, getPort } from './lib/lan-network';

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
}

async function main() {
  const port = getPort();
  const host = process.env.HOST || '0.0.0.0';

  const required = ['MONGODB_URI', 'SESSION_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('   Set them in .env before starting.');
    process.exit(1);
  }

  const free = await isPortFree(port);
  if (!free) {
    console.error(`❌ Port ${port} is already in use — FleetPro (or something else) may already be running.`);
    console.error('   Run `npm run lan:info` to check its status instead of starting a duplicate process.');
    process.exit(1);
  }

  const candidates = detectLanCandidates();
  console.log('\nFleetPro Local Access — starting...\n');
  console.log('Host Computer:', os.hostname());
  if (host !== '0.0.0.0' && host !== '::') {
    console.log(`⚠️  HOST=${host} — only this machine will be able to connect. Set HOST=0.0.0.0 in .env for LAN access.`);
  } else if (candidates.length > 0) {
    console.log('Recommended LAN URL:', `http://${candidates[0].address}:${port}`);
    for (const c of candidates.slice(1)) {
      console.log('Additional URL:      ', `http://${c.address}:${port}`);
    }
  } else {
    console.log('⚠️  No LAN IPv4 address detected yet — connect to Wi-Fi/Ethernet and re-check with `npm run lan:info`.');
  }
  console.log('\nStarting server (npm run dev)...\n');

  const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
  const forward = (signal: NodeJS.Signals) => child.kill(signal);
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
