// ── Arc Testnet Contract Addresses (from docs.arc.io/arc/references/contract-addresses) ──
export const ARC_CONTRACTS = {
  USDC_ERC20:          '0x3600000000000000000000000000000000000000', // 6 decimals ERC-20
  EURC:                '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', // 6 decimals
  USYC:                '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
  TOKEN_MESSENGER_V2:  '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  MESSAGE_TRANSMITTER: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  GATEWAY_WALLET:      '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
  ARC_CCTP_DOMAIN:     26,  // Arc Testnet domain (not 9)
};

// ── Inline SVG data URIs — no CORS, always loads ─────────────────────────────
const SVG = (content: string) =>
  `data:image/svg+xml,${encodeURIComponent(content)}`;

const LOGOS = {
  arc:      SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#7C3AED"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">ARC</text></svg>'),
  eth:      SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#627EEA"/><text x="16" y="22" font-size="16" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">Ξ</text></svg>'),
  avax:     SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#E84142"/><text x="16" y="22" font-size="14" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">A</text></svg>'),
  op:       SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#FF0420"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">OP</text></svg>'),
  arb:      SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2D374B"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">ARB</text></svg>'),
  base:     SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#0052FF"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">BASE</text></svg>'),
  polygon:  SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#8247E5"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">POL</text></svg>'),
  solana:   SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#9945FF"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">SOL</text></svg>'),
  stellar:  SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#3E1BDB"/><text x="16" y="21" font-size="16" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">✦</text></svg>'),
  sui:      SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#4CA2FF"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">SUI</text></svg>'),
  aptos:    SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#00BFD8"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">APT</text></svg>'),
  linea:    SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#121212"/><text x="16" y="22" font-size="13" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">LIN</text></svg>'),
  usdc:     SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2775CA"/><text x="16" y="22" font-size="12" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">USDC</text></svg>'),
  eurc:     SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1A56DB"/><text x="16" y="22" font-size="18" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">€</text></svg>'),
  btc:      SVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F7931A"/><text x="16" y="22" font-size="16" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">₿</text></svg>'),
};

export interface CircleChain {
  id: string; name: string; shortName: string; ecosystem: string;
  cctpDomain: number; cctpSupported: boolean;
  color: string; logo: string;
  chainId?: number; testnet?: boolean;
}

export const CIRCLE_CHAINS: CircleChain[] = [
  { id:'arc-testnet',    name:'Arc Testnet',        shortName:'Arc',      ecosystem:'EVM',     cctpDomain:26, cctpSupported:true,  color:'#7C3AED', logo:LOGOS.arc,     chainId:5042002, testnet:true  },
  { id:'eth-sepolia',    name:'Ethereum Sepolia',   shortName:'Ethereum', ecosystem:'EVM',     cctpDomain:0,  cctpSupported:true,  color:'#627EEA', logo:LOGOS.eth                                     },
  { id:'avax-fuji',      name:'Avalanche Fuji',     shortName:'Avalanche',ecosystem:'EVM',     cctpDomain:1,  cctpSupported:true,  color:'#E84142', logo:LOGOS.avax                                    },
  { id:'op-sepolia',     name:'OP Sepolia',         shortName:'Optimism', ecosystem:'EVM',     cctpDomain:2,  cctpSupported:true,  color:'#FF0420', logo:LOGOS.op                                      },
  { id:'arb-sepolia',    name:'Arbitrum Sepolia',   shortName:'Arbitrum', ecosystem:'EVM',     cctpDomain:3,  cctpSupported:true,  color:'#2D374B', logo:LOGOS.arb                                     },
  { id:'base-sepolia',   name:'Base Sepolia',       shortName:'Base',     ecosystem:'EVM',     cctpDomain:6,  cctpSupported:true,  color:'#0052FF', logo:LOGOS.base                                    },
  { id:'polygon-amoy',   name:'Polygon Amoy',       shortName:'Polygon',  ecosystem:'EVM',     cctpDomain:7,  cctpSupported:true,  color:'#8247E5', logo:LOGOS.polygon                                 },
  { id:'linea-sepolia',  name:'Linea Sepolia',      shortName:'Linea',    ecosystem:'EVM',     cctpDomain:11, cctpSupported:true,  color:'#121212', logo:LOGOS.linea                                   },
  { id:'solana-devnet',  name:'Solana Devnet',      shortName:'Solana',   ecosystem:'Solana',  cctpDomain:5,  cctpSupported:true,  color:'#9945FF', logo:LOGOS.solana                                  },
  { id:'stellar-testnet',name:'Stellar Testnet',    shortName:'Stellar',  ecosystem:'Stellar', cctpDomain:4,  cctpSupported:true,  color:'#3E1BDB', logo:LOGOS.stellar                                 },
  { id:'sui-testnet',    name:'SUI Testnet',        shortName:'SUI',      ecosystem:'SUI',     cctpDomain:8,  cctpSupported:false, color:'#4CA2FF', logo:LOGOS.sui                                     },
  { id:'aptos-testnet',  name:'Aptos Testnet',      shortName:'Aptos',    ecosystem:'Aptos',   cctpDomain:9,  cctpSupported:false, color:'#00BFD8', logo:LOGOS.aptos                                   },
];

export const CCTP_CHAINS = CIRCLE_CHAINS.filter(c => c.cctpSupported);

// ── Circle assets with real Arc Testnet addresses ─────────────────────────────
export const CIRCLE_ASSETS = {
  USDC: {
    name: "USD Coin", symbol: "USDC", decimals: 6,
    address: ARC_CONTRACTS.USDC_ERC20,
    nativeDecimals: 18, // native gas uses 18 decimals
    logo: LOGOS.usdc, color: "#2775CA",
    description: "Native gas token on Arc Testnet (18 dec native, 6 dec ERC-20)",
  },
  EURC: {
    name: "Euro Coin", symbol: "EURC", decimals: 6,
    address: ARC_CONTRACTS.EURC,
    nativeDecimals: 6,
    logo: LOGOS.eurc, color: "#1A56DB",
    description: "Euro stablecoin — 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  },
  cirBTC: {
    name: "cirBTC (coming soon)", symbol: "cirBTC", decimals: 8,
    address: null, // Not yet deployed on Arc Testnet
    nativeDecimals: 8,
    logo: LOGOS.btc, color: "#F7931A",
    description: "Not yet deployed on Arc Testnet",
  },
};
