#!/usr/bin/env node

/**
 * Refresh Spamhaus DROP and EDROP lists.
 * The Spamhaus Don't Route Or Peer (DROP) lists contain netblocks that are
 * "hijacked" or leased by professional spam/cyber-crime operations.
 * Schedule: Daily
 */

import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Netmask } from 'netmask';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT = join(DATA_DIR, 'spamhaus-drop.json');

const SOURCES = [
  { name: 'Spamhaus DROP', url: 'https://www.spamhaus.org/drop/drop.txt' },
  { name: 'Spamhaus EDROP', url: 'https://www.spamhaus.org/drop/edrop.txt' },
];

async function fetchList(source) {
  try {
    console.log(`[refresh-spamhaus] Fetching ${source.name}...`);
    const { data } = await axios.get(source.url, { timeout: 30000 });
    
    const lines = data.split('\n');
    const blocks = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Ignore comments and empty lines
      if (!trimmed || trimmed.startsWith(';')) continue;
      
      // Lines look like: 1.2.3.0/24 ; SBL12345
      const [cidr] = trimmed.split(';');
      if (cidr) {
        blocks.push(cidr.trim());
      }
    }
    
    console.log(`[refresh-spamhaus]   ${source.name}: ${blocks.length} CIDR blocks`);
    return blocks;
  } catch (err) {
    console.error(`[refresh-spamhaus]   ${source.name} failed: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('[refresh-spamhaus] Fetching Spamhaus DROP/EDROP lists...');
  mkdirSync(DATA_DIR, { recursive: true });

  const results = await Promise.all(SOURCES.map(fetchList));
  const merged = results.flat();
  const unique = [...new Set(merged)].sort();

  writeFileSync(OUTPUT, JSON.stringify(unique, null, 0));
  console.log(`[refresh-spamhaus] ✅ ${unique.length} unique CIDR blocks saved to ${OUTPUT}`);
}

main();
