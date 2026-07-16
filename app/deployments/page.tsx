'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { useWalletStore } from '@/store/walletStore';
import {
  Package, ExternalLink, Copy, CheckCircle, Search,
  RefreshCw, Zap, Plus, X, Upload, AlertCircle, Loader2,
} from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Contract {
  id: string; address: string; name: string; abi: unknown[];
  tx_hash: string; created_at: string; verified: boolean;
  deployer?: string; status?: string; chain_id?: number;
  network?: string; explorerUrl?: string;
}

const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

async function checkAddressOnChain(address: string): Promise<boolean> {
  try {
    const res = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }),
    });
    const d = await res.json();
    return d.result && d.result !== '0x' && d.result !== '0x0';
  } catch { return false; }
}

export default function DeploymentsPage() {
  const { address, isConnected } = useWalletStore();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [scope, setScope] = useState<'mine'|'all'>('mine');

  // Manual add form state
  const [manualAddr, setManualAddr]   = useState('');
  const [manualName, setManualName]   = useState('');
  const [manualAbi, setManualAbi]     = useState('');
  const [manualTx, setManualTx]       = useState('');
  const [isAdding, setIsAdding]       = useState(false);
  const [checkingChain, setCheckingChain] = useState(false);
  const [chainStatus, setChainStatus] = useState<'unknown'|'found'|'not-found'>('unknown');

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = (scope === 'mine' && address) ? `?deployer=${address}` : '';
      const res = await fetch(`/api/contracts${params}`);
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts ?? []);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [address, scope]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const copyAddress = async (addr: string) => {
    await navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  // Check contract address on-chain
  const checkOnChain = async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(manualAddr.trim())) {
      toast.error('Invalid address format'); return;
    }
    setCheckingChain(true);
    const found = await checkAddressOnChain(manualAddr.trim());
    setChainStatus(found ? 'found' : 'not-found');
    setCheckingChain(false);
    if (!found) toast.error('No contract found at this address on Arc Testnet');
  };

  // Save manually added contract to DB
  const handleManualAdd = async () => {
    const addr = manualAddr.trim();
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      toast.error('Valid contract address required'); return;
    }
    let parsedAbi: unknown[] = [];
    if (manualAbi.trim()) {
      try { parsedAbi = JSON.parse(manualAbi.trim()); }
      catch { toast.error('Invalid ABI JSON'); return; }
    }
    setIsAdding(true);
    try {
      const res = await fetch('/api/contracts/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: addr,
          txHash: manualTx.trim() || '0x' + '0'.repeat(64),
          blockNumber: '0',
          gasUsed: '0',
          abi: parsedAbi,
          bytecode: '',
          contractName: manualName.trim() || 'Contract',
          deployer: address ?? addr,
        }),
      });
      if (res.ok) {
        toast.success('Contract added to dashboard');
        setShowManualAdd(false);
        setManualAddr(''); setManualName(''); setManualAbi(''); setManualTx('');
        setChainStatus('unknown');
        fetchContracts();
      } else {
        toast.error('Failed to save — check console');
      }
    } catch (e) { toast.error(String(e)); }
    finally { setIsAdding(false); }
  };

  const filtered = contracts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Deployments">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-glow-text">Deployed Contracts</h1>
            <p className="text-sm text-glow-muted mt-0.5">Arc Testnet · Chain 5042002</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowManualAdd(!showManualAdd)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-lg hover:bg-glow-accent/25 transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Contract
            </button>
            <button onClick={fetchContracts}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-glow-card border border-glow-border text-glow-muted text-xs rounded-lg hover:text-glow-text transition-colors">
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Manual add panel */}
        {showManualAdd && (
          <div className="bg-glow-card border border-glow-accent/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-glow-accent" />
                <span className="text-sm font-semibold text-glow-text">Add Deployed Contract</span>
              </div>
              <button onClick={() => { setShowManualAdd(false); setChainStatus('unknown'); }}
                className="text-glow-muted hover:text-glow-text"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-glow-muted uppercase tracking-wider">Contract Address *</label>
                <div className="flex gap-2">
                  <input value={manualAddr} onChange={e => { setManualAddr(e.target.value); setChainStatus('unknown'); }}
                    placeholder="0x…"
                    className="flex-1 bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50" />
                  <button onClick={checkOnChain} disabled={checkingChain}
                    className="px-3 py-2 bg-glow-surface border border-glow-border rounded-xl text-xs text-glow-muted hover:text-glow-text transition-colors disabled:opacity-50">
                    {checkingChain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Check'}
                  </button>
                </div>
                {chainStatus === 'found'     && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Contract found on Arc Testnet</p>}
                {chainStatus === 'not-found' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />No contract at this address</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-glow-muted uppercase tracking-wider">Contract Name</label>
                <input value={manualName} onChange={e => setManualName(e.target.value)}
                  placeholder="MyToken"
                  className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm text-glow-text focus:outline-none focus:border-glow-accent/50" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-glow-muted uppercase tracking-wider">
                  ABI (JSON) <span className="text-glow-muted/50">— paste from compiler output to enable interaction</span>
                </label>
                <textarea value={manualAbi} onChange={e => setManualAbi(e.target.value)}
                  placeholder='[{"type":"function","name":"balanceOf",...}]'
                  rows={4}
                  className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-xs font-mono text-glow-text focus:outline-none focus:border-glow-accent/50 resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-glow-muted uppercase tracking-wider">TX Hash (optional)</label>
                <input value={manualTx} onChange={e => setManualTx(e.target.value)}
                  placeholder="0x…"
                  className="w-full bg-glow-bg border border-glow-border rounded-xl px-3 py-2 text-sm font-mono text-glow-text focus:outline-none focus:border-glow-accent/50" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowManualAdd(false)} className="px-4 py-2 text-sm text-glow-muted border border-glow-border rounded-xl">Cancel</button>
              <button onClick={handleManualAdd} disabled={isAdding || !manualAddr}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-glow-accent text-white rounded-xl hover:bg-glow-accent/90 disabled:opacity-50">
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Contract
              </button>
            </div>
          </div>
        )}

        {/* Scope toggle */}
        {isConnected && (
          <div className="flex gap-1 bg-glow-surface border border-glow-border/50 rounded-xl p-1 w-fit">
            {(['mine','all'] as const).map(sc => (
              <button key={sc} onClick={() => setScope(sc)}
                className={cn('px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  scope === sc ? 'bg-glow-accent/20 text-glow-accent-light' : 'text-glow-muted/60 hover:text-glow-text')}>
                {sc === 'mine' ? 'My Contracts' : 'All Deployments'}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-glow-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or address…"
            className="w-full bg-glow-card border border-glow-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-glow-text placeholder-glow-muted/50 focus:outline-none focus:border-glow-accent/50" />
        </div>

        {/* Contract list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-glow-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-glow-card border border-glow-border flex items-center justify-center">
              <Package className="w-8 h-8 text-glow-muted/50" />
            </div>
            <div>
              <p className="text-glow-muted font-medium">No contracts found</p>
              <p className="text-sm text-glow-muted/70 mt-1">Deploy a contract from the Editor, or add one manually using the button above.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(contract => (
              <div key={contract.id} className="bg-glow-card border border-glow-border rounded-2xl p-4 hover:border-glow-accent/30 transition-all">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-glow-gradient flex items-center justify-center flex-shrink-0 shadow-glow-sm">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-glow-text">{contract.name || 'Contract'}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-glow-muted">{truncateAddress(contract.address, 8)}</span>
                        <button onClick={() => copyAddress(contract.address)}
                          className="text-glow-muted hover:text-glow-text transition-colors">
                          {copiedAddr === contract.address ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a href={contract.explorerUrl || `https://testnet.arcscan.app/address/${contract.address}`} target="_blank" rel="noopener noreferrer"
                          className="text-glow-muted hover:text-glow-cyan transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={contract.verified ? 'success' : 'default'} className="text-xs">
                      {contract.verified ? '✓ Verified' : 'Unverified'}
                    </Badge>
                    <Badge variant="info" className="text-xs">{contract.network || 'Arc Testnet'}</Badge>
                    {contract.tx_hash && contract.tx_hash !== '0x' + '0'.repeat(64) && (
                      <a href={`${(contract.explorerUrl||'https://testnet.arcscan.app/address/'+contract.address).replace('/address/'+contract.address,'')}/tx/${contract.tx_hash}`} target="_blank" rel="noopener noreferrer">
                        <Badge variant="default" className="text-xs hover:border-glow-accent/40 cursor-pointer">
                          TX ↗
                        </Badge>
                      </a>
                    )}
                    <Link href={`/deployments/${contract.address}/interact`}>
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-glow-accent/15 border border-glow-accent/30 text-glow-accent-light text-xs font-medium rounded-lg hover:bg-glow-accent/25 transition-colors cursor-pointer">
                        <Zap className="w-3 h-3" />Interact
                      </span>
                    </Link>
                    <a href={contract.explorerUrl || `https://testnet.arcscan.app/address/${contract.address}`} target="_blank" rel="noopener noreferrer">
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-glow-card border border-glow-border text-glow-muted text-xs rounded-lg hover:text-glow-text transition-colors cursor-pointer">
                        Explorer ↗
                      </span>
                    </a>
                  </div>
                </div>

                {contract.deployer && (
                  <div className="mt-3 pt-3 border-t border-glow-border flex items-center gap-4 text-xs text-glow-muted flex-wrap">
                    <span>Deployer: <span className="font-mono text-glow-text">{truncateAddress(contract.deployer, 6)}</span></span>
                    {contract.created_at && <span>Deployed: <span className="text-glow-text">{new Date(contract.created_at).toLocaleDateString()}</span></span>}
                    {(contract.abi as unknown[])?.length > 0 && (
                      <span className="text-emerald-400">✓ ABI available ({(contract.abi as unknown[]).length} items)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
