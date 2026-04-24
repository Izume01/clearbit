#!/usr/bin/env node

/**
 * Download MaxMind GeoLite2 databases.
 * Requires MAXMIND_LICENSE_KEY in .env.
 * Downloads: GeoLite2-City.mmdb, GeoLite2-ASN.mmdb
 */

import 'dotenv/config';
import axios from 'axios';
import { createWriteStream, mkdirSync, createReadStream, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
// Using system tar directly via child_process

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY;

const DATABASES = [
  { edition: 'GeoLite2-City', filename: 'GeoLite2-City.mmdb' },
  { edition: 'GeoLite2-ASN',  filename: 'GeoLite2-ASN.mmdb' },
];

async function downloadDb(edition, filename) {
  const url = `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${LICENSE_KEY}&suffix=tar.gz`;
  const tarPath = join(DATA_DIR, `${edition}.tar.gz`);
  const outputPath = join(DATA_DIR, filename);

  console.log(`[download-maxmind] Downloading ${edition}...`);

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 120000,
    });

    // Save tar.gz
    const writer = createWriteStream(tarPath);
    await pipeline(response.data, writer);
    console.log(`[download-maxmind]   Downloaded ${edition}.tar.gz`);

    // Extract .mmdb from tar.gz
    // We need to find the .mmdb file inside the tar
    const { execSync } = await import('child_process');
    execSync(`tar -xzf "${tarPath}" -C "${DATA_DIR}" --strip-components=1 --wildcards "*.mmdb"`, {
      stdio: 'pipe',
    });

    // Clean up tar
    try { unlinkSync(tarPath); } catch {}

    console.log(`[download-maxmind]   ✅ ${filename} extracted`);
  } catch (err) {
    console.error(`[download-maxmind]   ❌ ${edition} failed:`, err.message);
    try { unlinkSync(tarPath); } catch {}
  }
}

async function main() {
  if (!LICENSE_KEY) {
    console.error('[download-maxmind] ❌ MAXMIND_LICENSE_KEY not set in .env');
    console.error('[download-maxmind]    Sign up free: https://www.maxmind.com/en/geolite2/signup');
    console.error('[download-maxmind]    Or manually place .mmdb files in data/');
    process.exit(1);
  }

  mkdirSync(DATA_DIR, { recursive: true });

  for (const db of DATABASES) {
    await downloadDb(db.edition, db.filename);
  }

  console.log('[download-maxmind] Done.');
}

main();
