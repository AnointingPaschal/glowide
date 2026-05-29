'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Search,
  ExternalLink,
  Copy,
  CheckCircle,
  Clock,
  Hash,
  Activity,
  Box,
  Wallet,
  Code2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { truncateAddress, copyToClipboard, formatRelativeTime } from '@/lib/utils';

type ResultType = 'address' | 'transaction' | 'block' | 'token' | null;

interface ExplorerResult {
  type: ResultType;
  data: Record<string, unknown>;
}

export default function ExplorerPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const recentSearches = [
    { label: '0x1234...5678', type: 'address' },
    { label: '0xabcd...ef12', type: 'transaction' },
    { label: 'Block #1,234,567', type: 'block' },
  ];

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/explorer?' + new URLSearchParams({ query: q }));
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError('Nothing found for this query. Make sure it is a valid Arc Testnet address, transaction hash, or block number.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.type === 'address') {
      const d = result.data as Record<string, string>;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-glow-accent/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-glow-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Address</h3>
              <p className="text-xs text-gray-500">Arc Testnet</p>
            </div>
            <Badge variant="info" className="ml-auto">Address</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Address" value={d.address} mono copyable onCopy={handleCopy} copied={copied} />
            <InfoRow label="Balance" value={`${d.balance || '0'} USDC`} />
            <InfoRow label="Transaction Count" value={d.transactionCount || '0'} />
            <InfoRow label="Code Hash" value={d.codeHash === '0x' ? 'No code (EOA)' : truncateAddress(d.codeHash)} />
          </div>

          <div className="flex gap-2 mt-4">
            <a href={`https://testnet.arcscan.app/address/${d.address}`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" /> View on ArcScan
              </Button>
            </a>
          </div>
        </div>
      );
    }

    if (result.type === 'transaction') {
      const d = result.data as Record<string, string | number | boolean>;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Transaction</h3>
              <p className="text-xs text-gray-500">Arc Testnet</p>
            </div>
            <Badge variant={d.status === 1 ? 'success' : 'error'} className="ml-auto">
              {d.status === 1 ? 'Success' : 'Failed'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Hash" value={truncateAddress(d.hash as string)} mono copyable onCopy={handleCopy} copied={copied} fullValue={d.hash as string} />
            <InfoRow label="Block" value={`#${d.blockNumber}`} />
            <InfoRow label="From" value={truncateAddress(d.from as string)} mono copyable onCopy={handleCopy} copied={copied} fullValue={d.from as string} />
            <InfoRow label="To" value={d.to ? truncateAddress(d.to as string) : 'Contract Creation'} mono={!!d.to} />
            <InfoRow label="Value" value={`${d.value || '0'} USDC`} />
            <InfoRow label="Gas Used" value={`${(d.gasUsed as number)?.toLocaleString()} / ${(d.gas as number)?.toLocaleString()}`} />
          </div>

          <a href={`https://testnet.arcscan.app/tx/${d.hash}`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" /> View on ArcScan
            </Button>
          </a>
        </div>
      );
    }

    if (result.type === 'block') {
      const d = result.data as Record<string, string | number>;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-glow-cyan/20 flex items-center justify-center">
              <Box className="w-5 h-5 text-glow-cyan" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Block #{d.number}</h3>
              <p className="text-xs text-gray-500">Arc Testnet</p>
            </div>
            <Badge variant="info" className="ml-auto">Block</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Block Hash" value={truncateAddress(d.hash as string)} mono copyable onCopy={handleCopy} copied={copied} fullValue={d.hash as string} />
            <InfoRow label="Parent Hash" value={truncateAddress(d.parentHash as string)} mono />
            <InfoRow label="Transactions" value={String(d.transactions)} />
            <InfoRow label="Gas Used" value={`${(d.gasUsed as number)?.toLocaleString()}`} />
            <InfoRow label="Timestamp" value={new Date((d.timestamp as number) * 1000).toLocaleString()} />
            <InfoRow label="Miner" value={truncateAddress(d.miner as string)} mono />
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-gray-400">Unknown result type</p>
      </div>
    );
  };

  return (
    <AppLayout title="Explorer" description="Browse the Arc Testnet blockchain">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Search Bar */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Search Arc Testnet</h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by address, transaction hash, block number, or token..."
                className="w-full bg-glow-bg border border-glow-border rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50 transition-colors"
              />
            </div>
            <Button
              variant="gradient"
              onClick={() => handleSearch()}
              isLoading={isLoading}
              className="px-6"
            >
              Search
            </Button>
          </div>

          {/* Recent Searches */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-600">Recent:</span>
            {recentSearches.map((s) => (
              <button
                key={s.label}
                onClick={() => { setQuery(s.label); handleSearch(s.label); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-glow-accent transition-colors"
              >
                {s.type === 'address' && <Wallet className="w-3 h-3" />}
                {s.type === 'transaction' && <Activity className="w-3 h-3" />}
                {s.type === 'block' && <Box className="w-3 h-3" />}
                {s.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Chain', value: 'Arc Testnet', icon: Activity, color: 'text-glow-accent' },
            { label: 'Chain ID', value: '5042002', icon: Hash, color: 'text-glow-cyan' },
            { label: 'Gas Token', value: 'USDC', icon: Coins, color: 'text-emerald-400' },
            { label: 'Explorer', value: 'ArcScan', icon: ExternalLink, color: 'text-amber-400' },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-sm font-semibold text-white">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <Card className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-glow-accent animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Querying Arc Testnet...</p>
          </Card>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Card className="p-6 border-red-500/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </Card>
        )}

        {/* Result */}
        {result && !isLoading && (
          <Card className="p-6">{renderResult()}</Card>
        )}

        {/* Empty State (no search yet) */}
        {!result && !isLoading && !error && (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-glow-accent/10 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-glow-accent" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Explore Arc Testnet</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
              Look up any address, transaction, block, or token on the Arc Testnet blockchain.
              Real-time data from the Arc RPC endpoint.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
              {[
                { icon: Wallet, label: 'Address', example: '0x1234...' },
                { icon: Activity, label: 'Transaction', example: '0xabcd...' },
                { icon: Box, label: 'Block', example: '#1234567' },
                { icon: Code2, label: 'Contract', example: '0x9876...' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-glow-card border border-glow-border">
                  <item.icon className="w-5 h-5 text-glow-accent" />
                  <span className="text-xs font-medium text-gray-300">{item.label}</span>
                  <span className="text-xs text-gray-600">{item.example}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// Helper Component
function InfoRow({
  label,
  value,
  mono = false,
  copyable = false,
  onCopy,
  copied,
  fullValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: (v: string) => void;
  copied?: string | null;
  fullValue?: string;
}) {
  const copyVal = fullValue || value;
  return (
    <div className="bg-glow-bg rounded-lg p-3 border border-glow-border/50">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-sm text-gray-200 flex-1 min-w-0 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
        {copyable && onCopy && (
          <button onClick={() => onCopy(copyVal)} className="flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors">
            {copied === copyVal ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
