export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const EXPLORERS: Record<number, { name: string; api: string; url: string; apiKey: string }> = {
  1:       { name:"Etherscan",          api:"https://api.etherscan.io/api",           url:"https://etherscan.io",         apiKey: process.env.ETHERSCAN_API_KEY ?? "" },
  137:     { name:"Polygonscan",        api:"https://api.polygonscan.com/api",         url:"https://polygonscan.com",      apiKey: process.env.POLYGONSCAN_API_KEY ?? "" },
  42161:   { name:"Arbiscan",          api:"https://api.arbiscan.io/api",             url:"https://arbiscan.io",          apiKey: process.env.ARBISCAN_API_KEY ?? "" },
  10:      { name:"Optimism Etherscan",api:"https://api-optimistic.etherscan.io/api", url:"https://optimistic.etherscan.io", apiKey: process.env.OPTIMISM_API_KEY ?? "" },
  8453:    { name:"Basescan",          api:"https://api.basescan.org/api",            url:"https://basescan.org",         apiKey: process.env.BASESCAN_API_KEY ?? "" },
  56:      { name:"BSCscan",           api:"https://api.bscscan.com/api",             url:"https://bscscan.com",          apiKey: process.env.BSCSCAN_API_KEY ?? "" },
  5042002: { name:"ArcScan",           api:"https://testnet.arcscan.app/api/v2",      url:"https://testnet.arcscan.app",  apiKey: "" },
};

// Sourcify — free, works on all networks
async function verifySourcify(
  chainId: number, address: string, source: string, compilerVersion: string, contractName: string
) {
  const body = {
    address,
    chain: String(chainId),
    files: { "source.sol": source },
    compilerVersion: `v${compilerVersion}+commit`,
    contractName,
    optimization:   true,
    optimizationRuns: 200,
  };

  const res = await fetch("https://sourcify.dev/server/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json() as { result?: Array<{ address: string; status: string }>; error?: string };
  return { service: "Sourcify", success: !!data.result?.[0]?.status?.includes("perfect"), data };
}

// Etherscan-compatible (Etherscan, Basescan, Arbiscan, Polygonscan, etc.)
async function verifyEtherscan(
  api: string, apiKey: string, name: string,
  address: string, source: string, compilerVersion: string, contractName: string, chainId: number
) {
  if (!apiKey) return { service: name, success: false, error: `No API key for ${name}` };

  const body = new URLSearchParams({
    apikey:                   apiKey,
    module:                   "contract",
    action:                   "verifysourcecode",
    contractaddress:          address,
    sourceCode:               source,
    codeformat:               "solidity-single-file",
    contractname:             contractName,
    compilerversion:          `v${compilerVersion}+commit`,
    optimizationused:         "1",
    runs:                     "200",
    evmversion:               "paris",
    licenseType:              "3",
  });

  const res  = await fetch(api, { method:"POST", body, signal: AbortSignal.timeout(30_000) });
  const data = await res.json() as { status: string; result: string; message: string };
  const ok   = data.status === "1";

  if (ok) {
    // Poll for result
    const guidRes = await fetch(`${api}?apikey=${apiKey}&guid=${data.result}&module=contract&action=checkverifystatus`);
    const check   = await guidRes.json() as { status: string; result: string };
    return { service: name, success: check.result === "Pass - Verified", data: check };
  }
  return { service: name, success: false, error: data.result ?? data.message };
}

// Blockscout API v2
async function verifyBlockscout(
  apiUrl: string, address: string, source: string, compilerVersion: string, contractName: string
) {
  const body = new URLSearchParams({
    compiler_version:    `v${compilerVersion}+commit`,
    source_code:         source,
    contract_name:       contractName,
    optimization:        "true",
    optimization_runs:   "200",
    evm_version:         "paris",
    autodetect_constructor_args: "true",
  });

  const res  = await fetch(`${apiUrl}/smart-contracts/${address}/verification/via/flattened-code`, {
    method: "POST", body, signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json() as Record<string, unknown>;
  return { service:"Blockscout", success: res.ok && !data.errors, data };
}

export async function POST(req: NextRequest) {
  try {
    const { address, sourceCode, contractName, compilerVersion, chainId } = await req.json() as {
      address: string; sourceCode: string; contractName: string;
      compilerVersion: string; chainId: number;
    };

    if (!address || !sourceCode || !contractName)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const explorer = EXPLORERS[chainId];
    const results: Array<{ service: string; success: boolean; error?: string; data?: unknown }> = [];

    // Always try Sourcify (free, no API key)
    try {
      const r = await verifySourcify(chainId, address, sourceCode, compilerVersion, contractName);
      results.push(r);
    } catch (e) { results.push({ service:"Sourcify", success:false, error:String(e) }); }

    // Chain-specific explorer
    if (explorer) {
      if (chainId === 5042002) {
        // ArcScan / Blockscout
        try {
          const r = await verifyBlockscout(explorer.api, address, sourceCode, compilerVersion, contractName);
          results.push(r);
        } catch (e) { results.push({ service:"ArcScan", success:false, error:String(e) }); }
      } else if (explorer.apiKey) {
        try {
          const r = await verifyEtherscan(explorer.api, explorer.apiKey, explorer.name, address, sourceCode, compilerVersion, contractName, chainId);
          results.push(r);
        } catch (e) { results.push({ service:explorer.name, success:false, error:String(e) }); }
      }
    }

    const anySuccess = results.some(r => r.success);
    return NextResponse.json({ success: anySuccess, results, explorerUrl: explorer?.url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
