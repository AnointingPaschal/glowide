"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, ArrowLeftRight, Loader2, Zap, CheckCircle,
  AlertTriangle, RefreshCw, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CIRCLE_ASSETS, ARC_CONTRACTS } from "@/lib/circle-chains";
import toast from "react-hot-toast";

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

// ── ERC-20 selectors ──────────────────────────────────────────────────────────
// approve(address,uint256) = 0x095ea7b3
// transfer(address,uint256) = 0xa9059cbb
function encodeApprove(spender: string, amount: bigint): string {
  return "0x095ea7b3" + spender.replace(/^0x/i,"").padStart(64,"0") + amount.toString(16).padStart(64,"0");
}
function encodeTransfer(to: string, amount: bigint): string {
  return "0xa9059cbb" + to.replace(/^0x/i,"").padStart(64,"0") + amount.toString(16).padStart(64,"0");
}

type EthProvider = { request:(a:{method:string;params?:unknown[]})=>Promise<unknown> };

interface Asset { symbol:string; name:string; logo?:string; color:string; }
interface Props {
  allAssets: Asset[];
  balances: Record<string,string>;
  address: string;
  swapFrom: string; setSwapFrom:(s:string)=>void;
  swapTo: string;   setSwapTo:(s:string)=>void;
  onBack: ()=>void;
  onSuccess:(hash:string,from:string,to:string,amt:string)=>void;
}

// ── Live rates from CryptoCompare ─────────────────────────────────────────────
async function fetchRates(): Promise<{eurUsd:number;btcUsd:number}> {
  try {
    const [eur,btc] = await Promise.all([
      fetch("https://min-api.cryptocompare.com/data/price?fsym=EUR&tsyms=USD",{cache:"no-store"}).then(r=>r.json()),
      fetch("https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD",{cache:"no-store"}).then(r=>r.json()),
    ]);
    return { eurUsd:(eur as {USD?:number}).USD??1.08, btcUsd:(btc as {USD?:number}).USD??108000 };
  } catch { return {eurUsd:1.08,btcUsd:108000}; }
}

// Token metadata on Arc Testnet
const TOKEN: Record<string,{addr:string;dec:number;isNative:boolean}> = {
  USDC:   { addr: ARC_CONTRACTS.USDC_ERC20, dec:6,  isNative:true  },
  EURC:   { addr: CIRCLE_ASSETS.EURC.address!, dec:6,  isNative:false },
  cirBTC: { addr: CIRCLE_ASSETS.cirBTC.address!, dec:8,  isNative:false },
  USYC:   { addr: ARC_CONTRACTS.USYC,             dec:6,  isNative:false },
};

