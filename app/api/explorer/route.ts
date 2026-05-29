export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const ARCSCAN = "https://testnet.arcscan.app";
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

// ── Blockscout REST API v2 fetch ──────────────────────────────────────────
async function blockscout(path: string): Promise<unknown> {
  const res = await fetch(`${ARCSCAN}/api/v2${path}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Blockscout API ${res.status}: ${text.slice(0, 100)}`);
  }
  return res.json();
}

// ── Arc RPC call ──────────────────────────────────────────────────────────
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

// ── Stats ──────────────────────────────────────────────────────────────────
async function getStats() {
  try {
    return await blockscout("/stats");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim();
  const type  = searchParams.get("type") ?? "auto";

  // Stats-only request
  if (!query && type === "stats") {
    const stats = await getStats();
    return NextResponse.json({ type: "stats", data: stats });
  }

  if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

  const isAddress  = /^0x[0-9a-fA-F]{40}$/.test(query);
  const isTxHash   = /^0x[0-9a-fA-F]{64}$/.test(query);
  const isBlockNum = /^\d+$/.test(query);

  try {
    // ── Transaction ──────────────────────────────────────────────────────
    if (isTxHash) {
      const tx = await blockscout(`/transactions/${query}`) as Record<string, unknown>;
      return NextResponse.json({
        type: "transaction",
        data: {
          hash:          tx.hash,
          status:        tx.status === "ok" ? "success" : tx.status === "error" ? "failed" : "pending",
          block:         tx.block,
          timestamp:     tx.timestamp,
          from:          (tx.from as Record<string,unknown>)?.hash,
          to:            (tx.to as Record<string,unknown>)?.hash ?? null,
          contractCreated: (tx.created_contract as Record<string,unknown>)?.hash ?? null,
          value:         tx.value,
          gasUsed:       tx.gas_used,
          gasLimit:      tx.gas_limit,
          gasPrice:      tx.gas_price,
          nonce:         tx.nonce,
          logs:          tx.decoded_input ?? null,
          decodedMethod: (tx.decoded_input as Record<string,unknown>)?.method_call ?? null,
          fee:           tx.fee,
          revertReason:  tx.revert_reason,
          explorerUrl:   `${ARCSCAN}/tx/${query}`,
        },
      });
    }

    // ── Address ──────────────────────────────────────────────────────────
    if (isAddress) {
      // Parallel: address info + transactions + token balances
      const [addrData, txsData, tokenData] = await Promise.allSettled([
        blockscout(`/addresses/${query}`),
        blockscout(`/addresses/${query}/transactions?limit=10`),
        blockscout(`/addresses/${query}/token-balances`),
      ]);

      const addr  = addrData.status === "fulfilled"  ? addrData.value  as Record<string,unknown> : {};
      const txs   = txsData.status === "fulfilled"   ? txsData.value   as Record<string,unknown> : {};
      const tokens = tokenData.status === "fulfilled" ? tokenData.value  as unknown[]             : [];

      // Native balance from RPC (more reliable)
      let nativeBalance = "0";
      try {
        const balHex = await rpcCall("eth_getBalance", [query, "latest"]) as string;
        // Arc Testnet: native USDC uses 18 decimal wei internally
        nativeBalance = (parseInt(balHex, 16) / 1e18).toFixed(6);
      } catch { /* use Blockscout balance as fallback */ }

      const isContract = !!(addr.is_contract);

      return NextResponse.json({
        type: isContract ? "contract" : "address",
        data: {
          address:       query,
          balance:       nativeBalance,
          balanceRaw:    addr.coin_balance ?? "0",
          isContract,
          txCount:       addr.transactions_count ?? 0,
          name:          addr.name ?? null,
          bytecodeSize:  isContract ? (addr.creation_tx_hash ? "—" : "—") : 0,
          isVerified:    (addr.is_verified as boolean) ?? false,
          tokenName:     isContract ? (addr.token as Record<string,unknown>)?.name ?? null : null,
          tokenSymbol:   isContract ? (addr.token as Record<string,unknown>)?.symbol ?? null : null,
          tokenBalances: Array.isArray(tokens) ? tokens.slice(0, 10).map((t: unknown) => {
            const tok = t as Record<string, unknown>;
            const token = tok.token as Record<string, unknown> | undefined;
            const decimals = parseInt(String(token?.decimals ?? "18"));
            const rawVal = BigInt(String(tok.value ?? "0"));
            const displayVal = Number(rawVal) / Math.pow(10, decimals);
            return {
              name:     token?.name,
              symbol:   token?.symbol,
              address:  token?.address,
              decimals,
              balance:  displayVal.toFixed(Math.min(decimals, 6)),
            };
          }) : [],
          recentTxs: Array.isArray((txs as Record<string, unknown>)?.items)
            ? ((txs as Record<string, unknown>).items as Record<string, unknown>[]).slice(0, 5).map(t => ({
                hash:      t.hash,
                from:      (t.from as Record<string,unknown>)?.hash,
                to:        (t.to as Record<string,unknown>)?.hash,
                value:     t.value,
                timestamp: t.timestamp,
                status:    t.status,
              }))
            : [],
          explorerUrl: `${ARCSCAN}/address/${query}`,
        },
      });
    }

    // ── Block ─────────────────────────────────────────────────────────────
    if (isBlockNum) {
      const block = await blockscout(`/blocks/${query}`) as Record<string, unknown>;
      const txsData = await blockscout(`/blocks/${query}/transactions?limit=10`).catch(() => ({ items: [] })) as Record<string, unknown>;
      return NextResponse.json({
        type: "block",
        data: {
          number:      block.height,
          hash:        block.hash,
          parentHash:  block.parent_hash,
          timestamp:   block.timestamp,
          miner:       (block.miner as Record<string,unknown>)?.hash ?? null,
          minerLabel:  (block.miner as Record<string,unknown>)?.ens_domain_name ?? null,
          gasUsed:     block.gas_used,
          gasLimit:    block.gas_limit,
          baseFeePerGas: block.base_fee_per_gas,
          txCount:     block.tx_count,
          size:        block.size,
          rewards:     block.rewards,
          transactions: Array.isArray((txsData as Record<string, unknown>)?.items)
            ? ((txsData as Record<string, unknown>).items as Record<string, unknown>[]).slice(0, 5).map(t => ({
                hash:  t.hash,
                from:  (t.from as Record<string,unknown>)?.hash,
                to:    (t.to as Record<string,unknown>)?.hash,
                value: t.value,
                status: t.status,
              }))
            : [],
          explorerUrl: `${ARCSCAN}/block/${query}`,
        },
      });
    }

    // ── Universal search ──────────────────────────────────────────────────
    const searchResult = await blockscout(`/search?q=${encodeURIComponent(query)}`) as Record<string, unknown>;
    return NextResponse.json({ type: "search", data: searchResult });

  } catch (err) {
    console.error("[explorer]", err);
    return NextResponse.json({
      error: `${(err as Error).message}`,
      hint: "The Blockscout API may be unavailable. Try direct RPC lookup.",
    }, { status: 502 });
  }
}
