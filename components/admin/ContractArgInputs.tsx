"use client";
import { useState } from "react";
import { Loader2, Rocket, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  cid: string;
  labels: string[];
  defaults: string[];
  onDeploy: (id: string, args: string[]) => void;
  deployingId: string | null;
  status: { compiling?:boolean; compiled?:boolean; deploying?:boolean; deployed?:boolean; error?:string };
  isConnected: boolean;
}

const cls = 'w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-xs text-glow-text font-mono placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/50';

export function ContractArgInputs({ cid, labels, defaults, onDeploy, deployingId, status, isConnected }: Props) {
  const [vals, setVals] = useState(defaults);
  const isDeploying = deployingId === cid;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Constructor Arguments</p>
      {labels.map((label, i) => (
        <div key={i}>
          <p className="text-xs text-glow-muted mb-1">{label}</p>
          <input
            value={vals[i] ?? defaults[i]}
            onChange={e => { const n = [...vals]; n[i] = e.target.value; setVals(n); }}
            placeholder={defaults[i]}
            className={cls}
          />
        </div>
      ))}
      {(status.compiling || status.deploying) && (
        <div className="flex items-center gap-2 p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl">
          <Loader2 className="w-4 h-4 text-glow-accent animate-spin"/>
          <span className="text-xs text-glow-accent">
            {status.compiling ? 'Compiling with solc + OpenZeppelin v5…' : 'Deploying on Arc Testnet…'}
          </span>
        </div>
      )}
      {status.error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"/>
          <p className="text-xs text-red-300 break-words">{status.error}</p>
        </div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-glow-muted">
        {['Compile','Deploy','Confirm','Save DB'].map((step, i) => {
          const done = (i===0&&(status.compiled||status.deploying||status.deployed))
                    || (i===1&&(status.deploying||status.deployed))
                    || (i===2&&status.deployed) || (i===3&&status.deployed);
          const active = (i===0&&status.compiling)||(i===1&&status.deploying);
          return (
            <span key={step} className="flex items-center gap-1">
              {i > 0 && <span className="opacity-30">›</span>}
              <span className={done ? 'text-emerald-400' : active ? 'text-glow-accent' : ''}>
                {done ? '✓' : active ? '…' : '○'} {step}
              </span>
            </span>
          );
        })}
      </div>
      <button
        onClick={() => onDeploy(cid, vals)}
        disabled={isDeploying || !isConnected}
        className="w-full py-3 bg-glow-gradient text-white font-semibold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isDeploying
          ? <><Loader2 className="w-4 h-4 animate-spin"/>{status.compiling ? 'Compiling…' : 'Deploying…'}</>
          : <><Rocket className="w-4 h-4"/>{status.deployed ? 'Redeploy' : 'Compile & Deploy'}</>
        }
      </button>
    </div>
  );
}
