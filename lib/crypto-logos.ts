// ══════════════════════════════════════════════════════════════════════════════
// CryptoCompare Logo Fetcher
// API: https://min-api.cryptocompare.com/data/all/coinlist
// Usage: getCryptoLogo('BTC') → 'https://www.cryptocompare.com/media/.../btc.png'
// ══════════════════════════════════════════════════════════════════════════════

const CC_BASE = 'https://www.cryptocompare.com';
const CACHE: Record<string, string> = {};
let coinListPromise: Promise<Record<string, { ImageUrl?: string }>> | null = null;

async function loadCoinList() {
  if (!coinListPromise) {
    coinListPromise = fetch('https://min-api.cryptocompare.com/data/all/coinlist', {
      cache: 'force-cache',
    })
      .then(r => r.json())
      .then((d: { Data: Record<string, { ImageUrl?: string }> }) => d.Data ?? {})
      .catch(() => ({}));
  }
  return coinListPromise;
}

/**
 * Returns the CryptoCompare logo URL for a given symbol.
 * Falls back to null if not found.
 */
export async function getCryptoLogo(symbol: string): Promise<string | null> {
  const key = symbol.toUpperCase();
  if (CACHE[key] !== undefined) return CACHE[key] || null;
  try {
    const data = await loadCoinList();
    const entry = data[key];
    if (entry?.ImageUrl) {
      const url = CC_BASE + entry.ImageUrl;
      CACHE[key] = url;
      return url;
    }
  } catch { /* silent */ }
  CACHE[key] = '';
  return null;
}

/**
 * Batch fetch logos for multiple symbols.
 */
export async function getCryptoLogos(symbols: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    const data = await loadCoinList();
    for (const sym of symbols) {
      const key = sym.toUpperCase();
      const entry = data[key];
      if (entry?.ImageUrl) result[sym] = CC_BASE + entry.ImageUrl;
    }
  } catch { /* silent */ }
  return result;
}

/**
 * Sync version — returns null if not yet cached.
 * Use after preloading with getCryptoLogo().
 */
export function getCryptoLogoSync(symbol: string): string | null {
  const key = symbol.toUpperCase();
  return CACHE[key] || null;
}

// ── Known network symbol mappings for CryptoCompare ─────────────────────────
export const NETWORK_SYMBOLS: Record<string, string> = {
  'arc-testnet':      'ARC',
  'eth-mainnet':      'ETH',
  'eth-sepolia':      'ETH',
  'avax-mainnet':     'AVAX',
  'avax-fuji':        'AVAX',
  'op-mainnet':       'OP',
  'op-sepolia':       'OP',
  'arb-mainnet':      'ARB',
  'arb-sepolia':      'ARB',
  'base-mainnet':     'BASE',
  'base-sepolia':     'BASE',
  'polygon-mainnet':  'POL',
  'polygon-amoy':     'MATIC',
  'linea-mainnet':    'LINEA',
  'linea-sepolia':    'LINEA',
  'zksync-mainnet':   'ZK',
  'zksync-testnet':   'ZK',
  'solana-mainnet':   'SOL',
  'solana-devnet':    'SOL',
  'stellar-mainnet':  'XLM',
  'stellar-testnet':  'XLM',
  'sui-mainnet':      'SUI',
  'sui-testnet':      'SUI',
  'aptos-mainnet':    'APT',
  'aptos-testnet':    'APT',
  'starknet-mainnet': 'STRK',
  'starknet-sepolia': 'STRK',
  'celo-mainnet':     'CELO',
  'celo-sepolia':     'CELO',
  'bsc-mainnet':      'BNB',
  'bsc-testnet':      'BNB',
  'sonic-mainnet':    'S',
  'monad-testnet':    'MON',
  'worldchain-mainnet': 'WLD',
  'unichain-mainnet': 'UNI',
  'hedera-mainnet':   'HBAR',
  'hedera-testnet':   'HBAR',
  'injective-mainnet':'INJ',
  'xrpl-mainnet':     'XRP',
};

// ── React hook for async logo loading ────────────────────────────────────────
// Usage in components: const logo = useCryptoLogo('BTC', fallback)
import { useState, useEffect } from 'react';

export function useCryptoLogo(symbol: string, fallback?: string): string {
  const [logo, setLogo] = useState<string>(fallback ?? '');
  useEffect(() => {
    if (!symbol) return;
    const cached = getCryptoLogoSync(symbol.toUpperCase());
    if (cached) { setLogo(cached); return; }
    getCryptoLogo(symbol).then(url => { if (url) setLogo(url); });
  }, [symbol, fallback]);
  return logo;
}

export function useNetworkLogo(networkId: string, fallback?: string): string {
  const sym = NETWORK_SYMBOLS[networkId];
  return useCryptoLogo(sym || '', fallback);
}
