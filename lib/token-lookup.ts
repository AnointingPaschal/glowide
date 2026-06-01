// ══════════════════════════════════════════════════════════════════════════════
// Multi-chain token lookup — EVM (viem) + CryptoCompare logos
// ══════════════════════════════════════════════════════════════════════════════
// viem: chain definitions used for RPC URL resolution
import {
  mainnet, sepolia, avalanche, avalancheFuji,
  optimism, optimismSepolia, arbitrum, arbitrumSepolia,
  base, baseSepolia, polygon, polygonAmoy, linea, lineaSepolia,
  celo, celoAlfajores, bsc, bscTestnet, zkSync, zkSyncSepoliaTestnet,
  sonic, worldchain, zksync,
} from "viem/chains";
import type { Chain } from "viem";

export interface TokenInfo {
  symbol:   string;
  name:     string;
  decimals: number;
  logo?:    string;
  source:   string; // "viem-rpc" | "dexscreener" | "rpc-fallback" | "manual"
}

// ── Arc Testnet (not in viem yet) ─────────────────────────────────────────────
const arcTestnet: Chain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};

// ── Network ID → viem chain mapping ──────────────────────────────────────────
const CHAIN_MAP: Record<string, Chain> = {
  "arc-testnet":     arcTestnet,
  "eth-mainnet":     mainnet,
  "eth-sepolia":     sepolia,
  "avax-mainnet":    avalanche,
  "avax-fuji":       avalancheFuji,
  "op-mainnet":      optimism,
  "op-sepolia":      optimismSepolia,
  "arb-mainnet":     arbitrum,
  "arb-sepolia":     arbitrumSepolia,
  "base-mainnet":    base,
  "base-sepolia":    baseSepolia,
  "polygon-mainnet": polygon,
  "polygon-amoy":    polygonAmoy,
  "linea-mainnet":   linea,
  "linea-sepolia":   lineaSepolia,
  "celo-mainnet":    celo,
  "celo-sepolia":    celoAlfajores,
  "bsc-mainnet":     bsc,
  "bsc-testnet":     bscTestnet,
  "zksync-mainnet":  zkSync,
  "zksync-testnet":  zkSyncSepoliaTestnet,
};

// ── ERC-20 selectors ────────────────────────────────────────────────────────
// name()=0x06fdde03, symbol()=0x95d89b41, decimals()=0x313ce567

// ── CryptoCompare logo ────────────────────────────────────────────────────────
let _coinList: Record<string,{ImageUrl?:string}> | null = null;
async function getCCLogo(symbol: string): Promise<string|undefined> {
  try {
    if (!_coinList) {
      const r = await fetch("https://min-api.cryptocompare.com/data/all/coinlist", { cache:"force-cache" });
      const d = await r.json() as {Data:Record<string,{ImageUrl?:string}>};
      _coinList = d.Data ?? {};
    }
    const entry = _coinList[symbol.toUpperCase()];
    if (entry?.ImageUrl) return "https://www.cryptocompare.com" + entry.ImageUrl;
  } catch { /* silent */ }
  return undefined;
}

