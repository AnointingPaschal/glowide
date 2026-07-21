/**
 * Shared wallet-signing dispatch — used anywhere in the app that needs to
 * send a real transaction (AI chat tool calls, DeFi actions, wallet page
 * sends, etc). Resolves whichever wallet is active and signs through the
 * right path.
 *
 * Local self-custody wallets ("the website wallet" — generated and held
 * entirely in-browser, no external app needed) are fully supported and are
 * the preferred default, so nothing requires MetaMask or Circle just to
 * work. The earlier removal of local signing was because
 * ethers.JsonRpcProvider's automatic network-detection polling (repeated
 * eth_chainId calls) was hitting Arc RPC's rate limit — the real fix is to
 * give ethers a static network config so it trusts what we tell it instead
 * of re-verifying on every call, not to drop local wallet support entirely.
 *
 * Everything targets Arc Testnet only — no chain fallback, no guessing.
 */
import { useCircleStore } from "@/store/circleStore";
import { useLocalWalletStore } from "@/store/localWalletStore";
import { useActiveWalletStore } from "@/store/activeWalletStore";
import { useWalletStore } from "@/store/walletStore";
import { requestPassword } from "@/store/passwordPromptStore";

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x" + ARC_CHAIN_ID.toString(16);
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_BLOCKCHAIN_LABEL = "ARC-TESTNET"; // Circle's naming convention for their API

export type ResolvedWallet =
  | { type: "local"; id: string; address: string }
  | { type: "circle"; id: string; address?: string }
  | { type: "metamask"; address: string };

export function resolveActiveWallet(): ResolvedWallet | null {
  const active  = useActiveWalletStore.getState().active;
  const local   = useLocalWalletStore.getState();
  const circle  = useCircleStore.getState();
  const mm      = useWalletStore.getState();

  // Local ("the website wallet") first — it needs no external app or
  // service, then Circle (server-signed, no popup), then MetaMask.
  const key = active ?? (
    local.wallets.length > 0  ? { type: "local" as const,  id: local.activeWalletId  ?? local.wallets[0].id } :
    circle.wallets.length > 0 ? { type: "circle" as const, id: circle.activeWalletId ?? circle.wallets[0].id } :
    mm.address                 ? { type: "metamask" as const } :
    null
  );
  if (!key) return null;

  if (key.type === "local") {
    const w = local.wallets.find(x => x.id === key.id);
    if (!w) return null;
    return { type: "local", id: w.id, address: w.address };
  }
  if (key.type === "circle") {
    const w = circle.wallets.find(x => x.id === key.id);
    return { type: "circle", id: key.id, address: w?.address };
  }
  if (!mm.address) return null;
  return { type: "metamask", address: mm.address };
}

/** Alias kept for existing call sites — every wallet type can sign now. */
export function resolveSignableWallet(): ResolvedWallet | null {
  return resolveActiveWallet();
}

type EthProvider = { request:(a:{method:string;params?:unknown[]})=>Promise<unknown> };
function getMetaMaskProvider(): EthProvider | null {
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

/** Makes sure MetaMask is actually pointed at Arc Testnet before signing —
 *  switches automatically, adding the network first if MetaMask doesn't know
 *  about it yet. Without this, a transaction could silently land on whatever
 *  chain the user happened to have selected. */
async function ensureArcNetwork(provider: EthProvider): Promise<string | null> {
  try {
    const currentChainId = await provider.request({ method: "eth_chainId" }) as string;
    if (currentChainId?.toLowerCase() === ARC_CHAIN_ID_HEX) return null;

    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID_HEX }] });
      return null;
    } catch (switchErr) {
      // 4902 = chain not added to MetaMask yet — add it, then switch
      if ((switchErr as { code?: number })?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_CHAIN_ID_HEX,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC_RPC_URL],
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          }],
        });
        return null;
      }
      throw switchErr;
    }
  } catch (e) {
    return `Couldn't switch to Arc Testnet: ${(e as Error).message ?? e}`;
  }
}

/** A JsonRpcProvider configured with a STATIC network — this is the actual
 *  fix for the earlier "request limit reached" error. Without a static
 *  network, ethers polls eth_chainId repeatedly to verify/detect the chain
 *  on every call, which is what hit Arc RPC's rate limit. Telling ethers the
 *  network up front (and that it's static, i.e. won't change mid-session)
 *  skips that polling entirely. */
