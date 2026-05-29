export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { contractAddress, txHash, blockNumber, gasUsed, abi, bytecode, sourceCode, contractName, deployer, projectId } = await req.json();

    if (!contractAddress || !txHash || !deployer) {
      return NextResponse.json({ error: "contractAddress, txHash, deployer required" }, { status: 400 });
    }

    const row = {
      name:        contractName || "Contract",
      address:     contractAddress.toLowerCase(),
      chain_id:    5042002,
      tx_hash:     txHash,
      deployer:    deployer.toLowerCase(),
      status:      "deployed",
      verified:    false,
      abi:         JSON.stringify(abi ?? []),
      bytecode:    bytecode ?? "",
      source_code: sourceCode ?? "",
      project_id:  projectId ?? null,
      metadata:    JSON.stringify({ blockNumber, gasUsed, network: "Arc Testnet" }),
    };

    const { error } = await supabaseREST("POST", "deployed_contracts", row);
    if (error) console.error("[deploy save]", error);
    // Don't fail the response — contract is on-chain regardless of DB save

    return NextResponse.json({
      success: true, contractAddress, txHash,
      network: "Arc Testnet", chainId: 5042002,
      explorerUrl: `https://testnet.arcscan.app/address/${contractAddress}`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
