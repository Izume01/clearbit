#!/usr/bin/env node

/**
 * Master refresh script — runs all data refresh scripts in sequence.
 * Usage: node scripts/refresh-all.js
 *        pnpm run refresh-data
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRIPTS = [
  { name: 'Tor Exit Nodes',       file: 'refresh-tor.js' },
  { name: 'Cloud IP Ranges',      file: 'refresh-cloud-ips.js' },
  { name: 'Disposable Emails',    file: 'refresh-email-lists.js' },
  { name: 'IPsum Threats',        file: 'refresh-ipsum.js' },
  { name: 'Spamhaus DROP',        file: 'refresh-spamhaus.js' },
  // MaxMind is separate — requires license key, run manually
];

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Privi API — Refreshing All Data        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const results = [];

  for (const script of SCRIPTS) {
    const scriptPath = join(__dirname, script.file);
    const start = Date.now();

    try {
      console.log(`━━━ ${script.name} ━━━`);
      execSync(`node "${scriptPath}"`, { stdio: 'inherit', timeout: 120000 });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results.push({ name: script.name, status: '✅', time: `${elapsed}s` });
      console.log('');
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results.push({ name: script.name, status: '❌', time: `${elapsed}s` });
      console.error(`[refresh-all] ${script.name} failed\n`);
    }
  }

  // Summary
  console.log('\n═══ Summary ═══');
  for (const r of results) {
    console.log(`  ${r.status} ${r.name} (${r.time})`);
  }

  const failures = results.filter(r => r.status === '❌');
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} script(s) failed`);
    process.exit(1);
  } else {
    console.log('\n✅ All data refreshed successfully');
  }
}

main();
