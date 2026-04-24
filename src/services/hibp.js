import crypto from 'crypto';
import axios from 'axios';

/**
 * Check if a password has been compromised using Have I Been Pwned's
 * k-anonymity API. Never sends the actual password.
 *
 * @param {string} password - The plaintext password to check
 * @returns {Promise<{ compromised: boolean, count: number }>}
 */
export async function checkPassword(password) {
  try {
    // 1. SHA-1 hash the password
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    // 2. Query HIBP with only the first 5 chars
    const { data } = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      timeout: 5000,
      headers: { 'User-Agent': 'Privi-AntifraudAPI/1.0' },
    });

    // 3. Check if our full hash suffix appears in the response
    const lines = data.split('\n');
    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) {
        return { compromised: true, count: parseInt(count, 10) };
      }
    }

    return { compromised: false, count: 0 };
  } catch {
    // Don't block on HIBP failures
    return { compromised: false, count: 0 };
  }
}
