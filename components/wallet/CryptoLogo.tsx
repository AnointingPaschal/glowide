"use client";
import { useState, useEffect } from 'react';
import { getCryptoLogo } from '@/lib/crypto-logos';

interface Props {
  symbol: string;
  fallbackLogo?: string;
  resolvedLogo?: string; // Admin-uploaded logo — highest priority, skips CryptoCompare
  color?: string;
  size?: number;
  className?: string;
}

/**
 * Displays a crypto logo from CryptoCompare API with fallback to color+initials.
 * - First tries the provided fallbackLogo (inline SVG data URI from circle-chains)
 * - In background, fetches real logo from CryptoCompare
 * - Falls back to colored circle with symbol initials if all else fails
 */
export function CryptoLogo({ symbol, fallbackLogo, resolvedLogo, color = '#7c3aed', size = 32, className = '' }: Props) {
  const [logo, setLogo] = useState<string>(resolvedLogo || fallbackLogo || '');
  const [err, setErr]   = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setErr(false);
    // Priority 1: admin-uploaded logo
    if (resolvedLogo) { setLogo(resolvedLogo); return; }
    // Priority 2: inline SVG fallback
    if (fallbackLogo) setLogo(fallbackLogo);
    // Priority 3: CryptoCompare (background fetch, non-blocking)
    getCryptoLogo(symbol.toUpperCase()).then(url => {
      if (url && !resolvedLogo) { setLogo(url); setErr(false); }
    }).catch(() => {});
  }, [symbol, fallbackLogo, resolvedLogo]);

  const isDataUri = logo?.startsWith('data:');

  if (!logo || err) {
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
        style={{ width: size, height: size, background: color, fontSize: Math.max(9, size * 0.3) }}>
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full object-contain flex-shrink-0 ${className}`}
      style={{ background: isDataUri ? 'transparent' : 'rgba(255,255,255,0.05)' }}
      onError={() => !isDataUri && setErr(true)}
    />
  );
}

/**
 * Network logo — looks up the native token symbol for the network ID
 */
export function NetworkLogo({ networkId, fallbackLogo, resolvedLogo, color, size = 28, className = '' }: {
  networkId: string; fallbackLogo?: string; resolvedLogo?: string; color?: string; size?: number; className?: string;
}) {
  // Map network IDs to their native token symbols for CryptoCompare
  const SYMBOLS: Record<string, string> = {
    'arc-testnet':'ARC', 'eth-mainnet':'ETH', 'eth-sepolia':'ETH',
    'avax-mainnet':'AVAX', 'avax-fuji':'AVAX',
    'op-mainnet':'OP', 'op-sepolia':'OP',
    'arb-mainnet':'ARB', 'arb-sepolia':'ARB',
    'base-mainnet':'BASE', 'base-sepolia':'BASE',
    'polygon-mainnet':'MATIC', 'polygon-amoy':'MATIC',
    'linea-mainnet':'LINEA', 'linea-sepolia':'LINEA',
    'zksync-mainnet':'ZK', 'zksync-testnet':'ZK',
    'solana-mainnet':'SOL', 'solana-devnet':'SOL',
    'stellar-mainnet':'XLM', 'stellar-testnet':'XLM',
    'sui-mainnet':'SUI', 'sui-testnet':'SUI',
    'aptos-mainnet':'APT', 'aptos-testnet':'APT',
    'starknet-mainnet':'STRK', 'starknet-sepolia':'STRK',
    'celo-mainnet':'CELO', 'celo-sepolia':'CELO',
    'bsc-mainnet':'BNB', 'bsc-testnet':'BNB',
    'sonic-mainnet':'S', 'monad-testnet':'MON',
    'worldchain-mainnet':'WLD', 'worldchain-sepolia':'WLD',
    'unichain-mainnet':'UNI', 'unichain-sepolia':'UNI',
    'hedera-mainnet':'HBAR', 'hedera-testnet':'HBAR',
    'injective-mainnet':'INJ', 'injective-testnet':'INJ',
    'xrpl-mainnet':'XRP', 'sei-mainnet':'SEI',
  };
  const sym = SYMBOLS[networkId] ?? networkId.split('-')[0].toUpperCase();
  return <CryptoLogo symbol={sym} fallbackLogo={fallbackLogo} resolvedLogo={resolvedLogo} color={color} size={size} className={className}/>;
}
