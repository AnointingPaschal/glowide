// ── Circle CCTP Supported Networks ─────────────────────────────────────────
// Source: https://developers.circle.com/stablecoins/usdc-contract-addresses
// CCTP supported: https://developers.circle.com/cctp/cctp-supported-blockchains

export type ChainEcosystem = "EVM" | "Solana" | "Aptos" | "Starknet" | "SUI" | "Stellar" | "XRPL";

export interface ChainConfig {
  id: string;
  name: string;
  ecosystem: ChainEcosystem;
  chainId?: number;           // EVM chain ID
  testnet: boolean;
  usdc: string;               // USDC contract/address
  eurc?: string;              // EURC contract/address
  cirBTC?: string;            // cirBTC (Arc Testnet native)
  rpc?: string;
  explorer: string;
  nativeCurrency: { symbol: string; decimals: number };
  cctpDomain?: number;        // CCTP domain ID
  cctpSupported: boolean;
  color: string;
  logoUrl: string;
}

export const CIRCLE_CHAINS: ChainConfig[] = [
  // ── Arc Testnet (primary — USDC is gas token) ──────────────────────────
  {
    id: "arc-testnet", name: "Arc Testnet", ecosystem: "EVM", chainId: 5042002, testnet: true,
    usdc: "0x3600000000000000000000000000000000000000",
    eurc: "0x3700000000000000000000000000000000000000",
    cirBTC: "0x3800000000000000000000000000000000000000",
    rpc: "https://rpc.testnet.arc.network",
    explorer: "https://testnet.arcscan.app",
    nativeCurrency: { symbol: "USDC", decimals: 6 },
    cctpDomain: 9, cctpSupported: true,
    color: "#7c3aed", logoUrl: "https://testnet.arcscan.app/images/arc-logo.png",
  },
  // ── EVM Testnets with CCTP ─────────────────────────────────────────────
  {
    id: "eth-sepolia", name: "Ethereum Sepolia", ecosystem: "EVM", chainId: 11155111, testnet: true,
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    rpc: "https://rpc.sepolia.org", explorer: "https://sepolia.etherscan.io",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    cctpDomain: 0, cctpSupported: true,
    color: "#627EEA", logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  },
  {
    id: "base-sepolia", name: "Base Sepolia", ecosystem: "EVM", chainId: 84532, testnet: true,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    rpc: "https://sepolia.base.org", explorer: "https://base-sepolia.blockscout.com",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    cctpDomain: 6, cctpSupported: true,
    color: "#0052FF", logoUrl: "https://cryptologos.cc/logos/base-base-logo.svg",
  },
  {
    id: "arbitrum-sepolia", name: "Arbitrum Sepolia", ecosystem: "EVM", chainId: 421614, testnet: true,
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc", explorer: "https://sepolia.arbiscan.io",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    cctpDomain: 3, cctpSupported: true,
    color: "#28A0F0", logoUrl: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg",
  },
  {
    id: "op-sepolia", name: "OP Sepolia", ecosystem: "EVM", chainId: 11155420, testnet: true,
    usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    rpc: "https://sepolia.optimism.io", explorer: "https://sepolia-optimism.etherscan.io",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    cctpDomain: 2, cctpSupported: true,
    color: "#FF0420", logoUrl: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg",
  },
  {
    id: "avax-fuji", name: "Avalanche Fuji", ecosystem: "EVM", chainId: 43113, testnet: true,
    usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
    rpc: "https://api.avax-test.network/ext/bc/C/rpc", explorer: "https://testnet.snowtrace.io",
    nativeCurrency: { symbol: "AVAX", decimals: 18 },
    cctpDomain: 1, cctpSupported: true,
    color: "#E84142", logoUrl: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
  },
  {
    id: "polygon-amoy", name: "Polygon Amoy", ecosystem: "EVM", chainId: 80002, testnet: true,
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    rpc: "https://rpc-amoy.polygon.technology", explorer: "https://amoy.polygonscan.com",
    nativeCurrency: { symbol: "MATIC", decimals: 18 },
    cctpDomain: 7, cctpSupported: true,
    color: "#8247E5", logoUrl: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
  },
  // ── Non-EVM Testnets ───────────────────────────────────────────────────
  {
    id: "solana-devnet", name: "Solana Devnet", ecosystem: "Solana", testnet: true,
    usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    explorer: "https://explorer.solana.com/?cluster=devnet",
    nativeCurrency: { symbol: "SOL", decimals: 9 },
    cctpDomain: 5, cctpSupported: true,
    color: "#9945FF", logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.svg",
  },
  {
    id: "aptos-testnet", name: "Aptos Testnet", ecosystem: "Aptos", testnet: true,
    usdc: "0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832",
    explorer: "https://explorer.aptoslabs.com/?network=testnet",
    nativeCurrency: { symbol: "APT", decimals: 8 },
    cctpSupported: false,
    color: "#00D4A8", logoUrl: "https://cryptologos.cc/logos/aptos-apt-logo.svg",
  },
  {
    id: "starknet-sepolia", name: "Starknet Sepolia", ecosystem: "Starknet", testnet: true,
    usdc: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
    explorer: "https://sepolia.voyager.online",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    cctpSupported: false,
    color: "#EC796B", logoUrl: "https://cryptologos.cc/logos/starknet-strk-logo.svg",
  },
  {
    id: "sui-testnet", name: "SUI Testnet", ecosystem: "SUI", testnet: true,
    usdc: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
    explorer: "https://suiscan.xyz/testnet",
    nativeCurrency: { symbol: "SUI", decimals: 9 },
    cctpSupported: false,
    color: "#4DA2FF", logoUrl: "https://cryptologos.cc/logos/sui-sui-logo.svg",
  },
  {
    id: "stellar-testnet", name: "Stellar Testnet", ecosystem: "Stellar", testnet: true,
    usdc: "USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    explorer: "https://stellar.expert/explorer/testnet",
    nativeCurrency: { symbol: "XLM", decimals: 7 },
    cctpDomain: 4, cctpSupported: true,
    color: "#3E1BDB", logoUrl: "https://cryptologos.cc/logos/stellar-xlm-logo.svg",
  },
  {
    id: "xrpl-testnet", name: "XRPL Testnet", ecosystem: "XRPL", testnet: true,
    usdc: "5553444300000000000000000000000000000000.rHuGNhqTG32mfmAvWA8hUyWRLV3tCSwKQt",
    explorer: "https://testnet.xrpl.org",
    nativeCurrency: { symbol: "XRP", decimals: 6 },
    cctpSupported: false,
    color: "#00AAE4", logoUrl: "https://cryptologos.cc/logos/xrp-xrp-logo.svg",
  },
];

