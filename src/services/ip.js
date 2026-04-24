import dns from 'dns/promises';
import { getCityDb, getAsnDb, getTorExits, getIpsumThreats, getCloudCidrs, getSpamhausDrop } from '../data/loader.js';
import { checkCloudCidr } from '../utils/cidr.js';
import { Netmask } from 'netmask';
import { config } from '../config.js';

/**
 * Analyse an IP address for risk signals.
 *
 * @param {string} ip
 * @returns {Promise<{
 *   type: string,
 *   provider: string | null,
 *   hostname: string | null,
 *   country: string | null,
 *   city: string | null,
 *   asn: number | null,
 *   org: string | null,
 *   is_vpn: boolean,
 *   is_tor: boolean,
 *   is_datacenter: boolean,
 *   is_known_threat: boolean,
 *   _flags: string[]
 * }>}
 */
export async function analyzeIp(ip) {
  const flags = [];

  // ── MaxMind City lookup ──
  let country = null;
  let city = null;
  const cityDb = getCityDb();
  if (cityDb) {
    try {
      const geo = cityDb.get(ip);
      if (geo) {
        country = geo.country?.iso_code || null;
        city = geo.city?.names?.en || null;
      }
    } catch { /* invalid IP or lookup failure */ }
  }

  // ── MaxMind ASN lookup ──
  let asn = null;
  let org = null;
  const asnDb = getAsnDb();
  if (asnDb) {
    try {
      const asnResult = asnDb.get(ip);
      if (asnResult) {
        asn = asnResult.autonomous_system_number || null;
        org = asnResult.autonomous_system_organization || null;
      }
    } catch { /* invalid IP */ }
  }

  // ── VPN heuristic: ASN name keyword matching ──
  let is_vpn = false;
  if (org) {
    const orgLower = org.toLowerCase();
    is_vpn = config.vpnAsnKeywords.some(keyword => orgLower.includes(keyword));
  }

  // ── Tor exit node check (in-memory Set) ──
  const torExits = getTorExits();
  const is_tor = torExits.has(ip);
  if (is_tor) flags.push('ip_is_tor');

  // ── Cloud/Datacenter CIDR check ──
  const cloudCidrs = getCloudCidrs();
  let { is_datacenter, provider } = checkCloudCidr(ip, cloudCidrs);

  // ── Reverse DNS (PTR) lookup ──
  let hostname = null;
  try {
    const ptrResult = await Promise.race([
      dns.reverse(ip).catch(() => []),
      new Promise((r) => setTimeout(() => r([]), 500)) // 500ms timeout max
    ]);
    if (ptrResult && ptrResult.length > 0) {
      hostname = ptrResult[0];
    }
  } catch { /* Ignore timeout/failure */ }

  // ── Advanced Datacenter Heuristics (ASN & PTR) ──
  if (!is_datacenter) {
    const orgLower = org ? org.toLowerCase() : '';
    const hostLower = hostname ? hostname.toLowerCase() : '';
    
    // Keywords representing obvious server infra
    const dcKeywords = ['amazon', 'google cloud', 'digitalocean', 'digital ocean', 'ovh', 'hosting', 'datacenter', 'cloud', 'compute', 'vps', 'server', 'choopa', 'hetzner', 'linode', 'alibaba', 'fastly', 'akamai'];
    
    // Check if the Org name or the Reverse DNS Hostname matches known DC patterns
    const is_hosted_org = dcKeywords.some(kw => orgLower.includes(kw));
    // PTRs like ec2-1-2-3.compute.amazonaws.com or static.vpn.xyz
    const is_hosted_ptr = hostLower && (
      dcKeywords.some(kw => hostLower.includes(kw)) ||
      hostLower.includes('static') || // static.123.45.67.domain.com
      hostLower.includes('ip-')       // generic aws/ovh auto-assigned PTRs
    );
    
    if (is_hosted_org || is_hosted_ptr) {
      is_datacenter = true;
      provider = provider || (is_hosted_org ? org : 'Unknown Datacenter');
    }
  }

  if (is_datacenter) flags.push('ip_is_datacenter');

  // ── IPsum threat intelligence check ──
  const ipsumThreats = getIpsumThreats();
  let is_known_threat = ipsumThreats.has(ip);
  if (is_known_threat) flags.push('ip_is_known_threat');

  // ── Spamhaus DROP check ──
  const spamhausNetworks = getSpamhausDrop();
  let is_spamhaus = false;
  if (!is_known_threat || true) { // Always check to add the flag if true
    for (const cidr of spamhausNetworks) {
      try {
        const block = new Netmask(cidr);
        if (block.contains(ip)) {
          is_spamhaus = true;
          is_known_threat = true; // Also mark as general threat
          flags.push('ip_is_spamhaus_drop');
          break;
        }
      } catch { /* skip invalid block */ }
    }
  }

  // ── VPN flag (from ASN heuristic) ──
  if (is_vpn && !is_datacenter) flags.push('ip_is_vpn');

  // ── Determine IP type label ──
  let type = 'Residential';
  if (is_tor) type = 'Tor';
  else if (is_datacenter) type = 'Datacenter';
  else if (is_vpn) type = 'VPN/Proxy';

  return {
    type,
    provider: provider || null,
    hostname,
    country,
    city,
    asn,
    org,
    is_vpn,
    is_tor,
    is_datacenter,
    is_known_threat,
    _flags: flags,
  };
}
