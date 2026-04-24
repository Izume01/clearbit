import crypto from 'crypto';
import { config } from '../config.js';
import { analyzeIp } from './ip.js';
import { analyzeEmail } from './email.js';
import { checkPassword } from './hibp.js';

/**
 * Flag severity weights for risk level calculation.
 */
const FLAG_WEIGHTS = {
  // High severity (weight 3)
  ip_is_tor:            3,
  ip_is_known_threat:   3,
  ip_is_spamhaus_drop:  3,

  // Medium severity (weight 2)
  ip_is_datacenter:     2,
  ip_is_vpn:            2,
  email_is_disposable:  2,
  email_no_mx_record:   2,
  email_invalid_syntax: 2,

  // Low severity (weight 1)
  email_username_suspicious: 1,
  email_uses_alias:          1,
  email_is_catch_all:        1,
};

/**
 * Calculate weight for a flag string.
 * Handles dynamic flags like "email_domain_age_days: 4"
 */
function getFlagWeight(flag) {
  // Direct match
  if (FLAG_WEIGHTS[flag] !== undefined) return FLAG_WEIGHTS[flag];

  // Domain age flags
  if (flag.startsWith('email_domain_age_days:')) {
    const days = parseInt(flag.split(':')[1]?.trim(), 10);
    if (!isNaN(days) && days < 7) return 3;  // Very young domain = high severity
    return 1;
  }
  if (flag.startsWith('email_domain_young:')) return 1;

  // Unknown flags get weight 1
  return 1;
}

/**
 * Determine risk level based on total weighted flag score.
 */
function calculateRiskLevel(totalWeight) {
  if (totalWeight >= config.risk.highThreshold)   return 'High';
  if (totalWeight >= config.risk.mediumThreshold) return 'Medium';
  if (totalWeight >= config.risk.lowThreshold)    return 'Low';
  return 'None';
}

/**
 * Generate a unique request ID.
 */
function generateRequestId() {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Full risk assessment — orchestrates IP + email analysis.
 *
 * @param {string} ip - IP address to check
 * @param {string} email - Email address to check
 * @returns {Promise<object>} Full V1 response object
 */
export async function assessRisk(ip, email) {
  const start = Date.now();
  const requestId = generateRequestId();

  // Run all lookups in parallel
  const [ipResult, emailResult] = await Promise.all([
    analyzeIp(ip),
    analyzeEmail(email),
  ]);

  // Collect all triggered flags
  const triggered_flags = [
    ...ipResult._flags,
    ...emailResult._flags,
  ];

  // Calculate total weighted score
  const totalWeight = triggered_flags.reduce((sum, flag) => sum + getFlagWeight(flag), 0);
  const risk_level = calculateRiskLevel(totalWeight);

  const latency_ms = Date.now() - start;

  // Strip internal _flags from sub-objects
  const { _flags: _ipFlags, ...ipClean } = ipResult;
  const { _flags: _emailFlags, ...emailClean } = emailResult;

  return {
    risk_level,
    triggered_flags,
    ip: ipClean,
    email: emailClean,
    meta: {
      latency_ms,
      version: config.version,
      request_id: requestId,
    },
  };
}