async function getArcProvider() {
  const { ethers } = await import("ethers");
  return new ethers.JsonRpcProvider(
    ARC_RPC_URL,
    { chainId: ARC_CHAIN_ID, name: "arc-testnet" },
    { staticNetwork: true }
  );
}

/** Arc's public testnet RPC has a real, low rate limit (-32011 "request
 *  limit reached") that can trigger even on a single legitimate broadcast,
 *  not just from repeated polling. Retries with backoff instead of failing
 *  the user's transaction on the first hit — the tx was validly signed,
 *  it just needs another attempt to actually land. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const isRateLimit = /request limit reached|-32011/i.test(String(e));
      if (!isRateLimit || i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * Math.pow(2, i))); // 0.8s, 1.6s, 3.2s
    }
  }
  throw lastErr;
}

// ── Minimal ABI encoder ───────────────────────────────────────────────────
function encodeAddress(addr: string): string { return addr.replace(/^0x/i, "").toLowerCase().padStart(64, "0"); }
function encodeUint256(n: string | bigint | number): string { return BigInt(n).toString(16).padStart(64, "0"); }

async function getSelector(sig: string): Promise<string> {
  const res = await fetch(`/api/contracts/selector?sig=${encodeURIComponent(sig)}`);
  const d = await res.json() as { selector?: string; error?: string };
  if (!d.selector) throw new Error(d.error ?? `Couldn't compute selector for ${sig}`);
  return d.selector;
}

async function encodeCall(signature: string, params: Array<string | bigint | number>): Promise<string> {
  const selector = await getSelector(signature);
  const types = signature.slice(signature.indexOf("(") + 1, signature.lastIndexOf(")")).split(",").filter(Boolean);
  const encoded = types.map((t, i) => t.trim() === "address" ? encodeAddress(String(params[i])) : encodeUint256(params[i])).join("");
  return "0x" + selector + encoded;
}

export interface ExecResult { txHash?: string; error?: string; }

/** Sign and send an arbitrary contract call on Arc Testnet. */
export async function executeContractCall(opts: {
  contractAddress: string; signature: string; params: Array<string | bigint | number>;
}): Promise<ExecResult> {
  const wallet = resolveActiveWallet();
  if (!wallet) return { error: "No wallet connected — connect or create one in the Wallet tab first." };

  if (wallet.type === "circle") {
    const res = await fetch("/api/circle/dev-wallet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contract", walletId: wallet.id, blockchain: ARC_BLOCKCHAIN_LABEL,
        contractAddress: opts.contractAddress, abiFunctionSignature: opts.signature,
        abiParameters: opts.params.map(p => typeof p === "bigint" ? p.toString() : p),
      }),
    });
    const d = await res.json() as { id?: string; txHash?: string; error?: string };
    if (d.error) return { error: d.error };
    return { txHash: d.txHash ?? d.id };
  }

  const data = await encodeCall(opts.signature, opts.params);

  if (wallet.type === "local") {
    const password = await requestPassword();
    if (!password) return { error: "Signing cancelled" };
    try {
      const { ethers } = await import("ethers");
      const local = useLocalWalletStore.getState();
      const w = local.wallets.find(x => x.id === wallet.id);
      if (!w) return { error: "Wallet not found" };
      const decrypted = await ethers.Wallet.fromEncryptedJson(w.encryptedJson, password);
      const provider  = await getArcProvider();
      const connected = decrypted.connect(provider);
      const tx = await withRetry(() => connected.sendTransaction({ to: opts.contractAddress, data }));
      return { txHash: tx.hash };
    } catch (e) {
      const isRateLimit = /request limit reached|-32011/i.test(String(e));
      return { error: isRateLimit ? "Arc's testnet RPC is rate-limited right now — please try again in a moment." : /password|invalid/i.test(String(e)) ? "Incorrect password" : (e as Error).message };
    }
  }

  // MetaMask
  const provider = getMetaMaskProvider();
  if (!provider) return { error: "No wallet provider found in this browser" };
  const switchError = await ensureArcNetwork(provider);
  if (switchError) return { error: switchError };

  try {
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: wallet.address, to: opts.contractAddress, data }],
    }) as string;
    return { txHash };
  } catch (e) { return { error: (e as Error).message }; }
}

