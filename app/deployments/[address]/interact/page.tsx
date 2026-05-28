'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useWalletStore } from '@/store/walletStore';
import { createPublicClient, http, defineChain, encodeFunctionData, decodeFunctionResult } from 'viem';
import { truncateAddress, copyToClipboard } from '@/lib/utils';
import { ArrowLeft, Play, Send, Copy, CheckCircle, ExternalLink, ChevronDown, ChevronUp, Loader2, BookOpen, Zap, Eye, Edit3 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const arcTestnet = defineChain({
  id: 5042002, name: "Arc Testnet", network: "arc-testnet",
  nativeCurrency: { decimals: 6, name: "USD Coin", symbol: "USDC" },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] }, public: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app" } },
  testnet: true,
});

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

interface AbiItem {
  type: string;
  name?: string;
  inputs?: { name: string; type: string; internalType?: string }[];
  outputs?: { name: string; type: string; internalType?: string }[];
  stateMutability?: string;
}

interface ContractData {
  address: string;
  name: string;
  abi: AbiItem[];
  verified: boolean;
  chain_id: number;
  tx_hash: string;
}

function FunctionCard({ fn, address, abi }: { fn: AbiItem; address: string; abi: AbiItem[] }) {
  const { address: walletAddress } = useWalletStore();
  const [expanded, setExpanded] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRead = fn.stateMutability === 'view' || fn.stateMutability === 'pure';
  const isPayable = fn.stateMutability === 'payable';
  const fnInputs = fn.inputs ?? [];
  const fnOutputs = fn.outputs ?? [];

  const execute = async () => {
    setLoading(true);
    setResult(null);
    try {
      const args = fnInputs.map(i => {
        const val = inputs[i.name] ?? '';
        if (i.type.includes('uint') || i.type.includes('int')) return BigInt(val || '0');
        if (i.type === 'bool') return val.toLowerCase() === 'true';
        return val;
      });

      if (isRead) {
        const data = await publicClient.readContract({
          address: address as `0x${string}`,
          abi,
          functionName: fn.name!,
          args,
        });
        setResult(typeof data === 'bigint' ? data.toString() : JSON.stringify(data, null, 2));
        toast.success('Read successful');
      } else {
        if (!walletAddress || !window.ethereum) { toast.error('Connect your wallet first'); return; }
        const calldata = encodeFunctionData({ abi, functionName: fn.name!, args });
        const txHash = await (window.ethereum as { request: (a: { method: string; params: unknown[] }) => Promise<string> }).request({
          method: 'eth_sendTransaction',
          params: [{ from: walletAddress, to: address, data: calldata }],
        });
        setResult(`Transaction sent: ${txHash}`);
        toast.success('Transaction sent!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult(`Error: ${msg}`);
      toast.error(msg.slice(0, 80));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-glow-surface/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isRead ? 'bg-glow-cyan/10' : 'bg-glow-accent/10'}`}>
            {isRead ? <Eye className={`w-4 h-4 text-glow-cyan`} /> : <Edit3 className="w-4 h-4 text-glow-accent" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-white font-mono">{fn.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={isRead ? 'info' : 'purple'} className="text-[10px]">
                {fn.stateMutability}
              </Badge>
              {fnInputs.length > 0 && <span className="text-[10px] text-gray-500">{fnInputs.length} input{fnInputs.length !== 1 ? 's' : ''}</span>}
              {fnOutputs.length > 0 && <span className="text-[10px] text-gray-500">→ {fnOutputs.map(o => o.type).join(', ')}</span>}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-glow-border space-y-3 pt-3">
          {fnInputs.map(inp => (
            <Input
              key={inp.name}
              label={`${inp.name} (${inp.type})`}
              placeholder={inp.type}
              value={inputs[inp.name] ?? ''}
              onChange={e => setInputs(prev => ({ ...prev, [inp.name]: e.target.value }))}
            />
          ))}

          {isPayable && (
            <Input label="Value (USDC)" type="number" placeholder="0" value={inputs['__value'] ?? ''} onChange={e => setInputs(p => ({ ...p, __value: e.target.value }))} />
          )}

          <Button
            onClick={execute}
            isLoading={loading}
            variant={isRead ? 'secondary' : 'gradient'}
            size="sm"
            className="w-full"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : isRead ? <Play className="w-3.5 h-3.5 mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
            {isRead ? 'Call' : 'Send Transaction'}
          </Button>

          {result && (
            <div className="p-3 bg-glow-bg border border-glow-border rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Result</span>
                <button onClick={() => { copyToClipboard(result); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-gray-500 hover:text-gray-300">
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="text-xs text-glow-cyan font-mono whitespace-pre-wrap break-all">{result}</pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function InteractPage() {
  const params = useParams();
  const address = params.address as string;
  const { isConnected } = useWalletStore();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'read' | 'write' | 'events'>('read');

  useEffect(() => {
    if (!address) return;
    // Fetch from Supabase via API
    fetch(`/api/contracts/${address}`)
      .then(r => r.json())
      .then(d => { if (d.contract) setContract(d.contract); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <AppLayout title="Interact">
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-glow-accent animate-spin" /></div>
      </AppLayout>
    );
  }

  if (!contract) {
    return (
      <AppLayout title="Interact">
        <div className="p-6 max-w-3xl mx-auto">
          <Link href="/deployments" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Deployments
          </Link>
          <Card className="p-8 text-center">
            <p className="text-gray-400 mb-4">Contract not found or ABI not available.</p>
            <p className="text-xs text-gray-600 font-mono">{address}</p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const parsedAbi: AbiItem[] = typeof contract.abi === 'string' ? JSON.parse(contract.abi) : contract.abi;
  const functions = parsedAbi.filter(i => i.type === 'function');
  const events = parsedAbi.filter(i => i.type === 'event');
  const readFns = functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writeFns = functions.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure');

  return (
    <AppLayout title={`Interact · ${contract.name}`}>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Back */}
        <Link href="/deployments" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Deployments
        </Link>

        {/* Contract header */}
        <Card className="p-4 md:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-glow-accent/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-glow-accent" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">{contract.name}</h1>
                <p className="text-xs font-mono text-gray-400">{truncateAddress(contract.address, 8)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={contract.verified ? 'success' : 'warning'} className="text-xs">
                {contract.verified ? '✓ Verified' : 'Unverified'}
              </Badge>
              <Badge variant="info" className="text-xs">Arc Testnet</Badge>
              <a href={`https://testnet.arcscan.app/address/${contract.address}`} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="h-7 text-xs">
                  <ExternalLink className="w-3 h-3 mr-1" />ArcScan
                </Button>
              </a>
            </div>
          </div>

          {!isConnected && (
            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">Connect your wallet to send write transactions.</p>
            </div>
          )}
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Read Functions', value: readFns.length, color: 'text-glow-cyan' },
            { label: 'Write Functions', value: writeFns.length, color: 'text-glow-accent' },
            { label: 'Events', value: events.length, color: 'text-emerald-400' },
          ].map(s => (
            <Card key={s.label} className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-glow-border">
          {(['read', 'write', 'events'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-glow-accent-light border-b-2 border-glow-accent' : 'text-gray-500 hover:text-gray-300'}`}>
              {t === 'read' ? `Read (${readFns.length})` : t === 'write' ? `Write (${writeFns.length})` : `Events (${events.length})`}
            </button>
          ))}
        </div>

        {/* Functions */}
        {tab === 'read' && (
          <div className="space-y-2">
            {readFns.length === 0 ? <EmptyState msg="No read functions" /> : readFns.map(fn => <FunctionCard key={fn.name} fn={fn} address={contract.address} abi={parsedAbi} />)}
          </div>
        )}

        {tab === 'write' && (
          <div className="space-y-2">
            {writeFns.length === 0 ? <EmptyState msg="No write functions" /> : writeFns.map(fn => <FunctionCard key={fn.name} fn={fn} address={contract.address} abi={parsedAbi} />)}
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-2">
            {events.length === 0 ? <EmptyState msg="No events" /> : events.map(ev => (
              <Card key={ev.name} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white font-mono">{ev.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ({(ev.inputs ?? []).map(i => `${i.type} ${i.name}`).join(', ')})
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-gray-500 text-sm">{msg}</p>
    </div>
  );
}
