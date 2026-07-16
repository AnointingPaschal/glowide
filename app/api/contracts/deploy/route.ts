export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { contractAddress, txHash, blockNumber, gasUsed, abi, bytecode, sourceCode, contractName, deployer, projectId, chainId } = await req.json();
    if (!contractAddress || !txHash || !deployer) {
      return NextResponse.json({ error: "contractAddress, txHash, deployer required" }, { status: 400 });
    }
    // Ensure ABI is always stored as a valid JSON string
    const abiStr = Array.isArray(abi) && abi.length > 0 ? JSON.stringify(abi) : "[]";
    const cid = Number(chainId) || 5042002;
    const NET_NAMES: Record<number,{name:string;explorer:string}> = {
      1:{name:"Ethereum",explorer:"https://etherscan.io"},
      137:{name:"Polygon",explorer:"https://polygonscan.com"},
      42161:{name:"Arbitrum",explorer:"https://arbiscan.io"},
      10:{name:"Optimism",explorer:"https://optimistic.etherscan.io"},
      8453:{name:"Base",explorer:"https://basescan.org"},
      56:{name:"BNB Chain",explorer:"https://bscscan.com"},
      43114:{name:"Avalanche",explorer:"https://snowtrace.io"},
      59144:{name:"Linea",explorer:"https://lineascan.build"},
      5042002:{name:"Arc Testnet",explorer:"https://testnet.arcscan.app"},
    };
    const net = NET_NAMES[cid] ?? {name:`Chain ${cid}`,explorer:""};
    const row = {
      name:        contractName || "Contract",
      address:     contractAddress.toLowerCase(),
      chain_id:    cid,
      tx_hash:     txHash,
      deployer:    deployer.toLowerCase(),
      status:      "deployed",
      verified:    false,
      abi:         abiStr,
      bytecode:    bytecode ?? "",
      source_code: sourceCode ?? "",
      project_id:  projectId ?? null,
      metadata:    JSON.stringify({ blockNumber, gasUsed, network: net.name, explorer: net.explorer }),
    };
    const { error } = await supabaseREST("POST", "deployed_contracts", row);
    if (error) console.error("[deploy save] DB error:", error);
    return NextResponse.json({
      success: true, contractAddress, txHash,
      network: net.name, chainId: cid,
      explorerUrl: net.explorer ? `${net.explorer}/address/${contractAddress}` : "",
      abiSaved: !error && abiStr !== "[]",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
