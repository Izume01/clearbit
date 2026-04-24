import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

export const config = {
  port:  parseInt(process.env.PORT || '3000', 10),
  host:  process.env.HOST || '0.0.0.0',

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6381',
  },

  maxmind: {
    licenseKey: process.env.MAXMIND_LICENSE_KEY || '',
    cityDbPath:  join(ROOT_DIR, 'data', 'GeoLite2-City.mmdb'),
    asnDbPath:   join(ROOT_DIR, 'data', 'GeoLite2-ASN.mmdb'),
  },

  abuseipdb: {
    key: process.env.ABUSEIPDB_KEY || '',
  },

  rapidapi: {
    proxySecret: process.env.RAPIDAPI_PROXY_SECRET || '',
  },

  paths: {
    root:       ROOT_DIR,
    data:       join(ROOT_DIR, 'data'),
    torExits:   join(ROOT_DIR, 'data', 'tor-exits.json'),
    cloudCidrs: join(ROOT_DIR, 'data', 'cloud-cidrs.json'),
    disposable: join(ROOT_DIR, 'data', 'disposable-domains.json'),
    ipsum:      join(ROOT_DIR, 'data', 'ipsum-threats.json'),
    spamhaus:   join(ROOT_DIR, 'data', 'spamhaus-drop.json'),
  },

  // ASN organisation name keywords that indicate VPN/hosting/proxy
  vpnAsnKeywords: [
    'vpn', 'proxy', 'privacy', 'anonymous', 'hosting',
    'cloud', 'server', 'datacenter', 'data center', 'colocation',
    'colo', 'vps', 'dedicated', 'tunnel', 'relay',
    'mullvad', 'nordvpn', 'expressvpn', 'surfshark', 'proton',
    'private internet access', 'cyberghost', 'ipvanish',
    'hide.me', 'windscribe', 'torguard',
  ],

  // Risk level thresholds (weighted flag scoring)
  risk: {
    highThreshold:   5,
    mediumThreshold: 3,
    lowThreshold:    1,
  },

  // Cache TTLs in seconds
  cache: {
    whoisTtl: 86400,  // 24 hours
    mxTtl:    3600,   // 1 hour
  },

  version: '1.0',
};
