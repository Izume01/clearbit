#!/usr/bin/env node

/**
 * Refresh IPsum threat intelligence feed.
 * Source: https://github.com/stamparm/ipsum
 * Aggregates 30+ public threat lists. Filters to IPs on 3+ lists.
 * Schedule: Daily
 */

import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT = join(DATA_DIR, 'ipsum-threats.json');

const IPSUM_URL = 'https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt';
const MIN_OCCURRENCES = 3; // Only include IPs flagged by 3+ lists

async function main() {
  console.log('[refresh-ipsum] Fetching IPsum threat feed...');

  try {
    mkdirSync(DATA_DIR, { recursive: true });

    const { data } = await axios.get(IPSUM_URL, { timeout: 30000 });

    const threats = [];
    const lines = data.split('\n');

    for (const line of lines) {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;

      const parts = line.trim().split('\t');
      if (parts.length >= 2) {
        const ip = parts[0].trim();
        const occurrences = parseInt(parts[1], 10);

        if (occurrences >= MIN_OCCURRENCES && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
          threats.push(ip);
        }
      }
    }

    const unique = [...new Set(threats)];
    writeFileSync(OUTPUT, JSON.stringify(unique, null, 0));
    console.log(`[refresh-ipsum] ✅ ${unique.length} threat IPs (≥${MIN_OCCURRENCES} occurrences) saved to ${OUTPUT}`);
  } catch (err) {
    console.error('[refresh-ipsum] ❌ Failed:', err.message);
    process.exit(1);
  }
}

main();
