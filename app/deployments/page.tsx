'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useWalletStore } from '@/store/walletStore';
import {
  Package,
  ExternalLink,
  Copy,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Code2,
  Trash2,
  Eye,
  Zap,
  Calendar,
  Hash,
} from 'lucide-react';
import { truncateAddress, formatRelativeTime, copyToClipboard } from '@/lib/utils';

const MOCK_CONTRACTS = [
  {
    id: '1',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'GlowToken',
    abi: [],
    bytecode: '0x',
    network: 'Arc Testnet',
    chain_id: 5042002,
    tx_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    deployedAt: new Date(Date.now() - 3600000),
    verified: true,
    gas_used: '245000',
    constructorArgs: ['GlowToken', 'GLOW', '1000000'],
  },
  {
    id: '2',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'NFTMarketplace',
    abi: [],
    bytecode: '0x',
    network: 'Arc Testnet',
    chain_id: 5042002,
    tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    deployedAt: new Date(Date.now() - 86400000),
    verified: false,
    gas_used: '890000',
    constructorArgs: [],
  },
  {
    id: '3',
    address: '0x9876543210fedcba9876543210fedcba98765432',
    name: 'StakingPool',
    abi: [],
    bytecode: '0x',
    network: 'Arc Testnet',
    chain_id: 5042002,
    tx_hash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    deployedAt: new Date(Date.now() - 172800000),
    verified: true,
    gas_used: '412000',
    constructorArgs: [],
  },
];

export default function DeploymentsPage() {
  const { address, isConnected } = useWalletStore();
  const [contracts, setContracts] = useState(MOCK_CONTRACTS);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<typeof MOCK_CONTRACTS[0] | null>(null);

  const filtered = contracts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterVerified === 'all' ||
      (filterVerified === 'verified' && c.verified) ||
      (filterVerified === 'unverified' && !c.verified);
    return matchesSearch && matchesFilter;
  });

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleVerify = async (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) => (c.id === contractId ? { ...c, verified: true } : c))
    );
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsLoading(false);
  };

  const stats = {
    total: contracts.length,
    verified: contracts.filter((c) => c.verified).length,
    unverified: contracts.filter((c) => !c.verified).length,
    totalGas: contracts.reduce((acc, c) => acc + parseInt(c.gas_used || '0'), 0),
  };

  return (
    <AppLayout title="Deployments" description="Track and manage your deployed smart contracts">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Contracts', value: stats.total, icon: Package, color: 'text-glow-accent' },
            { label: 'Verified', value: stats.verified, icon: CheckCircle, color: 'text-emerald-400' },
            { label: 'Unverified', value: stats.unverified, icon: AlertCircle, color: 'text-amber-400' },
            { label: 'Total Gas Used', value: stats.totalGas.toLocaleString(), icon: Zap, color: 'text-glow-cyan' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-glow-card flex items-center justify-center">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or address..."
              className="w-full bg-glow-surface border border-glow-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex rounded-lg border border-glow-border overflow-hidden">
              {(['all', 'verified', 'unverified'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterVerified(f)}
                  className={`px-3 py-2 text-xs capitalize transition-colors ${
                    filterVerified === f
                      ? 'bg-glow-accent text-white'
                      : 'text-gray-400 hover:text-white hover:bg-glow-card'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <Button variant="secondary" size="sm" onClick={handleRefresh} isLoading={isLoading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Contracts Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No contracts found</h3>
            <p className="text-sm text-gray-600">
              {searchQuery ? 'Try adjusting your search' : 'Deploy your first contract from the Editor'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contract) => (
              <Card
                key={contract.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedContract?.id === contract.id
                    ? 'border-glow-accent/30 bg-glow-accent/5'
                    : 'hover:border-glow-border/80'
                }`}
                onClick={() => setSelectedContract(selectedContract?.id === contract.id ? null : contract)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: contract info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-glow-accent/10 flex items-center justify-center flex-shrink-0">
                      <Code2 className="w-5 h-5 text-glow-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{contract.name}</h3>
                        {contract.verified ? (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" /> Unverified
                          </Badge>
                        )}
                        <Badge variant="info" className="text-xs">{contract.network}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="font-mono">{truncateAddress(contract.address)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(contract.address); }}
                            className="hover:text-gray-300 transition-colors"
                          >
                            {copiedAddress === contract.address ? (
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatRelativeTime(contract.deployedAt)}</span>
                        </div>
                        {contract.gas_used && (
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>{parseInt(contract.gas_used).toLocaleString()} gas</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!contract.verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleVerify(contract.id); }}
                      >
                        Verify
                      </Button>
                    )}
                    <a
                      href={`https://testnet.arcscan.app/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg text-gray-500 hover:text-glow-cyan hover:bg-glow-card transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedContract?.id === contract.id && (
                  <div className="mt-4 pt-4 border-t border-glow-border space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Contract Address</p>
                        <p className="text-xs font-mono text-gray-300 break-all">{contract.address}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                        <p className="text-xs font-mono text-gray-300 break-all">{contract.tx_hash}</p>
                      </div>
                    </div>

                    {contract.constructorArgs && contract.constructorArgs.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Constructor Arguments</p>
                        <div className="flex flex-wrap gap-2">
                          {contract.constructorArgs.map((arg, i) => (
                            <code key={i} className="text-xs bg-glow-bg border border-glow-border rounded px-2 py-1 text-gray-300">
                              {arg}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm">
                        <Eye className="w-3 h-3 mr-1" /> View ABI
                      </Button>
                      <Button variant="secondary" size="sm">
                        <Code2 className="w-3 h-3 mr-1" /> Interact
                      </Button>
                      <a
                        href={`https://testnet.arcscan.app/tx/${contract.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="secondary" size="sm">
                          <ExternalLink className="w-3 h-3 mr-1" /> Explorer
                        </Button>
                      </a>
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
