// ══════════════════════════════════════════════════════════════════════════════
// Circle Network Registry — sourced from official Circle Developer Docs
// https://developers.circle.com/stablecoins/usdc-contract-addresses
// https://developers.circle.com/stablecoins/eurc-contract-addresses
// https://developers.circle.com/assets/cirbtc-contract-addresses
// https://developers.circle.com/tokenized/usyc/smart-contracts
// ══════════════════════════════════════════════════════════════════════════════

// ── Inline SVG logos — zero CORS, never fail ─────────────────────────────────
const S = (c: string) => `data:image/svg+xml,${encodeURIComponent(c)}`;
const circle  = (bg: string, text: string, fs = 13) =>
  S(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${bg}"/><text x="16" y="${fs < 14 ? 21 : 22}" font-size="${fs}" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial,sans-serif">${text}</text></svg>`);

export const LOGOS: Record<string, string> = {
  arc:      circle('#7C3AED','ARC'),
  eth:      circle('#627EEA','Ξ', 18),
  avax:     circle('#E84142','A', 18),
  op:       circle('#FF0420','OP'),
  arb:      circle('#2D374B','ARB'),
  base:     circle('#0052FF','B', 18),
  polygon:  circle('#8247E5','POL'),
  solana:   circle('#9945FF','◎', 16),
  stellar:  circle('#3E1BDB','✦', 16),
  sui:      circle('#4CA2FF','SUI'),
  aptos:    circle('#00BFD8','APT'),
  linea:    circle('#121212','LIN'),
  zksync:   circle('#4E529A','ZK'),
  starknet: circle('#EC796B','⬟', 16),
  celo:     circle('#FCFF52','C', 18),
  bsc:      circle('#F0B90B','BNB'),
  sonic:    circle('#FFA351','S', 18),
  monad:    circle('#836EF9','MON'),
  worldchain:circle('#1A1A2E','WC'),
  ink:      circle('#8B5CF6','INK'),
  unichain: circle('#FF007A','UNI'),
  xdc:      circle('#2187D0','XDC'),
  xrpl:     circle('#346AA9','XRP'),
  hedera:   circle('#00AAAD','ℏ', 16),
  near:     circle('#000000','NEAR', 11),
  algorand: circle('#000000','ALGO', 11),
  polkadot: circle('#E6007A','DOT'),
  sei:      circle('#9E1515','SEI'),
  noble:    circle('#6B21A8','NOB'),
  plume:    circle('#8B5CF6','PLM'),
  codex:    circle('#059669','CDX'),
  edge:     circle('#1E40AF','EDGE',11),
  pharos:   circle('#0EA5E9','PHR'),
  morph:    circle('#10B981','MRP'),
  hyperliquid: circle('#00B4D8','HL'),
  injective: circle('#00B4D8','INJ'),
  usdc:     circle('#2775CA','USDC',12),
  eurc:     circle('#1A56DB','€', 18),
  cirbtc:   circle('#F7931A','₿', 18),
  usyc:     circle('#047857','USYC',11),
};

export interface NetworkInfo {
  id: string;
  name: string;
  shortName: string;
  ecosystem: 'EVM' | 'SVM' | 'Stellar' | 'SUI' | 'Aptos' | 'Algorand' | 'NEAR' | 'Polkadot' | 'XRPL' | 'Hedera' | 'Cosmos' | 'Other';
  color: string;
  logo: string;
  testnet: boolean;
  chainId?: number;
  rpc?: string;
  explorer: string;
  explorerApi?: string; // Blockscout-compatible API
  cctpDomain?: number;
  cctpSupported: boolean;
  // Circle asset addresses on this network
  usdc?: string;
  eurc?: string;
  cirbtc?: string;
  usyc?: string;
}

export const NETWORKS: NetworkInfo[] = [
  // ── ARC ─────────────────────────────────────────────────────────────────────
  {
    id:'arc-testnet', name:'Arc Testnet', shortName:'Arc', ecosystem:'EVM', testnet:true,
    color:'#7C3AED', logo:LOGOS.arc, chainId:5042002,
    rpc:'https://rpc.testnet.arc.network',
    explorer:'https://testnet.arcscan.app',
    explorerApi:'https://testnet.arcscan.app/api/v2',
    cctpDomain:26, cctpSupported:true,
    usdc:'0x3600000000000000000000000000000000000000',
    eurc:'0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    cirbtc:'0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    usyc:'0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
  },
  // ── ETHEREUM ────────────────────────────────────────────────────────────────
  {
    id:'eth-mainnet', name:'Ethereum', shortName:'Ethereum', ecosystem:'EVM', testnet:false,
    color:'#627EEA', logo:LOGOS.eth, chainId:1,
    explorer:'https://etherscan.io',
    explorerApi:'https://eth.blockscout.com/api/v2',
    cctpDomain:0, cctpSupported:true,
    usdc:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    eurc:'0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
    usyc:'0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b',
  },
  {
    id:'eth-sepolia', name:'Ethereum Sepolia', shortName:'Sepolia', ecosystem:'EVM', testnet:true,
    color:'#627EEA', logo:LOGOS.eth, chainId:11155111,
    explorer:'https://sepolia.etherscan.io',
    explorerApi:'https://eth-sepolia.blockscout.com/api/v2',
    cctpDomain:0, cctpSupported:true,
    usdc:'0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    eurc:'0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
    cirbtc:'0x3a3fe695F684Bf9b9e43CF43C2b895Ea5e392bB3',
    usyc:'0x38D3A3f8717F4DB1CcB4Ad7D8C755919440848A3',
  },
  // ── AVALANCHE ────────────────────────────────────────────────────────────────
  {
    id:'avax-mainnet', name:'Avalanche', shortName:'Avalanche', ecosystem:'EVM', testnet:false,
    color:'#E84142', logo:LOGOS.avax, chainId:43114,
    explorer:'https://snowtrace.io',
    explorerApi:'https://avalanche.blockscout.com/api/v2',
    cctpDomain:1, cctpSupported:true,
    usdc:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    eurc:'0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD',
  },
  {
    id:'avax-fuji', name:'Avalanche Fuji', shortName:'Fuji', ecosystem:'EVM', testnet:true,
    color:'#E84142', logo:LOGOS.avax, chainId:43113,
    explorer:'https://testnet.snowtrace.io',
    cctpDomain:1, cctpSupported:true,
    usdc:'0x5425890298aed601595a70AB815c96711a31Bc65',
    eurc:'0x5E44db7996c682E92a960b65AC713a54AD815c6B',
  },
  // ── OPTIMISM ─────────────────────────────────────────────────────────────────
  {
    id:'op-mainnet', name:'OP Mainnet', shortName:'Optimism', ecosystem:'EVM', testnet:false,
    color:'#FF0420', logo:LOGOS.op, chainId:10,
    explorer:'https://optimistic.etherscan.io',
    explorerApi:'https://optimism.blockscout.com/api/v2',
    cctpDomain:2, cctpSupported:true,
    usdc:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  },
  {
    id:'op-sepolia', name:'OP Sepolia', shortName:'OP Sepolia', ecosystem:'EVM', testnet:true,
    color:'#FF0420', logo:LOGOS.op, chainId:11155420,
    explorer:'https://sepolia-optimism.etherscan.io',
    cctpDomain:2, cctpSupported:true,
    usdc:'0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  },
  // ── ARBITRUM ─────────────────────────────────────────────────────────────────
  {
    id:'arb-mainnet', name:'Arbitrum One', shortName:'Arbitrum', ecosystem:'EVM', testnet:false,
    color:'#2D374B', logo:LOGOS.arb, chainId:42161,
    explorer:'https://arbiscan.io',
    explorerApi:'https://arbitrum.blockscout.com/api/v2',
    cctpDomain:3, cctpSupported:true,
    usdc:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  {
    id:'arb-sepolia', name:'Arbitrum Sepolia', shortName:'Arb Sepolia', ecosystem:'EVM', testnet:true,
    color:'#2D374B', logo:LOGOS.arb, chainId:421614,
    explorer:'https://sepolia.arbiscan.io',
    cctpDomain:3, cctpSupported:true,
    usdc:'0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  // ── BASE ─────────────────────────────────────────────────────────────────────
  {
    id:'base-mainnet', name:'Base', shortName:'Base', ecosystem:'EVM', testnet:false,
    color:'#0052FF', logo:LOGOS.base, chainId:8453,
    explorer:'https://basescan.org',
    explorerApi:'https://base.blockscout.com/api/v2',
    cctpDomain:6, cctpSupported:true,
    usdc:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    eurc:'0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
  },
  {
    id:'base-sepolia', name:'Base Sepolia', shortName:'Base Sepolia', ecosystem:'EVM', testnet:true,
    color:'#0052FF', logo:LOGOS.base, chainId:84532,
    explorer:'https://base-sepolia.blockscout.com',
    explorerApi:'https://base-sepolia.blockscout.com/api/v2',
    cctpDomain:6, cctpSupported:true,
    usdc:'0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    eurc:'0x808456652fdb597867f38412077A9182bf77359F',
  },
  // ── POLYGON ──────────────────────────────────────────────────────────────────
  {
    id:'polygon-mainnet', name:'Polygon PoS', shortName:'Polygon', ecosystem:'EVM', testnet:false,
    color:'#8247E5', logo:LOGOS.polygon, chainId:137,
    explorer:'https://polygonscan.com',
    explorerApi:'https://polygon.blockscout.com/api/v2',
    cctpDomain:7, cctpSupported:true,
    usdc:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  {
    id:'polygon-amoy', name:'Polygon Amoy', shortName:'Amoy', ecosystem:'EVM', testnet:true,
    color:'#8247E5', logo:LOGOS.polygon, chainId:80002,
    explorer:'https://amoy.polygonscan.com',
    cctpDomain:7, cctpSupported:true,
    usdc:'0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  },
  // ── LINEA ─────────────────────────────────────────────────────────────────────
  {
    id:'linea-mainnet', name:'Linea', shortName:'Linea', ecosystem:'EVM', testnet:false,
    color:'#121212', logo:LOGOS.linea, chainId:59144,
    explorer:'https://lineascan.build',
    explorerApi:'https://linea.blockscout.com/api/v2',
    cctpDomain:11, cctpSupported:true,
    usdc:'0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  },
  {
    id:'linea-sepolia', name:'Linea Sepolia', shortName:'Linea Sep', ecosystem:'EVM', testnet:true,
    color:'#121212', logo:LOGOS.linea, chainId:59141,
    explorer:'https://sepolia.lineascan.build',
    cctpDomain:11, cctpSupported:true,
    usdc:'0xFEce4462D57bD51A6A552365A011b95f0E16d9B7',
  },
  // ── SOLANA ────────────────────────────────────────────────────────────────────
  {
    id:'solana-mainnet', name:'Solana', shortName:'Solana', ecosystem:'SVM', testnet:false,
    color:'#9945FF', logo:LOGOS.solana,
    explorer:'https://solscan.io',
    cctpDomain:5, cctpSupported:true,
    usdc:'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    eurc:'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
    usyc:'7LWanZteUKtvFjv4MHYgKXXdAuCQYFPJysL9pxxdRQGn',
  },
  {
    id:'solana-devnet', name:'Solana Devnet', shortName:'Sol Devnet', ecosystem:'SVM', testnet:true,
    color:'#9945FF', logo:LOGOS.solana,
    explorer:'https://explorer.solana.com?cluster=devnet',
    cctpDomain:5, cctpSupported:true,
    usdc:'4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    eurc:'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
    usyc:'7WkaBNxz6jpJWGLPNFNsUbuVH8iQ2FxBooMak6itUMWb',
  },
  // ── STELLAR ───────────────────────────────────────────────────────────────────
  {
    id:'stellar-mainnet', name:'Stellar', shortName:'Stellar', ecosystem:'Stellar', testnet:false,
    color:'#3E1BDB', logo:LOGOS.stellar,
    explorer:'https://stellar.expert',
    cctpDomain:4, cctpSupported:true,
    usdc:'USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    eurc:'EURC-GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
  },
  {
    id:'stellar-testnet', name:'Stellar Testnet', shortName:'Stellar Test', ecosystem:'Stellar', testnet:true,
    color:'#3E1BDB', logo:LOGOS.stellar,
    explorer:'https://stellar.expert/explorer/testnet',
    cctpDomain:4, cctpSupported:true,
    usdc:'USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    eurc:'EURC-GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
  },
  // ── SUI ───────────────────────────────────────────────────────────────────────
  {
    id:'sui-mainnet', name:'SUI', shortName:'SUI', ecosystem:'SUI', testnet:false,
    color:'#4CA2FF', logo:LOGOS.sui,
    explorer:'https://suiscan.xyz/mainnet',
    cctpDomain:8, cctpSupported:false,
    usdc:'0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  },
  {
    id:'sui-testnet', name:'SUI Testnet', shortName:'SUI Test', ecosystem:'SUI', testnet:true,
    color:'#4CA2FF', logo:LOGOS.sui,
    explorer:'https://suiscan.xyz/testnet',
    cctpDomain:8, cctpSupported:false,
    usdc:'0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
  },
  // ── APTOS ─────────────────────────────────────────────────────────────────────
  {
    id:'aptos-mainnet', name:'Aptos', shortName:'Aptos', ecosystem:'Aptos', testnet:false,
    color:'#00BFD8', logo:LOGOS.aptos,
    explorer:'https://explorer.aptoslabs.com',
    cctpDomain:9, cctpSupported:false,
    usdc:'0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
  },
  {
    id:'aptos-testnet', name:'Aptos Testnet', shortName:'Aptos Test', ecosystem:'Aptos', testnet:true,
    color:'#00BFD8', logo:LOGOS.aptos,
    explorer:'https://explorer.aptoslabs.com?network=testnet',
    cctpDomain:9, cctpSupported:false,
    usdc:'0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832',
  },
  // ── STARKNET ──────────────────────────────────────────────────────────────────
  {
    id:'starknet-mainnet', name:'Starknet', shortName:'Starknet', ecosystem:'Other', testnet:false,
    color:'#EC796B', logo:LOGOS.starknet,
    explorer:'https://voyager.online',
    cctpDomain:23, cctpSupported:false,
    usdc:'0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb',
  },
  {
    id:'starknet-sepolia', name:'Starknet Sepolia', shortName:'Stark Sep', ecosystem:'Other', testnet:true,
    color:'#EC796B', logo:LOGOS.starknet,
    explorer:'https://sepolia.voyager.online',
    cctpDomain:23, cctpSupported:false,
    usdc:'0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343',
  },
  // ── CELO ──────────────────────────────────────────────────────────────────────
  {
    id:'celo-mainnet', name:'Celo', shortName:'Celo', ecosystem:'EVM', testnet:false,
    color:'#FCFF52', logo:LOGOS.celo, chainId:42220,
    explorer:'https://celoscan.io',
    explorerApi:'https://celo.blockscout.com/api/v2',
    cctpDomain:14, cctpSupported:true,
    usdc:'0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  },
  {
    id:'celo-sepolia', name:'Celo Sepolia', shortName:'Celo Sep', ecosystem:'EVM', testnet:true,
    color:'#FCFF52', logo:LOGOS.celo, chainId:44787,
    explorer:'https://celo-sepolia.blockscout.com',
    explorerApi:'https://celo-sepolia.blockscout.com/api/v2',
    cctpDomain:14, cctpSupported:true,
    usdc:'0x01C5C0122039549AD1493B8220cABEdD739BC44E',
  },
  // ── BSC ───────────────────────────────────────────────────────────────────────
  {
    id:'bsc-mainnet', name:'BNB Smart Chain', shortName:'BSC', ecosystem:'EVM', testnet:false,
    color:'#F0B90B', logo:LOGOS.bsc, chainId:56,
    explorer:'https://bscscan.com',
    explorerApi:'https://bsc.blockscout.com/api/v2',
    cctpDomain:4, cctpSupported:false,
    usyc:'0x8D0fA28f221eB5735BC71d3a0Da67EE5bC821311',
  },
  {
    id:'bsc-testnet', name:'BSC Testnet', shortName:'BSC Test', ecosystem:'EVM', testnet:true,
    color:'#F0B90B', logo:LOGOS.bsc, chainId:97,
    explorer:'https://testnet.bscscan.com',
    cctpDomain:4, cctpSupported:false,
    usyc:'0x109656Aba6F175c634c63C9874f29CeAAAB8E606',
  },
  // ── ZKSYNC ────────────────────────────────────────────────────────────────────
  {
    id:'zksync-mainnet', name:'ZKsync Era', shortName:'ZKsync', ecosystem:'EVM', testnet:false,
    color:'#4E529A', logo:LOGOS.zksync, chainId:324,
    explorer:'https://explorer.zksync.io',
    explorerApi:'https://zksync.blockscout.com/api/v2',
    cctpDomain:15, cctpSupported:true,
    usdc:'0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4',
  },
  {
    id:'zksync-testnet', name:'ZKsync Sepolia', shortName:'ZK Sepolia', ecosystem:'EVM', testnet:true,
    color:'#4E529A', logo:LOGOS.zksync, chainId:300,
    explorer:'https://sepolia.explorer.zksync.io',
    cctpDomain:15, cctpSupported:true,
    usdc:'0xAe045DE5638162fa134807Cb558E15A3F5A7F853',
  },
  // ── SONIC ─────────────────────────────────────────────────────────────────────
  {
    id:'sonic-mainnet', name:'Sonic', shortName:'Sonic', ecosystem:'EVM', testnet:false,
    color:'#FFA351', logo:LOGOS.sonic, chainId:146,
    explorer:'https://sonicscan.org',
    cctpDomain:18, cctpSupported:false,
    usdc:'0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
  },
  {
    id:'sonic-testnet', name:'Sonic Testnet', shortName:'Sonic Test', ecosystem:'EVM', testnet:true,
    color:'#FFA351', logo:LOGOS.sonic,
    explorer:'https://testnet.sonicscan.org',
    cctpDomain:18, cctpSupported:false,
    usdc:'0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51',
  },
  // ── MONAD ─────────────────────────────────────────────────────────────────────
  {
    id:'monad-testnet', name:'Monad Testnet', shortName:'Monad', ecosystem:'EVM', testnet:true,
    color:'#836EF9', logo:LOGOS.monad, chainId:10143,
    explorer:'https://testnet.monadexplorer.com',
    cctpDomain:30, cctpSupported:false,
    usdc:'0x534b2f3A21130d7a60830c2Df862319e593943A3',
  },
  // ── WORLD CHAIN ───────────────────────────────────────────────────────────────
  {
    id:'worldchain-mainnet', name:'World Chain', shortName:'World', ecosystem:'EVM', testnet:false,
    color:'#1A1A2E', logo:LOGOS.worldchain, chainId:480,
    explorer:'https://worldscan.org',
    cctpDomain:24, cctpSupported:false,
    usdc:'0x79A02482A880bCe3F13E09da970dC34dB4cD24D1',
    eurc:'0x1C60ba0A0eD1019e8Eb035E6daF4155A5cE2380B',
  },
  {
    id:'worldchain-sepolia', name:'World Chain Sepolia', shortName:'World Sep', ecosystem:'EVM', testnet:true,
    color:'#1A1A2E', logo:LOGOS.worldchain,
    explorer:'https://sepolia.worldscan.org',
    cctpDomain:24, cctpSupported:false,
    usdc:'0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88',
    eurc:'0xe479EcA5740Ac65d6E1823bea2f1C08Bc14e954F',
  },
  // ── UNICHAIN ──────────────────────────────────────────────────────────────────
  {
    id:'unichain-mainnet', name:'Unichain', shortName:'Unichain', ecosystem:'EVM', testnet:false,
    color:'#FF007A', logo:LOGOS.unichain, chainId:1301,
    explorer:'https://uniscan.xyz',
    explorerApi:'https://unichain.blockscout.com/api/v2',
    cctpDomain:10, cctpSupported:true,
    usdc:'0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  },
  {
    id:'unichain-sepolia', name:'Unichain Sepolia', shortName:'Uni Sep', ecosystem:'EVM', testnet:true,
    color:'#FF007A', logo:LOGOS.unichain,
    explorer:'https://unichain-sepolia.blockscout.com',
    explorerApi:'https://unichain-sepolia.blockscout.com/api/v2',
    cctpDomain:10, cctpSupported:true,
    usdc:'0x31d0220469e10c4E71834a79b1f276d740d3768F',
  },
  // ── HEDERA ────────────────────────────────────────────────────────────────────
  {
    id:'hedera-mainnet', name:'Hedera', shortName:'Hedera', ecosystem:'EVM', testnet:false,
    color:'#00AAAD', logo:LOGOS.hedera, chainId:295,
    explorer:'https://hashscan.io/mainnet',
    cctpDomain:25, cctpSupported:false,
    usdc:'0.0.456858',
  },
  {
    id:'hedera-testnet', name:'Hedera Testnet', shortName:'Hedera Test', ecosystem:'EVM', testnet:true,
    color:'#00AAAD', logo:LOGOS.hedera, chainId:296,
    explorer:'https://hashscan.io/testnet',
    cctpDomain:25, cctpSupported:false,
    usdc:'0.0.429274',
  },
  // ── INJECTIVE ─────────────────────────────────────────────────────────────────
  {
    id:'injective-mainnet', name:'Injective', shortName:'Injective', ecosystem:'EVM', testnet:false,
    color:'#00B4D8', logo:LOGOS.injective,
    explorer:'https://blockscout.injective.network',
    explorerApi:'https://blockscout.injective.network/api/v2',
    cctpDomain:12, cctpSupported:false,
    usdc:'0xa00C59fF5a080D2b954d0c75e46E22a0c371235a',
  },
  {
    id:'injective-testnet', name:'Injective Testnet', shortName:'Inj Test', ecosystem:'EVM', testnet:true,
    color:'#00B4D8', logo:LOGOS.injective,
    explorer:'https://testnet.blockscout.injective.network',
    explorerApi:'https://testnet.blockscout.injective.network/api/v2',
    cctpDomain:12, cctpSupported:false,
    usdc:'0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
  },
  // ── INK ───────────────────────────────────────────────────────────────────────
  {
    id:'ink-mainnet', name:'Ink', shortName:'Ink', ecosystem:'EVM', testnet:false,
    color:'#8B5CF6', logo:LOGOS.ink, chainId:57073,
    explorer:'https://explorer.inkonchain.com',
    explorerApi:'https://explorer.inkonchain.com/api/v2',
    cctpDomain:16, cctpSupported:false,
    usdc:'0x2D270e6886d130D724215A266106e6832161EAEd',
  },
  {
    id:'ink-testnet', name:'Ink Testnet', shortName:'Ink Test', ecosystem:'EVM', testnet:true,
    color:'#8B5CF6', logo:LOGOS.ink,
    explorer:'https://explorer-sepolia.inkonchain.com',
    explorerApi:'https://explorer-sepolia.inkonchain.com/api/v2',
    cctpDomain:16, cctpSupported:false,
    usdc:'0xFabab97dCE620294D2B0b0e46C68964e326300Ac',
  },
  // ── SEI ───────────────────────────────────────────────────────────────────────
  {
    id:'sei-mainnet', name:'Sei', shortName:'Sei', ecosystem:'EVM', testnet:false,
    color:'#9E1515', logo:LOGOS.sei,
    explorer:'https://seiscan.io',
    cctpDomain:27, cctpSupported:false,
    usdc:'0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
  },
  // ── XRPL ─────────────────────────────────────────────────────────────────────
  {
    id:'xrpl-mainnet', name:'XRPL', shortName:'XRPL', ecosystem:'XRPL', testnet:false,
    color:'#346AA9', logo:LOGOS.xrpl,
    explorer:'https://livenet.xrpl.org',
    cctpDomain:13, cctpSupported:false,
    usdc:'5553444300000000000000000000000000000000.rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE',
  },
];

// ── Convenience exports ────────────────────────────────────────────────────────
export const EVM_NETWORKS     = NETWORKS.filter(n => n.ecosystem === 'EVM');
export const TESTNET_NETWORKS = NETWORKS.filter(n => n.testnet);
export const MAINNET_NETWORKS = NETWORKS.filter(n => !n.testnet);
export const CCTP_CHAINS      = NETWORKS.filter(n => n.cctpSupported);
// Legacy compat
export const CIRCLE_CHAINS    = NETWORKS;

export const ARC_TESTNET = NETWORKS.find(n => n.id === 'arc-testnet')!;

export const ARC_CONTRACTS = {
  USDC_ERC20:          '0x3600000000000000000000000000000000000000',
  EURC:                '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  CIRBTC:              '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
  USYC:                '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
  TOKEN_MESSENGER_V2:  '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  MESSAGE_TRANSMITTER: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  GATEWAY_WALLET:      '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
  ARC_CCTP_DOMAIN:     26,
};

// Legacy CIRCLE_ASSETS compat
export const CIRCLE_ASSETS = {
  USDC:   { name:'USD Coin',        symbol:'USDC',   decimals:6,  nativeDecimals:18, address:ARC_CONTRACTS.USDC_ERC20, logo:LOGOS.usdc,   color:'#2775CA', description:'Native gas token on Arc Testnet' },
  EURC:   { name:'Euro Coin',       symbol:'EURC',   decimals:6,  nativeDecimals:6,  address:ARC_CONTRACTS.EURC,       logo:LOGOS.eurc,   color:'#1A56DB', description:'Euro stablecoin by Circle' },
  cirBTC: { name:'Circle Bitcoin',  symbol:'cirBTC', decimals:8,  nativeDecimals:8,  address:ARC_CONTRACTS.CIRBTC,     logo:LOGOS.cirbtc, color:'#F7931A', description:'Circle-wrapped Bitcoin' },
};