// Real Arc Testnet token decimals — needed to scale amounts correctly when
// encoding an ERC-20 transfer() call (get this wrong and you send 1,000,000x
// too much or too little).
const TOKEN_DECIMALS: Record<string, number> = {
  "0x3600000000000000000000000000000000000000": 6,  // USDC (ERC-20 interface)
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": 6,   // EURC
  "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf": 8,   // cirBTC
  "0xe9185f0c5f296ed1797aae4238d26ccabeadb86c": 6,   // USYC
};

/** Simple transfer on Arc Testnet — same wallet dispatch as executeContractCall. */
export async function executeTransfer(opts: {
  to: string; amount: string; tokenAddress?: string;
}): Promise<ExecResult> {
  const wallet = resolveActiveWallet();
  if (!wallet) return { error: "No wallet connected — connect or create one in the Wallet tab first." };

  if (wallet.type === "circle") {
    const res = await fetch("/api/circle/dev-wallet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer", walletId: wallet.id, to: opts.to, amount: opts.amount, blockchain: ARC_BLOCKCHAIN_LABEL }),
    });
    const d = await res.json() as { id?: string; txHash?: string; error?: string };
    if (d.error) return { error: d.error };
    return { txHash: d.txHash ?? d.id };
  }

  if (wallet.type === "local") {
    const password = await requestPassword();
    if (!password) return { error: "Signing cancelled" };
    try {
      const { ethers } = await import("ethers");
      const local = useLocalWalletStore.getState();
      const w = local.wallets.find(x => x.id === wallet.id);
      if (!w) return { error: "Wallet not found" };
      const decrypted = await ethers.Wallet.fromEncryptedJson(w.encryptedJson, password);
      const provider  = await getArcProvider();
      const connected = decrypted.connect(provider);

      if (opts.tokenAddress) {
        const decimals = TOKEN_DECIMALS[opts.tokenAddress.toLowerCase()] ?? 6;
        const amountInt = BigInt(Math.round(parseFloat(opts.amount) * Math.pow(10, decimals)));
        const data = await encodeCall("transfer(address,uint256)", [opts.to, amountInt]);
        const tx = await withRetry(() => connected.sendTransaction({ to: opts.tokenAddress, data }));
        return { txHash: tx.hash };
      }
      const tx = await withRetry(() => connected.sendTransaction({ to: opts.to, value: ethers.parseEther(opts.amount) }));
      return { txHash: tx.hash };
    } catch (e) {
      const isRateLimit = /request limit reached|-32011/i.test(String(e));
      return { error: isRateLimit ? "Arc's testnet RPC is rate-limited right now — please try again in a moment." : /password|invalid/i.test(String(e)) ? "Incorrect password" : (e as Error).message };
    }
  }

  // MetaMask
  const provider = getMetaMaskProvider();
  if (!provider) return { error: "No wallet provider found in this browser" };
  const switchError = await ensureArcNetwork(provider);
  if (switchError) return { error: switchError };

  try {
    if (opts.tokenAddress) {
      // Real ERC-20 transfer: the transaction goes TO THE TOKEN CONTRACT,
      // with the recipient and amount encoded in the calldata — not a plain
      // value-transfer to the recipient (which would just move 0 native
      // currency and never touch the token at all).
      const decimals = TOKEN_DECIMALS[opts.tokenAddress.toLowerCase()] ?? 6;
      const amountInt = BigInt(Math.round(parseFloat(opts.amount) * Math.pow(10, decimals)));
      const data = await encodeCall("transfer(address,uint256)", [opts.to, amountInt]);
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: opts.tokenAddress, data }],
      }) as string;
      return { txHash };
    }

    // No token address — genuine native-currency transfer
    const valueHex = "0x" + BigInt(Math.floor(parseFloat(opts.amount) * 1e18)).toString(16);
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: wallet.address, to: opts.to, value: valueHex }],
    }) as string;
    return { txHash };
  } catch (e) { return { error: (e as Error).message }; }
}
