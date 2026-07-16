export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deployer = searchParams.get("deployer")?.toLowerCase();

  const query = deployer
    ? `select=*&deployer=ilike.${encodeURIComponent(deployer)}&order=created_at.desc`
    : `select=*&order=created_at.desc&limit=100`;

  const { data, error } = await supabaseREST("GET", "deployed_contracts", undefined, query);

  if (error) {
    console.error("[contracts GET]", error);
    return NextResponse.json({ contracts: [], error }, { status: 200 }); // return empty, not 500
  }

  const NET: Record<number,{name:string;explorer:string}> = {
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
  const contracts = (Array.isArray(data) ? data : []).map((c: Record<string,unknown>) => {
    const cid = Number(c.chain_id) || 5042002;
    const net = NET[cid] ?? {name:`Chain ${cid}`,explorer:""};
    return {
      ...c,
      abi: typeof c.abi === "string" ? (() => { try { return JSON.parse(c.abi as string); } catch { return []; } })() : (c.abi ?? []),
      deployedAt: c.created_at,
      network: net.name,
      explorerUrl: net.explorer ? `${net.explorer}/address/${c.address}` : "",
    };
  });

  return NextResponse.json({ contracts });
}
