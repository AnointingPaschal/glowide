import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// This route only persists deployment data to Supabase.
// The actual deployment (signing + broadcast) happens client-side
// via window.ethereum in ContractDeployer.tsx.

export async function POST(req: NextRequest) {
  try {
    const {
      contractAddress, txHash, blockNumber, gasUsed,
      abi, bytecode, sourceCode, contractName, deployer, projectId,
    } = await req.json();

    if (!contractAddress || !txHash || !deployer) {
      return NextResponse.json({ error: "contractAddress, txHash, and deployer are required" }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
      return NextResponse.json({ error: "Invalid contract address" }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.from("deployed_contracts").insert({
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
      });
      if (error) throw error;
    } catch (dbErr) {
      console.error("DB save error:", dbErr);
      // Return success anyway — the contract is deployed on-chain regardless
    }

    return NextResponse.json({
      success: true,
      contractAddress,
      txHash,
      network: "Arc Testnet",
      chainId: 5042002,
      explorerUrl: `https://testnet.arcscan.app/address/${contractAddress}`,
    });
  } catch (err) {
    console.error("Deploy route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
