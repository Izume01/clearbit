import { readFileSync, existsSync } from 'fs';
import maxmind from 'maxmind';
import { config } from '../config.js';

// ── In-memory data stores (loaded once at cold start) ──

let disposableDomains = new Set();
let torExits          = new Set();
let ipsumThreats      = new Set();
let cloudCidrs        = [];   // [{ cidr: '...', provider: '...' }, ...]
let spamhausDrop      = [];
let cityDb            = null; // MaxMind City reader
let asnDb             = null; // MaxMind ASN reader
let loaded            = false;

/**
 * Load a JSON array file into a Set.
 */
function loadJsonSet(filePath, label) {
  if (!existsSync(filePath)) {
    console.warn(`[Loader] ${label} not found at ${filePath} — skipping`);
    return new Set();
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const arr = JSON.parse(raw);
    console.log(`[Loader] ${label}: ${arr.length.toLocaleString()} entries loaded`);
    return new Set(arr);
  } catch (err) {
    console.error(`[Loader] Failed to load ${label}:`, err.message);
    return new Set();
  }
}

/**
 * Load a JSON array file as-is.
 */
function loadJsonArray(filePath, label) {
  if (!existsSync(filePath)) {
    console.warn(`[Loader] ${label} not found at ${filePath} — skipping`);
    return [];
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const arr = JSON.parse(raw);
    console.log(`[Loader] ${label}: ${arr.length.toLocaleString()} entries loaded`);
    return arr;
  } catch (err) {
    console.error(`[Loader] Failed to load ${label}:`, err.message);
    return [];
  }
}

/**
 * Load all data sources into memory.
 * Safe to call multiple times — will only load once unless force=true.
 */
export async function loadAllData(force = false) {
  if (loaded && !force) return;

  console.log('[Loader] Loading data into memory...');
  const start = Date.now();

  // JSON snapshots → Sets / Arrays
  disposableDomains = loadJsonSet(config.paths.disposable, 'Disposable domains');
  torExits          = loadJsonSet(config.paths.torExits, 'Tor exit nodes');
  ipsumThreats      = loadJsonSet(config.paths.ipsum, 'IPsum threats');
  cloudCidrs        = loadJsonArray(config.paths.cloudCidrs, 'Cloud CIDRs');
  spamhausDrop      = loadJsonArray(config.paths.spamhaus, 'Spamhaus DROP');

  // MaxMind .mmdb databases
  if (existsSync(config.maxmind.cityDbPath)) {
    try {
      cityDb = await maxmind.open(config.maxmind.cityDbPath);
      console.log('[Loader] MaxMind City DB loaded');
    } catch (err) {
      console.error('[Loader] MaxMind City DB error:', err.message);
    }
  } else {
    console.warn('[Loader] MaxMind City DB not found — IP geo lookups disabled');
  }

  if (existsSync(config.maxmind.asnDbPath)) {
    try {
      asnDb = await maxmind.open(config.maxmind.asnDbPath);
      console.log('[Loader] MaxMind ASN DB loaded');
    } catch (err) {
      console.error('[Loader] MaxMind ASN DB error:', err.message);
    }
  } else {
    console.warn('[Loader] MaxMind ASN DB not found — ASN lookups disabled');
  }

  loaded = true;
  console.log(`[Loader] All data loaded in ${Date.now() - start}ms`);
}

// ── Accessors ──

export function getDisposableDomains() { return disposableDomains; }
export function getTorExits()          { return torExits; }
export function getIpsumThreats()      { return ipsumThreats; }
export function getCloudCidrs() {
  return cloudCidrs;
}

export function getSpamhausDrop() {
  return spamhausDrop;
}
export function getCityDb()            { return cityDb; }
export function getAsnDb()             { return asnDb; }
export function isLoaded()             { return loaded; }
