#!/usr/bin/env node

/**
 * Refresh disposable email domain lists from multiple GitHub sources.
 * Merges all lists, deduplicates, and saves as a single JSON array.
 * Schedule: Weekly (Sunday 3 AM)
 */

import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT = join(DATA_DIR, 'disposable-domains.json');

// Raw GitHub URLs for disposable email domain lists
const SOURCES = [
  {
    name: 'disposable-email-domains/disposable-email-domains',
    url: 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf',
    parse: (data) => data.split('\n').map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#')),
  },
  {
    name: 'FGRibreau/mailchecker',
    url: 'https://raw.githubusercontent.com/FGRibreau/mailchecker/master/list.txt',
    parse: (data) => data.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean),
  },
  {
    name: 'wesbos/burner-email-providers',
    url: 'https://raw.githubusercontent.com/wesbos/burner-email-providers/master/emails.txt',
    parse: (data) => data.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean),
  },
  {
    name: '7c/fakefilter',
    url: 'https://raw.githubusercontent.com/7c/fakefilter/main/txt/data.txt',
    parse: (data) => data.split('\n').map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#')),
  },
];

async function fetchSource(source) {
  try {
    console.log(`[refresh-emails] Fetching ${source.name}...`);
    const isJson = source.url.endsWith('.json');
    const { data } = await axios.get(source.url, {
      timeout: 30000,
      responseType: isJson ? 'json' : 'text',
    });
    const domains = source.parse(data);
    console.log(`[refresh-emails]   ${source.name}: ${domains.length} domains`);
    return domains;
  } catch (err) {
    console.error(`[refresh-emails]   ${source.name} failed: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('[refresh-emails] Fetching disposable email domain lists...');
  mkdirSync(DATA_DIR, { recursive: true });

  const results = await Promise.all(SOURCES.map(fetchSource));
  const merged = results.flat();

  // Deduplicate
  const unique = [...new Set(merged)].sort();

  writeFileSync(OUTPUT, JSON.stringify(unique, null, 0));
  console.log(`[refresh-emails] ✅ ${unique.length} unique domains saved to ${OUTPUT}`);
}

main();