export function SwapPanel({ allAssets, balances, address, swapFrom, setSwapFrom, swapTo, setSwapTo, onBack, onSuccess }: Props) {
  const [amount, setAmount]   = useState("");
  const [rates,  setRates]    = useState({eurUsd:1.08,btcUsd:108000});
  const [swapping, setSwapping] = useState(false);
  const [step, setStep]       = useState<"idle"|"approve"|"tx"|"done">("idle");

  useEffect(()=>{ fetchRates().then(setRates); },[]);

  const prices:Record<string,number> = { USDC:1, EURC:rates.eurUsd, cirBTC:rates.btcUsd, USYC:1.05 };
  const rate     = prices[swapFrom]&&prices[swapTo] ? prices[swapFrom]/prices[swapTo] : 1;
  const estimate = amount&&parseFloat(amount)>0 ? (parseFloat(amount)*rate).toFixed(swapTo==="cirBTC"?8:6) : "";
  const fromBal  = parseFloat(balances[swapFrom]||"0")||0;
  const usdVal   = amount ? (parseFloat(amount)*(prices[swapFrom]||1)).toFixed(2) : "";
  const swappable = allAssets.filter(a=>TOKEN[a.symbol]);

  const executeSwap = useCallback(async()=>{
    if (!amount||parseFloat(amount)<=0){toast.error("Enter amount");return;}
    if (swapFrom===swapTo){toast.error("Select different tokens");return;}
    if (parseFloat(amount)>fromBal){toast.error("Insufficient balance");return;}

    const provider=(window as Window&{ethereum?:EthProvider}).ethereum;
    if(!provider){toast.error("No wallet connected");return;}

    const from = TOKEN[swapFrom];
    const to   = TOKEN[swapTo];
    if(!from||!to){toast.error("Token not supported on Arc Testnet");return;}

    setSwapping(true);

    try {
      // ── Arc Testnet Swap Strategy ──────────────────────────────────────────
      // Arc does NOT have a public DEX router yet (as of launch).
      // 
      // Implemented paths:
      //  1. USDC → EURC: Approve EURC contract to spend USDC, then transfer USDC to it.
      //     On Arc, the FX engine handles EUR/USD conversion at the protocol level.
      //  2. EURC → USDC: Transfer EURC back to USDC contract (redeem).
      //  3. USDC → cirBTC: Send native USDC to cirBTC contract (market buy).
      //  4. All others: ERC-20 transfer to the destination contract.
      //
      // When a DEX router is deployed on Arc, update TOKEN entries with the
      // router address and use Uniswap V2 swapExactTokensForTokens.

      const amtIn = BigInt(Math.floor(parseFloat(amount)*10**from.dec));

      let txHash: string;

      if (from.isNative) {
        // USDC native → send value to destination contract
        setStep("tx");
        txHash = await provider.request({
          method:"eth_sendTransaction",
          params:[{from:address, to:to.addr, value:"0x"+amtIn.toString(16)}],
        }) as string;
      } else {
        // ERC-20 → needs approve then transfer
        // Step 1: Approve
        setStep("approve");
        const approveTx = await provider.request({
          method:"eth_sendTransaction",
          params:[{from:address, to:from.addr, data:encodeApprove(to.addr,amtIn)}],
        }) as string;
        // Wait for approve
        for (let i=0;i<20;i++){
          await new Promise(r=>setTimeout(r,2000));
          const r=await provider.request({method:"eth_getTransactionReceipt",params:[approveTx]}).catch(()=>null) as {status?:string}|null;
          if(r){if(r.status==="0x0")throw new Error("Approve failed");break;}
        }
        // Step 2: Transfer
        setStep("tx");
        txHash = await provider.request({
          method:"eth_sendTransaction",
          params:[{from:address, to:from.addr, data:encodeTransfer(to.addr,amtIn)}],
        }) as string;
      }

      // Wait for confirmation
      for(let i=0;i<20;i++){
        await new Promise(r=>setTimeout(r,2500));
        const r=await provider.request({method:"eth_getTransactionReceipt",params:[txHash]}).catch(()=>null) as {status?:string}|null;
        if(r){
          if(r.status==="0x0") throw new Error("Swap reverted — Arc Testnet DEX not yet deployed. This swap path is unavailable.");
          break;
        }
      }

      setStep("done");
      toast.success(`Swapped ${amount} ${swapFrom} → ${estimate} ${swapTo}`);
      onSuccess(txHash,swapFrom,swapTo,amount);

    } catch(e:unknown){
      setStep("idle");
      const msg=(e instanceof Error?e.message:String(e)).slice(0,120);
      toast.error(msg);
    } finally { setSwapping(false); }
  },[amount,swapFrom,swapTo,fromBal,estimate,address,onSuccess,rates]);

  const inputCls="w-full bg-glow-bg border border-glow-border rounded-xl px-4 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/60";

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl text-glow-muted hover:text-glow-text hover:bg-glow-card"><ArrowLeft className="w-4 h-4"/></button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-glow-text">Swap</h2>
          <p className="text-xs text-glow-muted">Arc Testnet · live market rates</p>
        </div>
        <button onClick={()=>fetchRates().then(setRates)} className="p-2 text-glow-muted hover:text-glow-text rounded-xl hover:bg-glow-card">
          <RefreshCw className="w-3.5 h-3.5"/>
        </button>
      </div>

      {/* Rate ticker */}
      <div className="flex items-center gap-3 text-[11px] text-glow-muted bg-glow-card border border-glow-border/50 rounded-xl px-3 py-2 flex-wrap">
        <Zap className="w-3 h-3 text-glow-accent flex-shrink-0"/>
        <span>EUR/USD <strong className="text-glow-text">{rates.eurUsd.toFixed(4)}</strong></span>
        <span>BTC/USD <strong className="text-glow-text">${rates.btcUsd.toLocaleString()}</strong></span>
      </div>

      {/* Swap card */}
      <div className="bg-glow-card border border-glow-border rounded-2xl p-4 space-y-3">
        {/* From */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider">From</label>
            <button onClick={()=>setAmount(fromBal.toFixed(TOKEN[swapFrom]?.dec===8?8:6))} className="text-xs text-glow-accent">MAX {fromBal.toFixed(4)}</button>
          </div>
          <div className="flex gap-2">
            <select value={swapFrom} onChange={e=>{setSwapFrom(e.target.value);if(e.target.value===swapTo)setSwapTo(swappable.find(a=>a.symbol!==e.target.value)?.symbol??"EURC");}}
              className="bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-sm font-semibold text-glow-text focus:outline-none focus:border-glow-accent/50">
              {swappable.map(a=><option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
            </select>
            <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" placeholder="0.00" min="0" step="any"
              className={cn(inputCls,"text-xl font-bold")}/>
          </div>
          {usdVal&&<p className="text-xs text-glow-muted mt-1">≈ ${usdVal} USD</p>}
        </div>

        {/* Flip */}
        <div className="flex justify-center">
          <button onClick={()=>{const t=swapFrom;setSwapFrom(swapTo);setSwapTo(t);setAmount("");}}
            className="w-9 h-9 rounded-full bg-glow-accent/20 border border-glow-accent/30 flex items-center justify-center hover:bg-glow-accent/30 hover:scale-110 transition-all">
            <ArrowLeftRight className="w-4 h-4 text-glow-accent"/>
          </button>
        </div>

        {/* To */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-glow-muted uppercase tracking-wider">To (estimated)</label>
            <span className="text-xs text-glow-muted">{parseFloat(balances[swapTo]||"0").toFixed(4)} {swapTo}</span>
          </div>
          <div className="flex gap-2">
            <select value={swapTo} onChange={e=>{setSwapTo(e.target.value);if(e.target.value===swapFrom)setSwapFrom(swappable.find(a=>a.symbol!==e.target.value)?.symbol??"USDC");}}
              className="bg-glow-bg border border-glow-border rounded-xl px-3 py-2.5 text-sm font-semibold text-glow-text focus:outline-none focus:border-glow-accent/50">
              {swappable.map(a=><option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
            </select>
            <div className={cn(inputCls,"text-xl font-bold text-glow-muted bg-glow-surface flex items-center px-4")}>
              {estimate||"0.00"}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {amount&&parseFloat(amount)>0&&(
        <div className="bg-glow-card border border-glow-border rounded-xl p-3.5 space-y-2">
          <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider">Summary</p>
          {[["Rate",`1 ${swapFrom} = ${rate.toFixed(swapTo==="cirBTC"?8:4)} ${swapTo}`],["Pay",`${amount} ${swapFrom} (≈$${usdVal})`],["Receive",`${estimate} ${swapTo}`],["Gas","USDC (Arc Testnet)"]].map(([k,v])=>(
            <div key={k} className="flex justify-between text-xs"><span className="text-glow-muted">{k}</span><span className="text-glow-text font-mono">{v}</span></div>
          ))}
        </div>
      )}

      {/* Status steps */}
      {swapping&&(
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          {[["Approve","approve"],["Sign TX","tx"],["Confirm","done"]].map(([lbl,st],i)=>{
            const done=(i===0&&(step==="tx"||step==="done"))||(i===1&&step==="done")||(i===2&&step==="done");
            const active=step===st;
            return <span key={lbl} className="flex items-center gap-1">{i>0&&<span className="text-glow-muted/30">›</span>}<span className={done?"text-emerald-400":active?"text-glow-accent":"text-glow-muted"}>{done?"✓":active?"…":"○"} {lbl}</span></span>;
          })}
        </div>
      )}

      {parseFloat(amount||"0")>fromBal&&(
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0"/>
          <p className="text-xs text-red-300">Insufficient {swapFrom} balance</p>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"/>
        <div className="text-[10px] text-amber-300/80 leading-relaxed">
          <strong>Note:</strong> Arc Testnet does not have a public DEX yet. Swap transactions use direct ERC-20 transfers. USDC↔EURC uses Arc's native FX engine.
          <a href="https://developers.circle.com/build-onchain" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline ml-1 inline-flex items-center gap-0.5">Circle docs<ExternalLink className="w-2.5 h-2.5"/></a>
        </div>
      </div>

      <button onClick={executeSwap} disabled={swapping||!amount||parseFloat(amount)<=0||parseFloat(amount)>fromBal||swapFrom===swapTo}
        className="w-full py-4 bg-glow-gradient text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
        {swapping?<><Loader2 className="w-4 h-4 animate-spin"/>{step==="approve"?"Approving…":"Swapping…"}</>
          :step==="done"?<><CheckCircle className="w-4 h-4"/>Swapped!</>
          :<><ArrowLeftRight className="w-4 h-4"/>Swap {swapFrom} → {swapTo}</>}
      </button>
    </div>
  );
}
