"use client";
import { useState } from "react";
import { usePasswordPromptStore } from "@/store/passwordPromptStore";
import { Lock } from "lucide-react";

/**
 * Mounted once app-wide (see Providers.tsx). Any call to requestPassword()
 * from lib/walletExec.ts pops this up — used when signing with a local
 * self-custody wallet, which needs the password to decrypt the key.
 */
export function GlobalPasswordPrompt() {
  const { active, resolve, close } = usePasswordPromptStore();
  const [pw, setPw] = useState("");

  if (!active) return null;

  const submit = () => {
    if (!pw) return;
    resolve?.(pw);
    setPw("");
    close();
  };
  const cancel = () => {
    resolve?.(null);
    setPw("");
    close();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 flex items-end justify-center" onClick={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="w-full max-w-md bg-glow-card border-t border-glow-border rounded-t-3xl p-5 pb-10 space-y-4">
        <div className="w-12 h-1.5 bg-glow-border rounded-full mx-auto mb-2"/>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-glow-accent"/>
          <h3 className="text-base font-bold text-glow-text">Confirm Transaction</h3>
        </div>
        <p className="text-xs text-glow-muted">Enter your wallet password to sign this transaction. Nothing is stored — you'll be asked again next time.</p>
        <input value={pw} onChange={e => setPw(e.target.value)} type="password" autoFocus
          onKeyDown={e => { if (e.key === "Enter" && pw) submit(); }}
          placeholder="Wallet password"
          className="w-full bg-glow-surface border-2 border-glow-border rounded-2xl px-4 py-3 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50"/>
        <div className="flex gap-2">
          <button onClick={cancel} className="flex-1 py-3 bg-glow-surface border border-glow-border text-glow-muted font-semibold rounded-2xl">Cancel</button>
          <button onClick={submit} disabled={!pw} className="flex-1 py-3 bg-glow-gradient text-white font-bold rounded-2xl disabled:opacity-50">Sign &amp; Send</button>
        </div>
      </div>
    </div>
  );
}