// ── Main lookup ───────────────────────────────────────────────────────────────
export async function lookupEVMToken(
  address: string,
  networkId: string
): Promise<TokenInfo> {
  const chain = CHAIN_MAP[networkId];

  // 1. Try viem with the right RPC
  if (chain) {
    try {
      // Use viem's transport directly for raw RPC calls (avoids readContract type issues)
      const rpcUrl = chain.rpcUrls?.default?.http?.[0];
      if (rpcUrl) {
        const call = async (selector: string) => {
          const res = await fetch(rpcUrl, {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to:address,data:selector},"latest"]}),
            signal: AbortSignal.timeout(6000), cache: "no-store",
          });
          const j = await res.json() as {result?:string};
          return j.result ?? "0x";
        };

        const decStr = (hex: string): string => {
          if (!hex || hex === "0x") return "";
          const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
          if (clean.length < 128) return "";
          const len = parseInt(clean.slice(64, 128), 16);
          const data = clean.slice(128, 128 + len * 2);
          try { return decodeURIComponent(data.match(/.{1,2}/g)?.map(b => `%${b}`).join("") ?? ""); } catch { return ""; }
        };

        const [nameHex, symHex, decHex] = await Promise.all([
          call("0x06fdde03"), call("0x95d89b41"), call("0x313ce567"),
        ]);

        const sym = decStr(symHex);
        const nm  = decStr(nameHex);
        const dec = decHex && decHex !== "0x" ? parseInt(decHex, 16) : 18;

        if (sym) {
          const logo = await getCCLogo(sym);
          return { name: nm || sym, symbol: sym, decimals: isNaN(dec) ? 18 : dec, logo, source: "viem-rpc" };
        }
      }
    } catch { /* try next */ }
  }

  // 2. Try the network's Blockscout API (if available)
  const { NETWORKS } = await import("@/lib/circle-chains");
  const net = NETWORKS.find(n => n.id === networkId);
  if (net?.explorerApi) {
    try {
      const res = await fetch(`${net.explorerApi}/tokens/${address}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const d = await res.json() as Record<string,unknown>;
        if (d.symbol) {
          const logo = await getCCLogo(String(d.symbol));
          return { name: String(d.name??d.symbol), symbol: String(d.symbol), decimals: parseInt(String(d.decimals??"18")), logo, source: "blockscout" };
        }
      }
    } catch { /* try next */ }
  }

  // 3. DexScreener
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const d = await res.json() as { pairs?: Array<{ baseToken?: { symbol?:string; name?:string }; quoteToken?: { symbol?:string; name?:string } }> };
      const pair = d.pairs?.[0];
      const tok  = pair?.baseToken;
      if (tok?.symbol) {
        const logo = await getCCLogo(tok.symbol);
        return { name: tok.name??tok.symbol, symbol: tok.symbol, decimals: 18, logo, source: "dexscreener" };
      }
    }
  } catch { /* try next */ }

  // 4. Direct eth_call fallback via fetch
  const rpcUrl = chain?.rpcUrls?.default?.http?.[0] ?? net?.rpc;
  if (rpcUrl) {
    try {
      const call = async (data: string) => {
        const r = await fetch(rpcUrl, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to:address,data},"latest"]}),
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        const j = await r.json() as {result?:string};
        return j.result ?? "0x";
      };

      const decStr = (hex: string) => {
        if (!hex || hex === "0x") return "";
        const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
        if (clean.length < 128) return "";
        const len = parseInt(clean.slice(64,128), 16);
        const data = clean.slice(128, 128+len*2);
        try { return decodeURIComponent(data.match(/.{1,2}/g)?.map(b=>`%${b}`).join("")??""); } catch { return ""; }
      };

      const [symHex, nameHex, decHex] = await Promise.all([
        call("0x95d89b41"), call("0x06fdde03"), call("0x313ce567"),
      ]);

      const sym = decStr(symHex) || address.slice(2,8).toUpperCase();
      const nm  = decStr(nameHex) || sym;
      const dec = decHex && decHex !== "0x" ? parseInt(decHex, 16) : 18;
      const logo = await getCCLogo(sym);
      return { name: nm, symbol: sym, decimals: isNaN(dec)?18:dec, logo, source: "rpc-fallback" };
    } catch { /* fall through */ }
  }

  // 5. Manual fallback
  const sym = address.slice(2, 8).toUpperCase();
  const logo = await getCCLogo(sym);
  return { name: "Unknown Token", symbol: sym, decimals: 18, logo, source: "manual" };
}

// ── Non-EVM ecosystems (lookup only — no wallet interaction needed) ─────────
export async function lookupSolanaToken(mint: string): Promise<TokenInfo> {
  try {
    // Jupiter token list for Solana
    const res = await fetch(`https://token.jup.ag/all`, { signal: AbortSignal.timeout(6000), cache: "force-cache" });
    if (res.ok) {
      const tokens = await res.json() as Array<{address:string;symbol:string;name:string;decimals:number;logoURI?:string}>;
      const tok = tokens.find(t => t.address === mint);
      if (tok) {
        const logo = tok.logoURI || await getCCLogo(tok.symbol) || undefined;
        return { name: tok.name, symbol: tok.symbol, decimals: tok.decimals, logo, source: "jupiter" };
      }
    }
  } catch { /* try CryptoCompare */ }
  return { name: "Solana Token", symbol: mint.slice(0,6), decimals: 9, source: "manual" };
}

export async function lookupStellarToken(assetCode: string): Promise<TokenInfo> {
  const logo = await getCCLogo(assetCode);
  return { name: assetCode, symbol: assetCode, decimals: 7, logo, source: "stellar" };
}

// Convenience: detect chain type and route
export async function lookupToken(address: string, networkId: string): Promise<TokenInfo> {
  if (networkId.startsWith("solana")) return lookupSolanaToken(address);
  if (networkId.startsWith("stellar")) return lookupStellarToken(address);
  return lookupEVMToken(address, networkId);
}
