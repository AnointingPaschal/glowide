/**
 * Circle Paymaster — pay gas in USDC instead of native tokens
 * https://developers.circle.com/paymaster
 *
 * Circle Paymaster is a permissionless onchain ERC-4337 contract.
 * No API key needed — direct contract calls.
 *
 * Supported chains (v0.8): ARB, AVAX, BASE, ETH, OP, POLYGON, UNICHAIN
 * 10% surcharge on ARB and BASE.
 */

export const PAYMASTER_CONTRACTS: Record<string, {
  paymasterV07: string;
  paymasterV08: string;
  entrypointV07: string;
  entrypointV08: string;
  usdcToken: string;
  chainName: string;
}> = {
  // Arbitrum
  "42161": {
    paymasterV07:  "0x41a37F2D8e603a70d3bE70d7e2f9EEC025A55c37",
    paymasterV08:  "0x9Ab31df67Ad7B7c02D2a4a9D13f3B9f34Ac97A6F",
    entrypointV07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    entrypointV08: "0x4337084D9E255Ff04702E20b9d30E3b3b5db19E3",
    usdcToken:     "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    chainName: "Arbitrum",
  },
  // Base
  "8453": {
    paymasterV07:  "0x41a37F2D8e603a70d3bE70d7e2f9EEC025A55c37",
    paymasterV08:  "0x9Ab31df67Ad7B7c02D2a4a9D13f3B9f34Ac97A6F",
    entrypointV07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    entrypointV08: "0x4337084D9E255Ff04702E20b9d30E3b3b5db19E3",
    usdcToken:     "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chainName: "Base",
  },
  // Ethereum
  "1": {
    paymasterV07:  "0x41a37F2D8e603a70d3bE70d7e2f9EEC025A55c37",
    paymasterV08:  "0x9Ab31df67Ad7B7c02D2a4a9D13f3B9f34Ac97A6F",
    entrypointV07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    entrypointV08: "0x4337084D9E255Ff04702E20b9d30E3b3b5db19E3",
    usdcToken:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chainName: "Ethereum",
  },
  // Optimism
  "10": {
    paymasterV07:  "0x41a37F2D8e603a70d3bE70d7e2f9EEC025A55c37",
    paymasterV08:  "0x9Ab31df67Ad7B7c02D2a4a9D13f3B9f34Ac97A6F",
    entrypointV07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    entrypointV08: "0x4337084D9E255Ff04702E20b9d30E3b3b5db19E3",
    usdcToken:     "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    chainName: "Optimism",
  },
  // Polygon
  "137": {
    paymasterV07:  "0x41a37F2D8e603a70d3bE70d7e2f9EEC025A55c37",
    paymasterV08:  "0x9Ab31df67Ad7B7c02D2a4a9D13f3B9f34Ac97A6F",
    entrypointV07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    entrypointV08: "0x4337084D9E255Ff04702E20b9d30E3b3b5db19E3",
    usdcToken:     "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    chainName: "Polygon",
  },
  // Avalanche
  "43114": {
    paymasterV07:  "0x41a37F2D8e603a70d3bE70d7e2f9EEC025A55c37",
    paymasterV08:  "0x9Ab31df67Ad7B7c02D2a4a9D13f3B9f34Ac97A6F",
    entrypointV07: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    entrypointV08: "0x4337084D9E255Ff04702E20b9d30E3b3b5db19E3",
    usdcToken:     "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    chainName: "Avalanche",
  },
};

export interface PaymasterData {
  paymasterAddress: string;
  paymasterInput: string;  // ABI-encoded approval data
  usdcAddress: string;
  estimatedUSDCFee: string;
}

/**
 * Get paymaster config for a given chain and version.
 * Returns null if chain is not supported.
 */
export function getPaymasterConfig(chainId: number, version: "v07" | "v08" = "v08") {
  const cfg = PAYMASTER_CONTRACTS[String(chainId)];
  if (!cfg) return null;
  return {
    paymasterAddress: version === "v08" ? cfg.paymasterV08 : cfg.paymasterV07,
    entrypointAddress: version === "v08" ? cfg.entrypointV08 : cfg.entrypointV07,
    usdcToken: cfg.usdcToken,
    chainName: cfg.chainName,
    surcharge: [42161, 8453].includes(chainId) ? 1.10 : 1.00,  // 10% surcharge on ARB/BASE
  };
}

/**
 * Generate paymaster and data field for ERC-4337 userOp.
 * The paymaster expects: paymasterAddress (20 bytes) + validUntil (6) + validAfter (6) + signature (65)
 * In practice, the paymaster auto-approves based on the ERC-20 approval.
 */
export function buildPaymasterUserOpFields(chainId: number) {
  const cfg = getPaymasterConfig(chainId);
  if (!cfg) return null;
  return {
    paymasterAddress:                 cfg.paymasterAddress,
    paymasterVerificationGasLimit:    "0x10000",
    paymasterPostOpGasLimit:          "0x8000",
    paymasterAndData:                 cfg.paymasterAddress + "0".repeat(130), // placeholder
    entryPoint:                       cfg.entrypointAddress,
    usdcToken:                        cfg.usdcToken,
    supportedChain:                   true,
    surchargeMultiplier:              cfg.surcharge,
  };
}
