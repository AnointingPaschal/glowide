"use client";
import { useState } from "react";
import { CheckCircle, Loader2, Rocket, AlertTriangle, Copy, ExternalLink } from "lucide-react";

export interface DeployStatus {
  compiling?: boolean; compiled?: boolean; deploying?: boolean;
  deployed?: boolean; address?: string; txHash?: string; error?: string;
}
interface ContractArg { label: string; placeholder: string; value: string; }
interface ContractMeta {
  id: string; label: string; desc: string; color: string;
  icon: React.ElementType; settingsKey: string; currentAddress: string;
  args: ContractArg[];
}
interface Props {
  contract: ContractMeta; address: string | null; isConnected: boolean;
  deployStatuses: Record<string, DeployStatus>; deployingId: string | null;
  onDeploy: (id: string, args: string[]) => void;
  onSaveAddress: (id: string, val: string) => void;
}

const ARC = 'https://testnet.arcscan.app';
const cls = 'w-full bg-glow-bg border border-glow-border rounded-xl px-3.5 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60 font-mono text-xs';

export function ContractDeployCard({ contract, address, isConnected, deployStatuses, deployingId, onDeploy, onSaveAddress }: Props) {
  const [vals, setVals] = useState(contract.args.map(a => a.value));
  const st = deployStatuses[contract.id] ?? {};
  const Icon = contract.icon;

  return (
    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
      <div className="flex items-start justify-between p-5 border-b border-glow-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: contract.color + '20' }}>
            <Icon className="w-5 h-5" style={{ color: contract.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-glow-text">{contract.label}</p>
            <p className="text-xs text-glow-muted mt-0.5 max-w-sm">{contract.desc}</p>
          </div>
        </div>
        {(st.deployed || contract.currentAddress) && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full ml-3">
            <CheckCircle className="w-3 h-3" />Deployed
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {(st.address || contract.currentAddress) && (
          <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
            <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1.5">Contract Address</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-emerald-400 flex-1 break-all">{st.address || contract.currentAddress}</code>
              <button onClick={() => navigator.clipboard.writeText(st.address || contract.currentAddress || '')} className="p-1 text-glow-muted hover:text-glow-text"><Copy className="w-3.5 h-3.5" /></button>
              <a href={ARC + '/address/' + (st.address || contract.currentAddress)} target="_blank" rel="noopener noreferrer" className="p-1 text-glow-muted hover:text-glow-cyan"><ExternalLink className="w-3.5 h-3.5" /></a>
            </div>
            <p className="text-[10px] text-glow-muted mt-1">Saved as <code className="text-glow-accent">{contract.settingsKey}</code> in DB ✓</p>
          </div>
        )}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Constructor Arguments</p>
          {contract.args.map((arg, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-glow-muted mb-1">{arg.label}</p>
              <input value={vals[i] ?? arg.value} onChange={e => { const n = [...vals]; n[i] = e.target.value; setVals(n); }} placeholder={arg.placeholder} className={cls} />
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-glow-muted mb-1">Or paste existing address</p>
          <input value={contract.currentAddress} onChange={e => onSaveAddress(contract.id, e.target.value)} placeholder="0x… (already deployed)" className={cls} />
        </div>
        {(st.compiling || st.deploying) && (
          <div className="flex items-center gap-3 p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl">
            <Loader2 className="w-4 h-4 text-glow-accent animate-spin" />
            <span className="text-xs text-glow-accent">{st.compiling ? 'Compiling…' : 'Deploying on Arc Testnet…'}</span>
          </div>
        )}
        {st.error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
            <p className="text-xs text-red-300 break-words">{st.error}</p>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-glow-muted flex-wrap">
          {['Compile', 'Deploy', 'Confirm', 'Save DB'].map((step, i) => {
            const done = (i === 0 && (st.compiled || st.deploying || st.deployed)) || (i === 1 && (st.deploying || st.deployed)) || (i === 2 && st.deployed) || (i === 3 && st.deployed);
            const active = (i === 0 && st.compiling) || (i === 1 && st.deploying);
            return (
              <span key={step} className="flex items-center gap-1">
                {i > 0 && <span className="text-glow-muted/30">-&gt;</span>}
                <span className={done ? 'text-emerald-400' : active ? 'text-glow-accent' : ''}>{done ? '✓' : active ? '…' : '○'} {step}</span>
              </span>
            );
          })}
        </div>
        <button onClick={() => onDeploy(contract.id, vals)} disabled={!!deployingId || !isConnected}
          className="w-full py-3 bg-glow-gradient text-white font-semibold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {deployingId === contract.id
            ? <><Loader2 className="w-4 h-4 animate-spin" />{st.compiling ? 'Compiling…' : 'Deploying…'}</>
            : <><Rocket className="w-4 h-4" />{st.deployed || contract.currentAddress ? 'Redeploy' : 'Compile & Deploy'}</>}
        </button>
      </div>
    </div>
  );
}
