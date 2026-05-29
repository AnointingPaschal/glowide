'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useWalletStore } from '@/store/walletStore';
import {
  Package, ExternalLink, Copy, CheckCircle, Clock, AlertCircle,
  Search, RefreshCw, Code2, Trash2, Zap, Calendar, Hash, Eye,
} from 'lucide-react';
import { truncateAddress, formatRelativeTime, copyToClipboard } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Contract {
  id: string; address: string; name: string; abi: unknown[];
  bytecode: string; network: string; chain_id: number;
  tx_hash: string; deployedAt: string | Date; verified: boolean;
  gas_used: string; constructorArgs?: string[];
  deployer?: string; status?: string;
}

export default function DeploymentsPage() {
  const { address, isConnected } = useWalletStore();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (address) params.set('deployer', address);
      const res = await fetch(`/api/contracts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts ?? []);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [address]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const filtered = contracts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterVerified === 'all' || (filterVerified === 'verified' && c.verified) || (filterVerified === 'unverified' && !c.verified);
    return matchSearch && matchFilter;
  });

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleVerify = async (contractId: string) => {
    try {
      const c = contracts.find(x => x.id === contractId);
      if (!c) return;
      const res = await fetch('/api/contracts/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractAddress: c.address, sourceCode: '', contractName: c.name }) });
      if (res.ok) {
        setContracts(prev => prev.map(x => x.id === contractId ? { ...x, verified: true } : x));
        toast.success('Contract verified');
      }
    } catch { toast.error('Verification failed'); }
  };

  const stats = { total: contracts.length, verified: contracts.filter(c => c.verified).length, unverified: contracts.filter(c => !c.verified).length, totalGas: contracts.reduce((acc, c) => acc + parseInt(c.gas_used || '0'), 0) };

  return (
    <AppLayout title="Deployments" description="Track and manage your deployed smart contracts">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { label:'Total Contracts', value:stats.total, icon:Package, color:'text-[var(--glow-accent)]' },
            { label:'Verified', value:stats.verified, icon:CheckCircle, color:'text-emerald-400' },
            { label:'Unverified', value:stats.unverified, icon:AlertCircle, color:'text-amber-400' },
            { label:'Total Gas', value:stats.totalGas.toLocaleString(), icon:Zap, color:'text-[var(--glow-cyan)]' },
          ].map(s => (
            <Card key={s.label} className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--glow-card)] flex items-center justify-center flex-shrink-0">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-[var(--glow-muted)]">{s.label}</p>
                  <p className="text-lg font-semibold text-[var(--glow-text)]">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--glow-muted)]" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or address…"
              className="w-full bg-[var(--glow-surface)] border border-[var(--glow-border)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--glow-text)] placeholder-[var(--glow-muted)] focus:outline-none focus:border-[var(--glow-accent)]/50" />
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-[var(--glow-border)] overflow-hidden">
              {(['all','verified','unverified'] as const).map(f => (
                <button key={f} onClick={() => setFilterVerified(f)} className={`px-3 py-2 text-xs capitalize transition-colors ${filterVerified===f ? 'bg-[var(--glow-accent)] text-white' : 'text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)]'}`}>{f}</button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={fetchContracts} isLoading={isLoading}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[var(--glow-accent)] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-[var(--glow-muted)] mb-4" />
            <h3 className="text-lg font-medium text-[var(--glow-muted)] mb-2">No contracts found</h3>
            <p className="text-sm text-[var(--glow-muted)]">{searchQuery ? 'Try adjusting your search' : 'Deploy your first contract from the Editor'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(contract => (
              <Card key={contract.id} className={`p-4 cursor-pointer transition-all ${selectedContract?.id===contract.id ? 'border-[var(--glow-accent)]/30 bg-[var(--glow-accent)]/5' : 'hover:border-[var(--glow-border)]/80'}`}
                onClick={() => setSelectedContract(selectedContract?.id===contract.id ? null : contract)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[var(--glow-accent)]/10 flex items-center justify-center flex-shrink-0">
                      <Code2 className="w-5 h-5 text-[var(--glow-accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-[var(--glow-text)]">{contract.name}</h3>
                        <Badge variant={contract.verified ? 'success' : 'warning'} className="text-xs">
                          {contract.verified ? <><CheckCircle className="w-3 h-3 mr-1" />Verified</> : <><AlertCircle className="w-3 h-3 mr-1" />Unverified</>}
                        </Badge>
                        <Badge variant="info" className="text-xs">Arc Testnet</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--glow-muted)]">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="font-mono">{truncateAddress(contract.address)}</span>
                          <button onClick={e => { e.stopPropagation(); handleCopy(contract.address); }} className="hover:text-[var(--glow-text)] transition-colors">
                            {copiedAddress===contract.address ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatRelativeTime(contract.deployedAt)}</span>
                        </div>
                        {contract.gas_used && <div className="flex items-center gap-1"><Zap className="w-3 h-3" /><span>{parseInt(contract.gas_used).toLocaleString()} gas</span></div>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/deployments/${contract.address}/interact`} onClick={e => e.stopPropagation()}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--glow-accent)] border border-[var(--glow-accent)]/30 hover:bg-[var(--glow-accent)]/10 transition-colors">
                      <Zap className="w-3 h-3" />Interact
                    </Link>
                    <a href={`https://testnet.arcscan.app/address/${contract.address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="p-2 rounded-lg text-[var(--glow-muted)] hover:text-[var(--glow-cyan)] hover:bg-[var(--glow-card)] transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {selectedContract?.id===contract.id && (
                  <div className="mt-4 pt-4 border-t border-[var(--glow-border)] space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><p className="text-xs text-[var(--glow-muted)] mb-1">Contract Address</p><p className="text-xs font-mono text-[var(--glow-text)] break-all">{contract.address}</p></div>
                      <div><p className="text-xs text-[var(--glow-muted)] mb-1">Transaction Hash</p><p className="text-xs font-mono text-[var(--glow-text)] break-all">{contract.tx_hash}</p></div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {!contract.verified && <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); handleVerify(contract.id); }}>Verify</Button>}
                      <Link href={`/deployments/${contract.address}/interact`}><Button variant="secondary" size="sm"><Eye className="w-3 h-3 mr-1" />Interact</Button></Link>
                      <a href={`https://testnet.arcscan.app/tx/${contract.tx_hash}`} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm"><ExternalLink className="w-3 h-3 mr-1" />Explorer</Button></a>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
