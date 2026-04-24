#!/usr/bin/env node

/**
 * Refresh Tor exit nodes list.
 * Source: https://check.torproject.org/torbulkexitlist
 * Schedule: Every 4 hours
 */

import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT = join(DATA_DIR, 'tor-exits.json');

const TOR_URL = 'https://check.torproject.org/torbulkexitlist';

async function main() {
  console.log('[refresh-tor] Fetching Tor exit nodes...');

  try {
    mkdirSync(DATA_DIR, { recursive: true });

    const { data } = await axios.get(TOR_URL, { timeout: 30000 });
    const lines = data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    // Deduplicate
    const unique = [...new Set(lines)];

    writeFileSync(OUTPUT, JSON.stringify(unique, null, 0));
    console.log(`[refresh-tor] ✅ ${unique.length} Tor exit nodes saved to ${OUTPUT}`);
  } catch (err) {
    console.error('[refresh-tor] ❌ Failed:', err.message);
    process.exit(1);
  }
}

main();
