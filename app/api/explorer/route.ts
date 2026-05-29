export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// ── Network config ────────────────────────────────────────────────────────
const NETWORKS: Record<string, { rpc: string; explorer: string; chainId: number; name: string }> = {
  testnet: {
    rpc:      process.env.NEXT_PUBLIC_ARC_RPC_URL       ?? "https://rpc.testnet.arc.network",
    explorer: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL  ?? "https://testnet.arcscan.app",
    chainId:  5042002,
    name:     "Arc Testnet",
  },
  mainnet: {
    rpc:      process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL      ?? "https://rpc.arc.network",
    explorer: process.env.NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL ?? "https://arcscan.app",
    chainId:  5040002,
    name:     "Arc Mainnet",
  },
};

async function rpc(networkId: string, method: string, params: unknown[]): Promise<unknown> {
  const net = NETWORKS[networkId] ?? NETWORKS.testnet;
  const res = await fetch(net.rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal:  AbortSignal.timeout(8000),
    cache:   "no-store",
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message ?? JSON.stringify(d.error));
  return d.result;
}

function hexToDecimal(hex: string | null): number {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

function hexToUSDC(hex: string | null): string {
  if (!hex) return "0.000000";
  const raw = parseInt(hex, 16);
  return (raw / 1e6).toFixed(6); // USDC has 6 decimals on Arc
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query     = (searchParams.get("q") ?? "").trim();
  const networkId = searchParams.get("network") ?? "testnet";

  if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

  const net = NETWORKS[networkId] ?? NETWORKS.testnet;

  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(query);
  const isTxHash  = /^0x[0-9a-fA-F]{64}$/.test(query);
  const isBlock   = /^\d+$/.test(query);
  const isBlockHex = /^0x[0-9a-fA-F]+$/.test(query) && query.length < 20;

  try {
    // ── Transaction ───────────────────────────────────────────────────────
    if (isTxHash) {
      const [tx, receipt] = await Promise.all([
        rpc(networkId, "eth_getTransactionByHash",   [query]),
        rpc(networkId, "eth_getTransactionReceipt",  [query]),
      ]) as [Record<string,unknown>|null, Record<string,unknown>|null];

      if (!tx) return NextResponse.json({ error: "Transaction not found on " + net.name }, { status: 404 });

      const block = tx.blockNumber
        ? await rpc(networkId, "eth_getBlockByNumber", [tx.blockNumber, false]) as Record<string,unknown>|null
        : null;

      return NextResponse.json({
        type: "transaction",
        network: net,
        data: {
          hash:        query,
          from:        tx.from as string ?? null,
          to:          tx.to   as string ?? null,
          value:       hexToUSDC(tx.value as string),
          gas:         hexToDecimal(tx.gas as string),
          gasUsed:     receipt ? hexToDecimal(receipt.gasUsed as string) : null,
          gasPrice:    hexToDecimal(tx.gasPrice as string),
          nonce:       hexToDecimal(tx.nonce as string),
          blockNumber: tx.blockNumber ? hexToDecimal(tx.blockNumber as string) : null,
          blockHash:   tx.blockHash as string ?? null,
          timestamp:   block ? hexToDecimal(block.timestamp as string) : null,
          status:      receipt ? (receipt.status === "0x1" ? "success" : "failed") : "pending",
          contractCreated: receipt?.contractAddress as string ?? null,
          input:       (tx.input as string)?.slice(0, 200),
          logs:        (receipt?.logs as unknown[])?.length ?? 0,
          explorerUrl: `${net.explorer}/tx/${query}`,
        },
      });
    }

    // ── Address / Contract ────────────────────────────────────────────────
    if (isAddress) {
      const [balance, code, txCount] = await Promise.all([
        rpc(networkId, "eth_getBalance",          [query, "latest"]),
        rpc(networkId, "eth_getCode",             [query, "latest"]),
        rpc(networkId, "eth_getTransactionCount", [query, "latest"]),
      ]) as [string, string, string];

      const isContract = code && code !== "0x" && code.length > 2;

      return NextResponse.json({
        type:    isContract ? "contract" : "address",
        network: net,
        data: {
          address:     query,
          balance:     hexToUSDC(balance),
          balanceRaw:  hexToDecimal(balance),
          isContract,
          txCount:     hexToDecimal(txCount),
          bytecodeSize: isContract ? Math.floor((code.length - 2) / 2) : 0,
          explorerUrl: `${net.explorer}/address/${query}`,
        },
      });
    }

    // ── Block ─────────────────────────────────────────────────────────────
    if (isBlock || isBlockHex) {
      const blockParam = isBlock ? `0x${parseInt(query).toString(16)}` : query;
      const block = await rpc(networkId, "eth_getBlockByNumber", [blockParam, true]) as Record<string,unknown>|null;

      if (!block) return NextResponse.json({ error: "Block not found on " + net.name }, { status: 404 });

      const txs = (block.transactions as unknown[]) ?? [];
      return NextResponse.json({
        type:    "block",
        network: net,
        data: {
          number:       hexToDecimal(block.number as string),
          hash:         block.hash as string,
          parentHash:   block.parentHash as string,
          timestamp:    hexToDecimal(block.timestamp as string),
          miner:        block.miner as string ?? null,
          gasUsed:      hexToDecimal(block.gasUsed as string),
          gasLimit:     hexToDecimal(block.gasLimit as string),
          txCount:      txs.length,
          size:         hexToDecimal(block.size as string),
          extraData:    block.extraData as string ?? null,
          explorerUrl:  `${net.explorer}/block/${hexToDecimal(block.number as string)}`,
          // Latest 5 TXs
          transactions: (txs as Record<string,unknown>[]).slice(0, 5).map(t => ({
            hash:  t.hash, from: t.from, to: t.to,
            value: hexToUSDC(t.value as string),
          })),
        },
      });
    }

    // ── Latest block (no query) ───────────────────────────────────────────
    return NextResponse.json({ error: "Enter a valid address, tx hash, or block number" }, { status: 400 });

  } catch (err) {
    console.error("[explorer]", networkId, query, err);
    return NextResponse.json({
      error: `Failed to fetch from ${net.name}: ${(err as Error).message}`,
      network: net,
    }, { status: 502 });
  }
}
