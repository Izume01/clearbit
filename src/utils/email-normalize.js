/**
 * Email normalization utilities.
 * Detects Gmail dot tricks, + aliases, and normalizes the address.
 */

// Providers that ignore dots in the local part
const DOT_IGNORING_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com',
]);

// Providers that support + aliasing
const PLUS_ALIAS_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com',
  'protonmail.com', 'proton.me',
  'fastmail.com',
  'yahoo.com',    // yahoo uses - instead of + but we check + anyway
  'icloud.com',
]);

/**
 * Normalize an email address and detect alias tricks.
 *
 * @param {string} email - Full email address
 * @returns {{ normalized: string, uses_alias: boolean, uses_dots_trick: boolean, original: string }}
 */
export function normalizeEmail(email) {
  if (!email || !email.includes('@')) {
    return {
      normalized: email || '',
      uses_alias: false,
      uses_dots_trick: false,
      original: email || '',
    };
  }

  const [localPart, domain] = email.toLowerCase().split('@');
  let normalized = localPart;
  let uses_alias = false;
  let uses_dots_trick = false;

  // 1. Strip + alias
  if (normalized.includes('+') && PLUS_ALIAS_PROVIDERS.has(domain)) {
    const beforePlus = normalized.split('+')[0];
    if (beforePlus !== normalized) {
      uses_alias = true;
      normalized = beforePlus;
    }
  }

  // 2. Remove dots for providers that ignore them
  if (DOT_IGNORING_PROVIDERS.has(domain) && normalized.includes('.')) {
    const withoutDots = normalized.replace(/\./g, '');
    if (withoutDots !== normalized) {
      uses_dots_trick = true;
      normalized = withoutDots;
    }
  }

  return {
    normalized: `${normalized}@${domain}`,
    uses_alias,
    uses_dots_trick,
    original: email.toLowerCase(),
  };
}
