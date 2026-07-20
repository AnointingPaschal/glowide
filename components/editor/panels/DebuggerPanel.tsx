"use client";
import { useState, useMemo } from "react";
import {
  Bug, Search, Loader2, AlertTriangle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers, Database, HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TraceStep {
  pc: number; op: string; gas: number; gasCost: number; depth: number;
  stack?: string[]; memory?: string[]; storage?: Record<string,string>;
}
interface TxData {
  hash: string; from: string; to: string | null; value: string;
  gas: string; gasPrice: string; input: string; blockNumber: string | null;
}
interface ReceiptData {
  status: string; gasUsed: string; contractAddress: string | null;
  logs: Array<{ address: string; topics: string[]; data: string }>;
}

function hexToDec(hex?: string | null): string {
  if (!hex) return "0";
  try { return BigInt(hex).toString(); } catch { return hex; }
}

export function DebuggerPanel() {
  const [txHash, setTxHash]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [tx, setTx]           = useState<TxData|null>(null);
  const [receipt, setReceipt] = useState<ReceiptData|null>(null);
  const [steps, setSteps]     = useState<TraceStep[]>([]);
  const [traceUnsupported, setTraceUnsupported] = useState<string|null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const loadTrace = async () => {
    if (!txHash.trim()) return;
    setLoading(true); setError(null); setSteps([]); setTx(null); setReceipt(null);
    setTraceUnsupported(null); setStepIdx(0);
    try {
      const res = await fetch(`/api/debug/trace?tx=${encodeURIComponent(txHash.trim())}`);
      const d = await res.json() as {
        tx?: TxData; receipt?: ReceiptData;
        trace?: { structLogs?: TraceStep[] } | null;
        traceError?: string | null; error?: string;
      };
      if (!res.ok) { setError(d.error ?? "Trace failed"); return; }
      setTx(d.tx ?? null);
      setReceipt(d.receipt ?? null);
      if (d.trace?.structLogs?.length) {
        setSteps(d.trace.structLogs);
      } else if (d.traceError) {
        setTraceUnsupported(d.traceError);
      }
    } catch (e) {
      setError(String(e));
    } finally { setLoading(false); }
  };

  const current = steps[stepIdx];
  const canPrev = stepIdx > 0;
  const canNext = stepIdx < steps.length - 1;

  const stackView = useMemo(() => (current?.stack ?? []).slice().reverse(), [current]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Bug className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Debugger</span>
        </div>
        <p className="text-[10px] text-glow-muted/60 mb-3">Step through any Arc Testnet transaction's execution, opcode by opcode.</p>
        <div className="flex gap-2">
          <input value={txHash} onChange={e=>setTxHash(e.target.value)} onKeyDown={e=>e.key==="Enter" && loadTrace()}
            placeholder="0x transaction hash…"
            className="flex-1 bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs font-mono text-glow-text placeholder-glow-muted/30 focus:outline-none focus:border-glow-accent/50"/>
          <button onClick={loadTrace} disabled={loading||!txHash.trim()}
            className="px-3 py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5">
            {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Search className="w-3.5 h-3.5"/>}
            Debug
          </button>
        </div>
        {error && (
          <div className="mt-2 px-3 py-2 rounded-xl text-[10px] flex items-center gap-2 bg-red-500/10 text-red-400">
            <AlertTriangle className="w-3 h-3 flex-shrink-0"/><span className="break-words">{error}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!tx && !loading && !error && (
          <div className="text-center py-14 px-4">
            <Bug className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
            <p className="text-sm text-glow-muted/50">Paste a transaction hash to debug</p>
            <p className="text-xs text-glow-muted/30 mt-1">Works for any tx on Arc Testnet</p>
          </div>
        )}

        {tx && (
          <div className="p-4 space-y-4">
            {/* Tx summary */}
            <div className="bg-glow-surface border border-glow-border rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-glow-muted uppercase tracking-wider">Status</span>
                {receipt?.status === "0x1"
                  ? <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><CheckCircle2 className="w-3 h-3"/>Success</span>
                  : receipt?.status === "0x0"
                  ? <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold"><XCircle className="w-3 h-3"/>Reverted</span>
                  : <span className="text-[10px] text-glow-muted">Pending</span>}
              </div>
              <Row label="From" value={tx.from} mono/>
              <Row label="To" value={tx.to ?? receipt?.contractAddress ?? "Contract Creation"} mono/>
              <Row label="Value" value={`${hexToDec(tx.value)} wei`}/>
              <Row label="Gas Used" value={receipt ? hexToDec(receipt.gasUsed) : "—"}/>
              <Row label="Block" value={tx.blockNumber ? hexToDec(tx.blockNumber) : "pending"}/>
            </div>

            {/* Trace unsupported notice */}
            {traceUnsupported && steps.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="text-[11px] text-amber-400 font-semibold">Opcode trace unavailable</p>
                  <p className="text-[10px] text-amber-300/80 mt-0.5">{traceUnsupported}</p>
                  <p className="text-[10px] text-amber-300/60 mt-1">Arc's RPC may not expose debug_traceTransaction publicly — transaction details above are still accurate.</p>
                </div>
              </div>
            )}

            {/* Stepper */}
            {steps.length > 0 && (
              <>
                <div className="bg-glow-surface border border-glow-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-glow-muted uppercase tracking-wider">Step {stepIdx+1} / {steps.length}</span>
                    <span className="text-[10px] font-mono text-glow-accent">depth {current?.depth ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <StepBtn icon={ChevronsLeft} onClick={()=>setStepIdx(0)} disabled={!canPrev}/>
                    <StepBtn icon={ChevronLeft} onClick={()=>setStepIdx(i=>Math.max(0,i-1))} disabled={!canPrev}/>
                    <div className="flex-1 bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-center">
                      <span className="text-sm font-mono font-bold text-glow-accent">{current?.op}</span>
                      <span className="text-[10px] text-glow-muted ml-2">pc {current?.pc}</span>
                    </div>
                    <StepBtn icon={ChevronRight} onClick={()=>setStepIdx(i=>Math.min(steps.length-1,i+1))} disabled={!canNext}/>
                    <StepBtn icon={ChevronsRight} onClick={()=>setStepIdx(steps.length-1)} disabled={!canNext}/>
                  </div>
                  <input type="range" min={0} max={steps.length-1} value={stepIdx}
                    onChange={e=>setStepIdx(Number(e.target.value))}
                    className="w-full accent-glow-accent"/>
                  <div className="flex justify-between text-[10px] text-glow-muted/60 mt-1">
                    <span>gas: {current?.gas}</span>
                    <span>cost: {current?.gasCost}</span>
                  </div>
                </div>

                {/* Stack */}
                <Panel icon={Layers} title="Stack" count={stackView.length}>
                  {stackView.length === 0 && <EmptyRow text="Empty"/>}
                  {stackView.map((v,i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1 font-mono text-[10px]">
                      <span className="text-glow-muted/40 w-6">{stackView.length-1-i}</span>
                      <span className="text-glow-text truncate">{v}</span>
                    </div>
                  ))}
                </Panel>

                {/* Memory */}
                <Panel icon={HardDrive} title="Memory" count={current?.memory?.length ?? 0}>
                  {(!current?.memory || current.memory.length === 0) && <EmptyRow text="Empty"/>}
                  {current?.memory?.map((chunk,i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1 font-mono text-[10px]">
                      <span className="text-glow-muted/40 w-10">{(i*32).toString(16).padStart(4,"0")}</span>
                      <span className="text-glow-text/80 truncate">{chunk}</span>
                    </div>
                  ))}
                </Panel>

                {/* Storage */}
                <Panel icon={Database} title="Storage" count={Object.keys(current?.storage ?? {}).length}>
                  {(!current?.storage || Object.keys(current.storage).length === 0) && <EmptyRow text="No storage writes at this step"/>}
                  {Object.entries(current?.storage ?? {}).map(([k,v]) => (
                    <div key={k} className="px-2.5 py-1.5 font-mono text-[10px] border-b border-glow-border/20 last:border-0">
                      <p className="text-glow-muted/50 truncate">{k}</p>
                      <p className="text-glow-text truncate">{v}</p>
                    </div>
                  ))}
                </Panel>
              </>
            )}

            {/* Logs/events */}
            {receipt && receipt.logs.length > 0 && (
              <Panel icon={Layers} title="Events" count={receipt.logs.length}>
                {receipt.logs.map((log,i) => (
                  <div key={i} className="px-2.5 py-2 border-b border-glow-border/20 last:border-0">
                    <p className="text-[10px] font-mono text-glow-accent truncate">{log.address}</p>
                    <p className="text-[9px] font-mono text-glow-muted/60 truncate mt-0.5">{log.topics[0]}</p>
                  </div>
                ))}
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label:string; value:string; mono?:boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-glow-muted">{label}</span>
      <span className={cn("text-[10px] text-glow-text truncate max-w-[65%]", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function StepBtn({ icon:Icon, onClick, disabled }: { icon:React.ElementType; onClick():void; disabled?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-lg bg-glow-bg border border-glow-border text-glow-muted hover:text-glow-accent hover:border-glow-accent/40 disabled:opacity-30 disabled:hover:text-glow-muted transition-colors">
      <Icon className="w-3.5 h-3.5"/>
    </button>
  );
}

function Panel({ icon:Icon, title, count, children }: { icon:React.ElementType; title:string; count:number; children:React.ReactNode }) {
  return (
    <div className="bg-glow-surface border border-glow-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-glow-border/40 bg-glow-card/40">
        <Icon className="w-3 h-3 text-glow-accent"/>
        <span className="text-[10px] font-semibold text-glow-text uppercase tracking-wider">{title}</span>
        <span className="text-[9px] text-glow-muted/50 ml-auto">{count}</span>
      </div>
      <div className="max-h-40 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text:string }) {
  return <p className="text-[10px] text-glow-muted/40 italic px-2.5 py-3 text-center">{text}</p>;
}
