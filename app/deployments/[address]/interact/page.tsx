'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWalletStore } from '@/store/walletStore';
import {
  ArrowLeft, Play, Send, Copy, CheckCircle, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Zap, Eye, Edit3,
  AlertTriangle, Upload, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/utils';

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

// ── Types ──────────────────────────────────────────────────────────────────
interface AbiInput { name: string; type: string; }
interface AbiItem  { type: string; name?: string; inputs?: AbiInput[]; outputs?: AbiInput[]; stateMutability?: string; }
interface ContractData { address: string; name: string; abi: AbiItem[]; verified: boolean; tx_hash?: string; created_at?: string; }

// ── keccak4 selector ────────────────────────────────────────────────────────
function keccakHash(input: Uint8Array): Uint8Array {
  const RC: bigint[] = [0x0000000000000001n,0x0000000000008082n,0x800000000000808An,0x8000000080008000n,0x000000000000808Bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,0x000000000000008An,0x0000000000000088n,0x0000000080008009n,0x000000008000000An,0x000000008000808Bn,0x800000000000008Bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x000000000000800An,0x800000008000000An,0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n];
  const R = [0,36,3,41,18,1,44,10,45,2,62,6,43,15,61,28,55,25,21,56,27,20,39,8,14];
  const PI = [0,10,20,5,15,16,1,11,21,6,7,17,2,12,22,23,8,18,3,13,24,9,19,4,14];
  const state = new BigInt64Array(25);
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((input.length+1)/rate)*rate);
  padded.set(input); padded[input.length]=0x01; padded[padded.length-1]|=0x80;
  for(let b=0;b<padded.length;b+=rate){
    for(let i=0;i<rate/8;i++){let lane=0n;for(let j=0;j<8;j++)lane|=BigInt(padded[b+i*8+j])<<BigInt(j*8);state[i]^=lane;}
    const rol=(x:bigint,n:number)=>BigInt.asUintN(64,(x<<BigInt(n))|(x>>BigInt(64-n)));
    for(let r=0;r<24;r++){const C=Array.from({length:5},(_,x)=>state[x]^state[x+5]^state[x+10]^state[x+15]^state[x+20]);const D=C.map((c,x)=>c^rol(C[(x+1)%5],1));for(let i=0;i<25;i++)state[i]^=D[i%5];const B=new BigInt64Array(25);for(let i=0;i<25;i++)B[PI[i]]=rol(state[i],R[i]);for(let x=0;x<5;x++)for(let y=0;y<5;y++){const i=x+y*5;state[i]=B[i]^(~B[(x+1)%5+y*5]&B[(x+2)%5+y*5]);}state[0]^=BigInt.asIntN(64,RC[r]);}
  }
  const out=new Uint8Array(32);for(let i=0;i<4;i++){const lane=state[i];for(let j=0;j<8&&i*8+j<32;j++)out[i*8+j]=Number((lane>>BigInt(j*8))&0xffn);}
  return out;
}
function funcSelector(sig: string): string {
  const hash = keccakHash(new TextEncoder().encode(sig));
  return Array.from(hash.slice(0,4)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function encodeParam(type: string, val: string): string {
  if(type==='address') return val.replace(/^0x/i,'').toLowerCase().padStart(64,'0');
  if(type==='bool') return (val==='true'||val==='1'?1:0).toString(16).padStart(64,'0');
  if(type.startsWith('uint')||type.startsWith('int')) try{return BigInt(val||'0').toString(16).padStart(64,'0');}catch{return '0'.padStart(64,'0');}
  if(type.startsWith('bytes')&&type!=='bytes'){const s=parseInt(type.slice(5));return val.replace(/^0x/i,'').padEnd(s*2,'0').slice(0,s*2).padEnd(64,'0');}
  const hex=Array.from(new TextEncoder().encode(val)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return '0000000000000000000000000000000000000000000000000000000000000020'+val.length.toString(16).padStart(64,'0')+hex.padEnd(Math.ceil(hex.length/64)*64,'0');
}
function buildCalldata(name: string, inputs: AbiInput[], values: Record<string,string>): string {
  const sig=`${name}(${inputs.map(i=>i.type).join(',')})`;
  const sel=funcSelector(sig);
  let dynamic='',head='',dyOffset=inputs.length*32;
  for(const inp of inputs){
    const t=inp.type,v=values[inp.name]??'';
    if(t==='string'||t==='bytes'||t.endsWith('[]')){
      head+=dyOffset.toString(16).padStart(64,'0');
      const enc=encodeParam(t,v);dynamic+=enc;dyOffset+=enc.length/2;
    } else { head+=encodeParam(t,v); }
  }
  return '0x'+sel+head+dynamic;
}
function decodeResult(hex: string, outputs: AbiInput[]): string {
  if(!hex||hex==='0x') return '(empty)';
  const d=hex.slice(2);
  if(!outputs.length) return hex;
  return outputs.map((o,i)=>{
    const chunk=d.slice(i*64,(i+1)*64)||'';
    const label=o.name?`${o.name}: `:'';
    if(o.type==='address') return `${label}0x${chunk.slice(24)}`;
    if(o.type==='bool') return `${label}${parseInt(chunk,16)!==0?'true':'false'}`;
    if(o.type.startsWith('uint')||o.type.startsWith('int')) return `${label}${BigInt('0x'+chunk).toString()}`;
    return `${label}${hex}`;
  }).join('\n');
}

// ── Function card ──────────────────────────────────────────────────────────
function FunctionCard({ fn, contractAddress }: { fn: AbiItem; contractAddress: string }) {
  const { address: wallet } = useWalletStore();
  const [open, setOpen]       = useState(false);
  const [values, setValues]   = useState<Record<string,string>>({});
  const [result, setResult]   = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);
  const inputs  = fn.inputs  ?? [];
  const outputs = fn.outputs ?? [];
  const isRead  = fn.stateMutability==='view'||fn.stateMutability==='pure';

  const execute = async () => {
    setLoading(true); setResult(null);
    try {
      const calldata = buildCalldata(fn.name!, inputs, values);
      const provider = (window as Window & { ethereum?: { request:(a:{method:string;params?:unknown[]})=>Promise<unknown> } }).ethereum;
      if(isRead){
        // Use wallet provider if connected, else direct RPC
        let raw:string;
        if(provider&&wallet){
          raw = await provider.request({method:'eth_call',params:[{to:contractAddress,data:calldata},'latest']}) as string;
        } else {
          const res=await fetch(ARC_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:contractAddress,data:calldata},'latest']})});
          const d=await res.json(); if(d.error)throw new Error(d.error.message); raw=d.result;
        }
        setResult(decodeResult(raw,outputs));
        toast.success('Call successful');
      } else {
        if(!provider||!wallet){toast.error('Connect wallet for write operations');return;}
        const gasRes=await fetch(ARC_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_estimateGas',params:[{from:wallet,to:contractAddress,data:calldata}]})});
        const gasD=await gasRes.json();
        const gas=gasD.result?`0x${Math.ceil(parseInt(gasD.result,16)*1.3).toString(16)}`:'0x30000';
        const txHash=await provider.request({method:'eth_sendTransaction',params:[{from:wallet,to:contractAddress,data:calldata,gas}]}) as string;
        setResult(`TX sent:\n${txHash}`);
        toast.success('Transaction sent!');
      }
    } catch(e){
      const msg=(e as Error).message;
      setResult(`Error: ${msg}`);
      toast.error(msg.slice(0,80));
    } finally{setLoading(false);}
  };

  return (
    <div className="bg-glow-card border border-glow-border rounded-xl overflow-hidden">
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-glow-surface/40 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', isRead?'bg-glow-cyan/10':'bg-glow-accent/10')}>
            {isRead?<Eye className="w-4 h-4 text-glow-cyan"/>:<Edit3 className="w-4 h-4 text-glow-accent"/>}
          </div>
          <div>
            <p className="text-sm font-semibold text-glow-text font-mono">{fn.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md border', isRead?'text-cyan-400 bg-cyan-500/10 border-cyan-500/25':'text-purple-400 bg-purple-500/10 border-purple-500/25')}>{fn.stateMutability}</span>
              {inputs.length>0 && <span className="text-[10px] text-glow-muted">{inputs.length} input{inputs.length!==1?'s':''}</span>}
              {outputs.length>0 && <span className="text-[10px] text-glow-muted">→ {outputs.map(o=>o.type).join(', ')}</span>}
            </div>
          </div>
        </div>
        {open?<ChevronUp className="w-4 h-4 text-glow-muted flex-shrink-0"/>:<ChevronDown className="w-4 h-4 text-glow-muted flex-shrink-0"/>}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-glow-border pt-3">
          {inputs.map(inp=>(
            <div key={inp.name} className="space-y-1">
              <label className="text-xs text-glow-muted font-medium">{inp.name} <span className="font-mono text-glow-muted/60">{inp.type}</span></label>
              <input value={values[inp.name]??''} onChange={e=>setValues(p=>({...p,[inp.name]:e.target.value}))}
                placeholder={inp.type}
                className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-sm text-glow-text font-mono focus:outline-none focus:border-glow-accent/50" />
            </div>
          ))}
          <button onClick={execute} disabled={loading}
            className={cn('w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
              isRead?'bg-glow-cyan/15 border border-glow-cyan/30 text-glow-cyan hover:bg-glow-cyan/25':'bg-glow-gradient text-white hover:opacity-90',
              loading&&'opacity-60 cursor-not-allowed')}>
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:isRead?<Play className="w-4 h-4"/>:<Send className="w-4 h-4"/>}
            {isRead?'Call':'Send Transaction'}
          </button>
          {result&&(
            <div className="p-3 bg-glow-bg border border-glow-border rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-glow-muted font-semibold">RESULT</span>
                <button onClick={()=>{navigator.clipboard.writeText(result);setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
                  {copied?<CheckCircle className="w-3.5 h-3.5 text-emerald-400"/>:<Copy className="w-3.5 h-3.5 text-glow-muted hover:text-glow-text"/>}
                </button>
              </div>
              <pre className="text-xs text-glow-cyan font-mono whitespace-pre-wrap break-all">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function InteractPage() {
  const params = useParams();
  const rawAddress = (params.address as string) ?? '';
  const { isConnected } = useWalletStore();
  const [contract, setContract]     = useState<ContractData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'read'|'write'|'events'>('read');
  const [notFound, setNotFound]     = useState(false);
  const [abiInput, setAbiInput]     = useState('');
  const [showAbiForm, setShowAbiForm] = useState(false);
  const [contractName, setContractName] = useState('');
  const [isOnChain, setIsOnChain]   = useState<boolean | null>(null);

  // Normalise address
  const address = rawAddress.startsWith('0x') ? rawAddress : `0x${rawAddress}`;

  useEffect(() => {
    if (!address || address === '0x') return;
    setLoading(true);

    // Check on-chain existence
    fetch(ARC_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }),
    }).then(r => r.json()).then(d => {
      setIsOnChain(!!d.result && d.result !== '0x' && d.result !== '0x0');
    }).catch(() => setIsOnChain(null));

    // Try DB
    fetch(`/api/contracts/${address}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (d.contract) setContract(d.contract); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [address]);

  const handleAbiSubmit = () => {
    try {
      const parsed: AbiItem[] = JSON.parse(abiInput);
      setContract({ address, name: contractName || 'Contract', abi: parsed, verified: false });
      setNotFound(false);
      setShowAbiForm(false);
      // Save to DB
      fetch('/api/contracts/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address, txHash: '0x'+'0'.repeat(64), blockNumber: '0', gasUsed: '0', abi: parsed, bytecode: '', contractName: contractName || 'Contract', deployer: address }),
      }).catch(() => {});
      toast.success('ABI loaded');
    } catch { toast.error('Invalid ABI JSON'); }
  };

  const abi = contract?.abi ?? [];
  const fns = abi.filter(i => i.type === 'function');
  const readFns  = fns.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writeFns = fns.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure');
  const events   = abi.filter(i => i.type === 'event');

  if (loading) return (
    <AppLayout title="Interact">
      <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-glow-accent animate-spin"/></div>
    </AppLayout>
  );

  return (
    <AppLayout title={contract ? `Interact · ${contract.name}` : 'Interact'}>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Link href="/deployments" className="inline-flex items-center gap-2 text-sm text-glow-muted hover:text-glow-text transition-colors">
          <ArrowLeft className="w-4 h-4"/>Back to Deployments
        </Link>

        {/* Contract header */}
        <div className="bg-glow-card border border-glow-border rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-glow-text">{contract?.name ?? 'Contract'}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-sm text-glow-muted">{truncateAddress(address, 10)}</span>
                <button onClick={() => { navigator.clipboard.writeText(address); toast.success('Copied'); }}
                  className="text-glow-muted hover:text-glow-text"><Copy className="w-3.5 h-3.5"/></button>
                <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                  className="text-glow-muted hover:text-glow-cyan"><ExternalLink className="w-3.5 h-3.5"/></a>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isOnChain === true  && <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>On-chain ✓</span>}
              {isOnChain === false && <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3"/>Not found on Arc</span>}
              <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-glow-surface border border-glow-border text-xs text-glow-muted hover:text-glow-text rounded-lg transition-colors">
                <ExternalLink className="w-3 h-3"/>ArcScan
              </a>
            </div>
          </div>
          {!isConnected && (
            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"/>
              <p className="text-xs text-amber-300">Connect your wallet to send write transactions. Read functions work without a wallet.</p>
            </div>
          )}
        </div>

        {/* No ABI / not found */}
        {(notFound || !contract || abi.length === 0) && (
          <div className="bg-glow-card border border-amber-500/25 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-semibold text-glow-text">ABI not available</p>
                <p className="text-xs text-glow-muted mt-0.5">
                  This contract wasn't saved with an ABI. Paste the ABI below to interact with it — or view it on ArcScan.
                </p>
              </div>
            </div>

            {!showAbiForm ? (
              <button onClick={() => setShowAbiForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-sm font-medium rounded-xl hover:bg-glow-accent/25 transition-colors">
                <Upload className="w-4 h-4"/>Paste ABI to interact
              </button>
            ) : (
              <div className="space-y-3">
                <input value={contractName} onChange={e => setContractName(e.target.value)} placeholder="Contract name (e.g. MyToken)"
                  className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50" />
                <textarea value={abiInput} onChange={e => setAbiInput(e.target.value)} rows={6}
                  placeholder='[{"type":"function","name":"balanceOf","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"}]'
                  className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs font-mono text-glow-text focus:outline-none focus:border-glow-accent/50 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowAbiForm(false)} className="px-4 py-2 text-sm text-glow-muted border border-glow-border rounded-xl">Cancel</button>
                  <button onClick={handleAbiSubmit} className="flex-1 py-2 bg-glow-accent text-white text-sm font-semibold rounded-xl hover:bg-glow-accent/90">Load ABI & Interact</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Function tabs */}
        {contract && abi.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:'Read Functions', value:readFns.length, color:'text-glow-cyan' },
                { label:'Write Functions', value:writeFns.length, color:'text-glow-accent-light' },
                { label:'Events', value:events.length, color:'text-emerald-400' },
              ].map(s=>(
                <div key={s.label} className="bg-glow-card border border-glow-border rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-glow-muted mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-glow-border overflow-x-auto">
              {(['read','write','events'] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)}
                  className={cn('px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                    tab===t?'border-glow-accent text-glow-accent-light':'border-transparent text-glow-muted hover:text-glow-text')}>
                  {t==='read'?`Read (${readFns.length})`:t==='write'?`Write (${writeFns.length})`:`Events (${events.length})`}
                </button>
              ))}
            </div>

            {tab==='read'  && <div className="space-y-2">{readFns.length===0?<p className="py-8 text-center text-glow-muted text-sm">No read functions</p>:readFns.map(fn=><FunctionCard key={fn.name} fn={fn} contractAddress={address}/>)}</div>}
            {tab==='write' && <div className="space-y-2">{writeFns.length===0?<p className="py-8 text-center text-glow-muted text-sm">No write functions</p>:writeFns.map(fn=><FunctionCard key={fn.name} fn={fn} contractAddress={address}/>)}</div>}
            {tab==='events'&& (
              <div className="space-y-2">
                {events.length===0?<p className="py-8 text-center text-glow-muted text-sm">No events</p>:events.map(ev=>(
                  <div key={ev.name} className="bg-glow-card border border-glow-border rounded-xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><Zap className="w-4 h-4 text-emerald-400"/></div>
                    <div>
                      <p className="text-sm font-semibold text-glow-text font-mono">{ev.name}</p>
                      <p className="text-xs text-glow-muted mt-0.5">({(ev.inputs??[]).map(i=>`${i.type} ${i.name}`).join(', ')})</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
