export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { NETWORKS } from "@/lib/circle-chains";

const DEFAULT_NET = NETWORKS.find(n => n.id === "arc-testnet")!;
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function blockscout(apiBase: string, path: string): Promise<unknown> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Blockscout ${res.status}`);
  return res.json();
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message ?? "RPC error");
  return d.result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query     = (searchParams.get("q") ?? "").trim();
  const type      = searchParams.get("type") ?? "auto";
  const networkId = searchParams.get("network") ?? "arc-testnet";

  const network = NETWORKS.find(n => n.id === networkId) ?? DEFAULT_NET;
  const apiBase = network.explorerApi ?? DEFAULT_NET.explorerApi!;
  const explorerBase = network.explorer;
  const isArc = network.id === "arc-testnet";

  // Stats-only request
  if (!query && type === "stats") {
    try {
      const stats = await blockscout(apiBase, "/stats");
      return NextResponse.json({ type: "stats", data: stats });
    } catch {
      return NextResponse.json({ type: "stats", data: null });
    }
  }

  if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

  const isAddress  = /^0x[0-9a-fA-F]{40}$/.test(query);
  const isTxHash   = /^0x[0-9a-fA-F]{64}$/.test(query);
  const isBlockNum = /^\d+$/.test(query);

  try {
    if (isTxHash) {
      const tx = await blockscout(apiBase, `/transactions/${query}`) as Record<string,unknown>;
      return NextResponse.json({ type:"transaction", data:{
        hash:      tx.hash,
        status:    tx.status==="ok"?"success":tx.status==="error"?"failed":"pending",
        block:     tx.block,
        timestamp: tx.timestamp,
        from:      (tx.from as Record<string,unknown>)?.hash,
        to:        (tx.to as Record<string,unknown>)?.hash ?? null,
        contractCreated: (tx.created_contract as Record<string,unknown>)?.hash ?? null,
        value:     tx.value,
        gasUsed:   tx.gas_used,
        gasLimit:  tx.gas_limit,
        nonce:     tx.nonce,
        decodedMethod: (tx.decoded_input as Record<string,unknown>)?.method_call ?? null,
        revertReason: tx.revert_reason,
        fee:       tx.fee,
        explorerUrl: `${explorerBase}/tx/${query}`,
      }});
    }

    if (isAddress) {
      const [addrData, txsData, tokenData] = await Promise.allSettled([
        blockscout(apiBase, `/addresses/${query}`),
        blockscout(apiBase, `/addresses/${query}/transactions?limit=10`),
        blockscout(apiBase, `/addresses/${query}/token-balances`),
      ]);

      const addr   = addrData.status === "fulfilled"  ? addrData.value  as Record<string,unknown> : {};
      const txs    = txsData.status === "fulfilled"   ? txsData.value   as Record<string,unknown> : {};
      const tokens = tokenData.status === "fulfilled"  ? tokenData.value as unknown[]             : [];

      // Native balance
      let nativeBalance = "0";
      if (isArc) {
        try {
          const balHex = await rpcCall("eth_getBalance", [query, "latest"]) as string;
          const raw = BigInt(balHex.startsWith("0x") ? balHex : "0x" + balHex);
          const whole = raw / 1000000000000000000n;
          const rem   = (raw % 1000000000000000000n) / 1000000000000n;
          nativeBalance = whole.toString() + "." + rem.toString().padStart(6, "0");
        } catch { nativeBalance = "0.000000"; }
      } else {
        nativeBalance = addr.coin_balance ? String(parseFloat(String(addr.coin_balance)) / 1e18) : "0";
      }

      const isContract = !!(addr.is_contract);
      return NextResponse.json({ type: isContract ? "contract" : "address", data:{
        address: query, balance: nativeBalance + (isArc ? " USDC" : " ETH"),
        isContract, txCount: addr.transactions_count ?? 0,
        name: addr.name ?? null, isVerified: (addr.is_verified as boolean) ?? false,
        tokenSymbol: isContract ? (addr.token as Record<string,unknown>)?.symbol ?? null : null,
        tokenBalances: Array.isArray(tokens) ? tokens.slice(0, 10).map((t: unknown) => {
          const tok = t as Record<string,unknown>;
          const token = tok.token as Record<string,unknown> | undefined;
          const dec = parseInt(String(token?.decimals ?? "18"));
          const raw = BigInt(String(tok.value ?? "0"));
          const display = Number(raw) / Math.pow(10, dec);
          return { name:token?.name, symbol:token?.symbol, address:token?.address, decimals:dec, balance:display.toFixed(Math.min(dec,6)) };
        }) : [],
        recentTxs: Array.isArray((txs as Record<string,unknown>)?.items)
          ? ((txs as Record<string,unknown>).items as Record<string,unknown>[]).slice(0,5).map(t=>({hash:t.hash, from:(t.from as Record<string,unknown>)?.hash, to:(t.to as Record<string,unknown>)?.hash, value:t.value, status:t.status}))
          : [],
        explorerUrl: `${explorerBase}/address/${query}`,
      }});
    }

    if (isBlockNum) {
      const [block, blockTxs] = await Promise.allSettled([
        blockscout(apiBase, `/blocks/${query}`),
        blockscout(apiBase, `/blocks/${query}/transactions?limit=5`),
      ]);
      const b  = block.status === "fulfilled"     ? block.value  as Record<string,unknown> : {};
      const bt = blockTxs.status === "fulfilled"  ? blockTxs.value as Record<string,unknown> : {};
      return NextResponse.json({ type:"block", data:{
        number: b.height, hash: b.hash, parentHash: b.parent_hash,
        timestamp: b.timestamp, miner: (b.miner as Record<string,unknown>)?.hash ?? null,
        minerLabel: (b.miner as Record<string,unknown>)?.ens_domain_name ?? null,
        gasUsed: b.gas_used, gasLimit: b.gas_limit, txCount: b.tx_count, size: b.size,
        transactions: Array.isArray((bt as Record<string,unknown>)?.items)
          ? ((bt as Record<string,unknown>).items as Record<string,unknown>[]).slice(0,5).map(t=>({hash:t.hash, from:(t.from as Record<string,unknown>)?.hash, to:(t.to as Record<string,unknown>)?.hash, value:t.value, status:t.status}))
          : [],
        explorerUrl: `${explorerBase}/block/${query}`,
      }});
    }

    // Universal search fallback
    const searchResult = await blockscout(apiBase, `/search?q=${encodeURIComponent(query)}`);
    return NextResponse.json({ type:"search", data:searchResult });

  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message).slice(0,100) }, { status: 502 });
  }
}
