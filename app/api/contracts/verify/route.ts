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

interface VerifyOptions {
  optimizationEnabled: boolean;
  optimizationRuns: number;
  evmVersion: string;
  libraries: Array<{ name: string; address: string }>;
}

// Sourcify — free, works on all networks
async function verifySourcify(
  chainId: number, address: string, source: string, compilerVersion: string, contractName: string, opts: VerifyOptions
) {
  const body = {
    address,
    chain: String(chainId),
    files: { "source.sol": source },
    compilerVersion: `v${compilerVersion}+commit`,
    contractName,
    optimization:   opts.optimizationEnabled,
    optimizationRuns: opts.optimizationRuns,
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
  address: string, source: string, compilerVersion: string, contractName: string, chainId: number, opts: VerifyOptions
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
    optimizationused:         opts.optimizationEnabled ? "1" : "0",
    runs:                     String(opts.optimizationRuns),
    evmversion:               opts.evmVersion === "default" ? "default" : opts.evmVersion,
    licenseType:              "3",
  });
  // Etherscan's API genuinely supports linked library name/address pairs
  opts.libraries.forEach((lib, i) => {
    if (lib.name && lib.address) {
      body.set(`libraryname${i+1}`, lib.name);
      body.set(`libraryaddress${i+1}`, lib.address);
    }
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
  apiUrl: string, address: string, source: string, compilerVersion: string, contractName: string, opts: VerifyOptions
) {
  const body = new URLSearchParams({
    compiler_version:    `v${compilerVersion}+commit`,
    source_code:         source,
    contract_name:       contractName,
    optimization:        String(opts.optimizationEnabled),
    optimization_runs:   String(opts.optimizationRuns),
    evm_version:         opts.evmVersion,
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
    const {
      address, sourceCode, contractName, compilerVersion, chainId,
      evmVersion = "default", optimizationEnabled = true, optimizationRuns = 200,
      libraries = [], licenseIdentifier,
    } = await req.json() as {
      address: string; sourceCode: string; contractName: string;
      compilerVersion: string; chainId: number;
      evmVersion?: string; optimizationEnabled?: boolean; optimizationRuns?: number;
      libraries?: Array<{ name: string; address: string }>; licenseIdentifier?: string;
    };

    if (!address || !sourceCode || !contractName)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    // Prepend the correct SPDX license line if the source doesn't already declare one
    let finalSource = sourceCode;
    if (licenseIdentifier && !/SPDX-License-Identifier/.test(sourceCode)) {
      finalSource = `// SPDX-License-Identifier: ${licenseIdentifier}\n${sourceCode}`;
    }

    const opts: VerifyOptions = { optimizationEnabled, optimizationRuns, evmVersion, libraries };
    const explorer = EXPLORERS[chainId];
    const results: Array<{ service: string; success: boolean; error?: string; data?: unknown }> = [];

    // Always try Sourcify (free, no API key)
    try {
      const r = await verifySourcify(chainId, address, finalSource, compilerVersion, contractName, opts);
      results.push(r);
    } catch (e) { results.push({ service:"Sourcify", success:false, error:String(e) }); }

    // Chain-specific explorer
    if (explorer) {
      if (chainId === 5042002) {
        // ArcScan / Blockscout
        try {
          const r = await verifyBlockscout(explorer.api, address, finalSource, compilerVersion, contractName, opts);
          results.push(r);
        } catch (e) { results.push({ service:"ArcScan", success:false, error:String(e) }); }
      } else if (explorer.apiKey) {
        try {
          const r = await verifyEtherscan(explorer.api, explorer.apiKey, explorer.name, address, finalSource, compilerVersion, contractName, chainId, opts);
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
