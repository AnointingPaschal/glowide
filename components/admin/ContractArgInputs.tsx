"use client";
import { useState } from "react";
import { Loader2, Rocket, AlertTriangle, CheckCircle, Copy, ExternalLink } from "lucide-react";

interface Props {
  cid: string;
  title: string;
  description: string;
  color: string;
  labels: string[];
  defaults: string[];
  currentAddress: string;
  onDeploy: (id: string, args: string[]) => void;
  deployingId: string | null;
  status: { compiling?:boolean; compiled?:boolean; deploying?:boolean; deployed?:boolean; address?:string; txHash?:string; error?:string };
  isConnected: boolean;
  onSaveAddress: (val: string) => void;
}

const ARC = 'https://testnet.arcscan.app';
const iCls = 'w-full bg-glow-bg border border-glow-border rounded-xl px-3.5 py-2.5 text-xs text-glow-text font-mono placeholder-glow-muted/40 focus:outline-none focus:border-glow-accent/50 transition-colors';

export function ContractArgInputs({ cid, title, description, color, labels, defaults, currentAddress, onDeploy, deployingId, status, isConnected, onSaveAddress }: Props) {
  const [vals, setVals] = useState(defaults);
  const [addrOverride, setAddrOverride] = useState(currentAddress);
  const isDeploying = deployingId === cid;
  const displayAddr = status.address || currentAddress || addrOverride;

  return (
    <div className="bg-glow-card border border-glow-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-glow-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: color + '20', border: `1px solid ${color}30` }}>
            <Rocket className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-glow-text">{title}</p>
            <p className="text-xs text-glow-muted mt-0.5 max-w-sm">{description}</p>
          </div>
        </div>
        {(status.deployed || currentAddress) && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex-shrink-0 ml-3">
            <CheckCircle className="w-3 h-3" />Deployed
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Deployed address display */}
        {displayAddr && (
          <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
            <p className="text-[10px] text-glow-muted uppercase tracking-wider mb-1.5">Contract Address</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-emerald-400 flex-1 break-all">{displayAddr}</code>
              <button onClick={() => navigator.clipboard.writeText(displayAddr)} className="p-1 text-glow-muted hover:text-glow-text flex-shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a href={`${ARC}/address/${displayAddr}`} target="_blank" rel="noopener noreferrer" className="p-1 text-glow-muted hover:text-glow-cyan flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[10px] text-glow-muted mt-1">✓ Auto-saved to database after deployment</p>
          </div>
        )}

        {/* Constructor args */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Constructor Arguments</p>
          {labels.map((label, i) => (
            <div key={i}>
              <p className="text-xs text-glow-muted mb-1.5">{label}</p>
              <input
                value={vals[i] ?? defaults[i]}
                onChange={e => { const n = [...vals]; n[i] = e.target.value; setVals(n); }}
                placeholder={defaults[i] || label}
                className={iCls}
              />
            </div>
          ))}
        </div>

        {/* Manual address paste */}
        <div>
          <p className="text-xs text-glow-muted mb-1.5">Or paste already-deployed address</p>
          <input
            value={addrOverride}
            onChange={e => { setAddrOverride(e.target.value); onSaveAddress(e.target.value); }}
            placeholder="0x… paste if already deployed elsewhere"
            className={iCls}
          />
        </div>

        {/* Status */}
        {(status.compiling || status.deploying) && (
          <div className="flex items-center gap-2 p-3 bg-glow-accent/8 border border-glow-accent/20 rounded-xl">
            <Loader2 className="w-4 h-4 text-glow-accent animate-spin flex-shrink-0" />
            <span className="text-xs text-glow-accent">
              {status.compiling ? 'Compiling with solc + OpenZeppelin v5…' : 'Deploying on Arc Testnet… awaiting confirmation'}
            </span>
          </div>
        )}
        {status.error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300 break-words">{status.error}</p>
          </div>
        )}

        {/* Progress steps */}
        <div className="flex items-center gap-2 text-[10px] text-glow-muted flex-wrap">
          {['Compile', 'Deploy', 'Confirm', 'Save DB'].map((step, i) => {
            const done = (i===0 && (status.compiled || status.deploying || status.deployed))
                      || (i===1 && (status.deploying || status.deployed))
                      || (i===2 && status.deployed)
                      || (i===3 && status.deployed);
            const active = (i===0 && status.compiling) || (i===1 && status.deploying);
            return (
              <span key={step} className="flex items-center gap-1">
                {i > 0 && <span className="opacity-30">›</span>}
                <span className={done ? 'text-emerald-400 font-semibold' : active ? 'text-glow-accent font-semibold' : ''}>
                  {done ? '✓' : active ? '…' : '○'} {step}
                </span>
              </span>
            );
          })}
        </div>

        {/* Deploy button */}
        <button
          onClick={() => onDeploy(cid, vals)}
          disabled={isDeploying || !isConnected}
          className="w-full py-3 bg-glow-gradient text-white font-semibold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          {isDeploying
            ? <><Loader2 className="w-4 h-4 animate-spin" />{status.compiling ? 'Compiling…' : 'Deploying…'}</>
            : <><Rocket className="w-4 h-4" />{(status.deployed || displayAddr) ? 'Redeploy Contract' : `Compile & Deploy ${title}`}</>
          }
        </button>
      </div>
    </div>
  );
}
