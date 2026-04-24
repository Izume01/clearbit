/**
 * Shannon entropy calculation + heuristic analysis for email usernames.
 * Detects bot-generated gibberish like "xqplkjdf93", "aaaaaaa", sequential patterns.
 */

/**
 * Calculate Shannon entropy of a string (bits per character).
 * English text ~3.5-4.5, random gibberish ~5+, repetitive ~1-2.
 */
function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;

  const freq = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Consonant-to-vowel ratio. Natural names have ~1.5-2.5 ratio.
 * Pure consonant strings (bots) have very high ratio.
 */
function consonantVowelRatio(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return 0;

  const vowels = cleaned.replace(/[^aeiou]/g, '').length;
  const consonants = cleaned.length - vowels;

  if (vowels === 0) return 10; // all consonants — very suspicious
  return consonants / vowels;
}

/**
 * Digit density — proportion of digits in the username.
 */
function digitDensity(str) {
  if (!str) return 0;
  const digits = str.replace(/[^0-9]/g, '').length;
  return digits / str.length;
}

/**
 * Check for repeated character runs (e.g. "aaaa", "xxxx").
 */
function hasRepeatedChars(str, threshold = 3) {
  const pattern = new RegExp(`(.)\\1{${threshold - 1},}`);
  return pattern.test(str);
}

/**
 * Check for keyboard walk patterns (e.g. "qwerty", "asdfgh").
 */
function hasKeyboardPattern(str) {
  const patterns = [
    'qwert', 'asdfg', 'zxcvb', 'yuiop', 'hjkl',
    '12345', '67890', 'abcde', 'fghij',
    'qwert', 'poiuy', 'lkjhg', 'mnbvc',
  ];
  const lower = str.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/**
 * Check for sequential number patterns (user123, test456).
 */
function hasSequentialNumbers(str) {
  const nums = str.replace(/[^0-9]/g, '');
  if (nums.length < 3) return false;

  for (let i = 0; i <= nums.length - 3; i++) {
    const a = parseInt(nums[i]);
    const b = parseInt(nums[i + 1]);
    const c = parseInt(nums[i + 2]);
    if (b - a === 1 && c - b === 1) return true;  // ascending
    if (a - b === 1 && b - c === 1) return true;  // descending
  }
  return false;
}

/**
 * Analyse email username and return a risk assessment.
 *
 * @param {string} username - The local part of the email (before @)
 * @returns {{ score: number, is_suspicious: boolean, reasons: string[] }}
 */
export function analyzeEntropy(username) {
  if (!username || username.length === 0) {
    return { score: 0, is_suspicious: true, reasons: ['empty_username'] };
  }

  const reasons = [];
  let suspicionPoints = 0;

  // 1. Shannon entropy
  const entropy = shannonEntropy(username);
  const normalizedEntropy = Math.min(entropy / 5, 1); // normalize to 0-1

  // Very high entropy (random gibberish) OR very low (repetitive)
  if (entropy > 4.2 && username.length > 6) {
    reasons.push('high_entropy_random');
    suspicionPoints += 2;
  }
  if (entropy < 1.5 && username.length > 4) {
    reasons.push('low_entropy_repetitive');
    suspicionPoints += 2;
  }

  // 2. Consonant-vowel ratio
  const cvRatio = consonantVowelRatio(username);
  if (cvRatio > 4) {
    reasons.push('abnormal_consonant_ratio');
    suspicionPoints += 1;
  }

  // 3. Digit density
  const dd = digitDensity(username);
  if (dd > 0.6) {
    reasons.push('excessive_digits');
    suspicionPoints += 1;
  }

  // 4. Repeated characters
  if (hasRepeatedChars(username)) {
    reasons.push('repeated_characters');
    suspicionPoints += 2;
  }

  // 5. Keyboard patterns
  if (hasKeyboardPattern(username)) {
    reasons.push('keyboard_pattern');
    suspicionPoints += 2;
  }

  // 6. Sequential numbers
  if (hasSequentialNumbers(username)) {
    reasons.push('sequential_numbers');
    suspicionPoints += 1;
  }

  // 7. Very short or very long
  if (username.length <= 2) {
    reasons.push('too_short');
    suspicionPoints += 1;
  }
  if (username.length > 30) {
    reasons.push('unusually_long');
    suspicionPoints += 1;
  }

  const is_suspicious = suspicionPoints >= 3;
  const score = parseFloat(normalizedEntropy.toFixed(3));

  return { score, is_suspicious, reasons };
}
