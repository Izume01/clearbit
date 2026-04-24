import dns from 'dns/promises';
import axios from 'axios';
import { getDisposableDomains } from '../data/loader.js';
import { cacheGetHash, cacheSetHash } from '../data/redis.js';
import { analyzeEntropy } from '../utils/entropy.js';
import { normalizeEmail } from '../utils/email-normalize.js';
import { config } from '../config.js';

// Simple email syntax regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Analyse an email address for risk signals.
 */
export async function analyzeEmail(email) {
  const flags = [];

  // ── Syntax validation ──
  const valid_syntax = EMAIL_REGEX.test(email);
  if (!valid_syntax) {
    return {
      valid_syntax: false,
      has_mx_record: false,
      is_disposable: false,
      domain_age_days: null,
      is_catch_all: false,
      username_entropy: 0,
      username_suspicious: false,
      uses_alias: false,
      normalized: email,
      _flags: ['email_invalid_syntax'],
    };
  }

  const [localPart, domain] = email.toLowerCase().split('@');

  // ── Disposable email check (in-memory Set) ──
  const disposable = getDisposableDomains();
  const is_disposable = disposable.has(domain);
  if (is_disposable) flags.push('email_is_disposable');

  // ── Email normalization & alias detection ──
  const norm = normalizeEmail(email);
  if (norm.uses_alias) flags.push('email_uses_alias');

  // ── Username entropy analysis ──
  const entropyResult = analyzeEntropy(localPart);
  if (entropyResult.is_suspicious) flags.push('email_username_suspicious');

  // ── Run MX check first (DNS is fast) ──
  const { has_mx_record, is_catch_all } = await resolveMx(domain);

  if (!has_mx_record) flags.push('email_no_mx_record');
  if (is_catch_all) flags.push('email_is_catch_all');

  // ── Only run RDAP domain age if MX succeeds ──
  let domain_age_days = null;
  if (has_mx_record) {
    const rdapResult = await resolveRdap(domain);
    domain_age_days = rdapResult.domain_age_days;

    if (domain_age_days !== null && domain_age_days >= 0) {
      if (domain_age_days < 7) {
        flags.push(`email_domain_age_days: ${domain_age_days}`);
      } else if (domain_age_days < 30) {
        flags.push(`email_domain_young: ${domain_age_days}d`);
      }
    }
  }

  return {
    valid_syntax,
    has_mx_record,
    is_disposable,
    domain_age_days: domain_age_days !== null && domain_age_days >= 0 ? domain_age_days : null,
    is_catch_all,
    username_entropy: entropyResult.score,
    username_suspicious: entropyResult.is_suspicious,
    uses_alias: norm.uses_alias,
    normalized: norm.normalized,
    _flags: flags,
  };
}

// ── MX resolution with Redis cache ──
async function resolveMx(domain) {
  let has_mx_record = true;
  let is_catch_all = false;

  try {
    const cacheKey = `mx:${domain}`;
    const cached = await cacheGetHash(cacheKey);

    if (cached && cached.has_mx !== undefined) {
      return {
        has_mx_record: cached.has_mx === 'true',
        is_catch_all: cached.is_catch_all === 'true',
      };
    }

    const records = await dns.resolveMx(domain).catch(() => []);
    has_mx_record = records.length > 0;
    is_catch_all = records.some(r =>
      r.exchange && (r.exchange.includes('catch') || r.exchange.includes('wildcard'))
    );

    // Fire-and-forget cache write
    cacheSetHash(cacheKey, {
      has_mx: String(has_mx_record),
      is_catch_all: String(is_catch_all),
      cached_at: String(Date.now()),
    }, config.cache.mxTtl).catch(() => {});
  } catch {
    // DNS failure — assume valid
  }

  return { has_mx_record, is_catch_all };
}

// ── RDAP domain age (replaces WHOIS) with Redis cache ──
async function resolveRdap(domain) {
  let domain_age_days = null;

  try {
    const cacheKey = `rdap:${domain}`;
    const cached = await cacheGetHash(cacheKey);

    if (cached && cached.age_days !== undefined) {
      const age = parseInt(cached.age_days, 10);
      return { domain_age_days: age >= 0 ? age : null };
    }

    // Fast RDAP lookup
    const { data } = await axios.get(`https://rdap.org/domain/${domain}`, {
      timeout: 3000,
      headers: { 'Accept': 'application/rdap+json' }
    });

    const events = data?.events || [];
    const registrationEvent = events.find(e => e.eventAction === 'registration');

    if (registrationEvent?.eventDate) {
      const createdDate = new Date(registrationEvent.eventDate);
      if (!isNaN(createdDate.getTime())) {
        domain_age_days = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Cache result (even failures as -1)
    cacheSetHash(cacheKey, {
      age_days: String(domain_age_days ?? -1),
      cached_at: String(Date.now()),
    }, config.cache.whoisTtl).catch(() => {});
  } catch {
    // Timeout or failure — cache the failure so we don't re-try for 24h
    cacheSetHash(`rdap:${domain}`, {
      age_days: '-1',
      cached_at: String(Date.now()),
    }, config.cache.whoisTtl).catch(() => {});
  }

  return { domain_age_days };
}


