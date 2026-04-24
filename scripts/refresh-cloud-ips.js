#!/usr/bin/env node

/**
 * Refresh cloud provider IP ranges (AWS, GCP, Azure, Cloudflare).
 * These are publicly published CIDR ranges — if an IP is in these lists, it's a server.
 * Schedule: Daily at 2 AM
 */

import axios from 'axios';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const OUTPUT = join(DATA_DIR, 'cloud-cidrs.json');

const SOURCES = {
  AWS: {
    url: 'https://ip-ranges.amazonaws.com/ip-ranges.json',
    parse: (data) => data.prefixes.map(p => ({ cidr: p.ip_prefix, provider: 'AWS' }))
      .concat((data.ipv6_prefixes || []).map(p => ({ cidr: p.ipv6_prefix, provider: 'AWS' }))),
  },
  GCP: {
    url: 'https://www.gstatic.com/ipranges/cloud.json',
    parse: (data) => data.prefixes.map(p => ({
      cidr: p.ipv4Prefix || p.ipv6Prefix,
      provider: 'Google Cloud',
    })).filter(e => e.cidr),
  },
  Cloudflare: {
    url: 'https://www.cloudflare.com/ips-v4',
    parse: (data) => data.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(cidr => ({ cidr, provider: 'Cloudflare' })),
  },
  CloudflareV6: {
    url: 'https://www.cloudflare.com/ips-v6',
    parse: (data) => data.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(cidr => ({ cidr, provider: 'Cloudflare' })),
  },
  DigitalOcean: {
    url: 'https://digitalocean.com/geo/google.csv',
    parse: (data) => data.split('\n')
      .map(line => line.split(',')[0].trim())
      .filter(cidr => cidr && cidr.includes('/'))
      .map(cidr => ({ cidr, provider: 'DigitalOcean' })),
  },
  OracleCloud: {
    url: 'https://docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json',
    parse: (data) => data.regions.flatMap(r => r.cidrs.map(c => ({ cidr: c.cidr, provider: 'Oracle Cloud' }))),
  },
  Fastly: {
    url: 'https://api.fastly.com/public-ip-list',
    parse: (data) => data.addresses.map(cidr => ({ cidr, provider: 'Fastly' }))
      .concat((data.ipv6_addresses || []).map(cidr => ({ cidr, provider: 'Fastly' }))),
  },
  Azure: {
    url: 'https://raw.githubusercontent.com/femueller/cloud-ip-ranges/master/microsoft-azure-ip-ranges.json',
    parse: (data) => data.values.flatMap(v => v.properties.addressPrefixes).map(cidr => ({ cidr, provider: 'Microsoft Azure' })),
  },
  Linode: {
    url: 'https://raw.githubusercontent.com/femueller/cloud-ip-ranges/master/linode.txt',
    parse: (data) => data.split('\n')
      .filter(l => !l.startsWith('#'))
      .map(line => line.split(',')[0].trim())
      .filter(cidr => cidr && cidr.includes('/'))
      .map(cidr => ({ cidr, provider: 'Linode' })),
  },
};

async function fetchProvider(name, source) {
  try {
    console.log(`[refresh-cloud] Fetching ${name}...`);
    const { data } = await axios.get(source.url, {
      timeout: 30000,
      // AWS/GCP/Fastly/Oracle/Azure return JSON, Cloudflare/DigitalOcean/Linode return plain text
      responseType: (name.startsWith('Cloudflare') || name === 'DigitalOcean' || name === 'Linode') ? 'text' : 'json',
    });
    const result = source.parse(data);
    console.log(`[refresh-cloud]   ${name}: ${result.length} ranges`);
    return result;
  } catch (err) {
    console.error(`[refresh-cloud]   ${name} failed: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('[refresh-cloud] Fetching cloud provider IP ranges...');
  mkdirSync(DATA_DIR, { recursive: true });

  const results = await Promise.all(
    Object.entries(SOURCES).map(([name, source]) => fetchProvider(name, source))
  );

  const all = results.flat();
  writeFileSync(OUTPUT, JSON.stringify(all, null, 0));
  console.log(`[refresh-cloud] ✅ ${all.length} total CIDRs saved to ${OUTPUT}`);
}

main();
