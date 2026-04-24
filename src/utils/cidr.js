import ipRangeCheck from 'ip-range-check';

/**
 * Check if an IP address falls within any of the cloud provider CIDR ranges.
 *
 * @param {string} ip - The IP address to check
 * @param {Array<{cidr: string, provider: string}>} cidrs - Cloud CIDR list
 * @returns {{ is_datacenter: boolean, provider: string | null }}
 */
export function checkCloudCidr(ip, cidrs) {
  if (!cidrs || cidrs.length === 0) {
    return { is_datacenter: false, provider: null };
  }

  // ip-range-check accepts a single CIDR or array of CIDRs
  // But we need to know WHICH provider matched, so we group by provider first
  const byProvider = {};
  for (const entry of cidrs) {
    if (!byProvider[entry.provider]) {
      byProvider[entry.provider] = [];
    }
    byProvider[entry.provider].push(entry.cidr);
  }

  for (const [provider, ranges] of Object.entries(byProvider)) {
    try {
      if (ipRangeCheck(ip, ranges)) {
        return { is_datacenter: true, provider };
      }
    } catch {
      // skip malformed ranges
    }
  }

  return { is_datacenter: false, provider: null };
}
