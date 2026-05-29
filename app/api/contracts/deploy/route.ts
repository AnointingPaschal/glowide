export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { contractAddress, txHash, blockNumber, gasUsed, abi, bytecode, sourceCode, contractName, deployer, projectId } = await req.json();
    if (!contractAddress || !txHash || !deployer) {
      return NextResponse.json({ error: "contractAddress, txHash, deployer required" }, { status: 400 });
    }
    // Ensure ABI is always stored as a valid JSON string
    const abiStr = Array.isArray(abi) && abi.length > 0 ? JSON.stringify(abi) : "[]";
    const row = {
      name:        contractName || "Contract",
      address:     contractAddress.toLowerCase(),
      chain_id:    5042002,
      tx_hash:     txHash,
      deployer:    deployer.toLowerCase(),
      status:      "deployed",
      verified:    false,
      abi:         abiStr,
      bytecode:    bytecode ?? "",
      source_code: sourceCode ?? "",
      project_id:  projectId ?? null,
      metadata:    JSON.stringify({ blockNumber, gasUsed, network: "Arc Testnet" }),
    };
    const { error } = await supabaseREST("POST", "deployed_contracts", row);
    if (error) console.error("[deploy save] DB error:", error);
    return NextResponse.json({
      success: true, contractAddress, txHash,
      network: "Arc Testnet", chainId: 5042002,
      explorerUrl: `https://testnet.arcscan.app/address/${contractAddress}`,
      abiSaved: !error && abiStr !== "[]",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