// CCTP supported chains only
export const CCTP_CHAINS = CIRCLE_CHAINS.filter(c => c.cctpSupported);

// EVM chains only
export const EVM_CHAINS = CIRCLE_CHAINS.filter(c => c.ecosystem === "EVM");

// Get chain by ID
export function getChain(id: string): ChainConfig | undefined {
  return CIRCLE_CHAINS.find(c => c.id === id);
}

// CCTP domain map for cross-chain transfers
export const CCTP_DOMAIN_MAP: Record<number, string> = {
  0: "Ethereum", 1: "Avalanche", 2: "OP Mainnet", 3: "Arbitrum",
  4: "Stellar", 5: "Solana", 6: "Base", 7: "Polygon", 9: "Arc Testnet",
};

// Circle official asset logos
export const CIRCLE_ASSETS = {
  USDC: {
    name: "USD Coin", symbol: "USDC", decimals: 6,
    logo: "https://www.circle.com/hubfs/USDC/USDC_icon_1.svg",
    fallbackLogo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
    color: "#2775CA",
    description: "Digital dollar by Circle — gas token on Arc Testnet",
  },
  EURC: {
    name: "Euro Coin", symbol: "EURC", decimals: 6,
    logo: "https://www.circle.com/hubfs/EURC/EURC_icon.svg",
    fallbackLogo: "https://cryptologos.cc/logos/euro-coin-eurc-logo.svg",
    color: "#1A56DB",
    description: "MiCA-compliant Euro stablecoin by Circle",
  },
  cirBTC: {
    name: "Circle Bitcoin", symbol: "cirBTC", decimals: 8,
    logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
    fallbackLogo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
    color: "#F7931A",
    description: "Bitcoin wrapped by Circle on Arc Testnet",
  },
};
