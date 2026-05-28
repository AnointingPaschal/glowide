import { createPublicClient, createWalletClient, http, defineChain } from "viem";

// ================================
// Arc Testnet Chain Configuration
// ================================
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

export const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// ================================
// Chain-specific token addresses
// ================================
export const ARC_TOKENS = {
  USDC: "0x0000000000000000000000000000000000000001", // Native USDC on Arc
  EURC: "0x0000000000000000000000000000000000000002",
  cirBTC: "0x0000000000000000000000000000000000000003",
} as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export async function getWalletBalance(address: string): Promise<{
  usdc: string;
  eurc: string;
  cirBTC: string;
  native: string;
}> {
  try {
    const nativeBalance = await arcPublicClient.getBalance({
      address: address as `0x${string}`,
    });

    // In production these would read from actual token contracts
    return {
      native: nativeBalance.toString(),
      usdc: "0",
      eurc: "0",
      cirBTC: "0",
    };
  } catch (err) {
    console.error("Error fetching balance:", err);
    return { native: "0", usdc: "0", eurc: "0", cirBTC: "0" };
  }
}

export async function getTransactionDetails(txHash: string) {
  try {
    const tx = await arcPublicClient.getTransaction({
      hash: txHash as `0x${string}`,
    });
    const receipt = await arcPublicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    return { tx, receipt };
  } catch (err) {
    console.error("Error fetching transaction:", err);
    return null;
  }
}

export async function getContractCode(address: string) {
  try {
    const code = await arcPublicClient.getBytecode({
      address: address as `0x${string}`,
    });
    return code;
  } catch (err) {
    console.error("Error fetching contract code:", err);
    return null;
  }
}

export function formatUSDC(amount: bigint, decimals = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  return `${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 2)}`;
}

export function parseUSDC(amount: string, decimals = 6): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction);
}
