/**
 * Shared wallet-signing dispatch — used anywhere in the app that needs to
 * send a real transaction (AI chat tool calls, DeFi actions, etc). Resolves
 * whichever wallet is currently active (local self-custody / Circle
 * Developer Wallet / MetaMask) and signs through the right path for that
 * wallet type. Not a React hook — reads store state directly via
 * `.getState()`, so it can be called from plain async functions.
 */
import { useCircleStore } from "@/store/circleStore";
import { useLocalWalletStore } from "@/store/localWalletStore";
import { useActiveWalletStore } from "@/store/activeWalletStore";
import { useWalletStore } from "@/store/walletStore";
import { requestPassword } from "@/store/passwordPromptStore";

export type ResolvedWallet =
  | { type: "local"; id: string; address: string }
  | { type: "circle"; id: string; address?: string }
  | { type: "metamask"; address: string };

export function resolveActiveWallet(): ResolvedWallet | null {
  const active  = useActiveWalletStore.getState().active;
  const local   = useLocalWalletStore.getState();
  const circle  = useCircleStore.getState();
  const mm      = useWalletStore.getState();

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

/**
 * Sign and send an arbitrary contract call. Works for whichever wallet type
 * is active — Circle routes server-side, MetaMask prompts the browser
 * extension, local wallets prompt for a password via the global modal.
 */
export async function executeContractCall(opts: {
  contractAddress: string; signature: string; params: Array<string | bigint | number>; blockchain?: string;
}): Promise<ExecResult> {
  const wallet = resolveActiveWallet();
  if (!wallet) return { error: "No wallet connected — connect one in the Wallet tab first." };

  if (wallet.type === "circle") {
    const res = await fetch("/api/circle/dev-wallet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contract", walletId: wallet.id, blockchain: opts.blockchain ?? "ETH-SEPOLIA",
        contractAddress: opts.contractAddress, abiFunctionSignature: opts.signature,
        abiParameters: opts.params.map(p => typeof p === "bigint" ? p.toString() : p),
      }),
    });
    const d = await res.json() as { id?: string; txHash?: string; error?: string };
    if (d.error) return { error: d.error };
    return { txHash: d.txHash ?? d.id };
  }

  const data = await encodeCall(opts.signature, opts.params).catch(e => { throw e; });

  if (wallet.type === "metamask") {
    const provider = (window as unknown as { ethereum?: { request:(a:{method:string;params?:unknown[]})=>Promise<unknown> } }).ethereum;
    if (!provider) return { error: "No wallet provider found in this browser" };
    try {
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: opts.contractAddress, data }],
      }) as string;
      return { txHash };
    } catch (e) { return { error: (e as Error).message }; }
  }

  // Local self-custody wallet — prompt for password, decrypt, sign, broadcast
  const password = await requestPassword();
  if (!password) return { error: "Signing cancelled" };
  try {
    const local = useLocalWalletStore.getState();
    const w = local.wallets.find(x => x.id === wallet.id);
    if (!w) return { error: "Wallet not found" };
    const { ethers } = await import("ethers");
    const decrypted = await ethers.Wallet.fromEncryptedJson(w.encryptedJson, password);
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const connected = decrypted.connect(provider);
    const tx = await connected.sendTransaction({ to: opts.contractAddress, data });
    return { txHash: tx.hash };
  } catch (e) {
    return { error: /password|invalid/i.test(String(e)) ? "Incorrect password" : (e as Error).message };
  }
}

/** Simple native/token transfer — same wallet dispatch as executeContractCall. */
export async function executeTransfer(opts: {
  to: string; amount: string; tokenAddress?: string; blockchain?: string;
}): Promise<ExecResult> {
  const wallet = resolveActiveWallet();
  if (!wallet) return { error: "No wallet connected — connect one in the Wallet tab first." };

  if (wallet.type === "circle") {
    const res = await fetch("/api/circle/dev-wallet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer", walletId: wallet.id, to: opts.to, amount: opts.amount, blockchain: opts.blockchain ?? "ETH-SEPOLIA" }),
    });
    const d = await res.json() as { id?: string; txHash?: string; error?: string };
    if (d.error) return { error: d.error };
    return { txHash: d.txHash ?? d.id };
  }

  if (wallet.type === "metamask") {
    const provider = (window as unknown as { ethereum?: { request:(a:{method:string;params?:unknown[]})=>Promise<unknown> } }).ethereum;
    if (!provider) return { error: "No wallet provider found in this browser" };
    try {
      const valueHex = "0x" + BigInt(Math.floor(parseFloat(opts.amount) * 1e18)).toString(16);
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: opts.to, value: opts.tokenAddress ? "0x0" : valueHex }],
      }) as string;
      return { txHash };
    } catch (e) { return { error: (e as Error).message }; }
  }

  const password = await requestPassword();
  if (!password) return { error: "Signing cancelled" };
  try {
    const local = useLocalWalletStore.getState();
    const w = local.wallets.find(x => x.id === wallet.id);
    if (!w) return { error: "Wallet not found" };
    const { ethers } = await import("ethers");
    const decrypted = await ethers.Wallet.fromEncryptedJson(w.encryptedJson, password);
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const connected = decrypted.connect(provider);
    const tx = await connected.sendTransaction({ to: opts.to, value: ethers.parseEther(opts.amount) });
    return { txHash: tx.hash };
  } catch (e) {
    return { error: /password|invalid/i.test(String(e)) ? "Incorrect password" : (e as Error).message };
  }
}
