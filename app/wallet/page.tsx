'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress, copyToClipboard } from '@/lib/utils';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Send,
  Download,
  AlertCircle,
  DollarSign,
  Coins,
  TrendingUp,
  Activity,
  Lock,
  Shield,
  Zap,
} from 'lucide-react';

const CIRCLE_TOKENS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '💵',
    color: 'from-blue-500/20 to-blue-600/20',
    border: 'border-blue-500/20',
    textColor: 'text-blue-400',
    description: 'Native gas token on Arc Testnet',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    icon: '💶',
    color: 'from-purple-500/20 to-purple-600/20',
    border: 'border-purple-500/20',
    textColor: 'text-purple-400',
    description: 'Euro-backed stablecoin by Circle',
  },
  {
    symbol: 'cirBTC',
    name: 'Circle Bitcoin',
    icon: '₿',
    color: 'from-amber-500/20 to-amber-600/20',
    border: 'border-amber-500/20',
    textColor: 'text-amber-400',
    description: 'Bitcoin wrapped by Circle',
  },
];

export default function WalletPage() {
  const { address, isConnected, balances, setBalances } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendModal, setSendModal] = useState<{ open: boolean; token: string }>({ open: false, token: '' });
  const [sendForm, setSendForm] = useState({ to: '', amount: '' });
  const [isSending, setIsSending] = useState(false);

  const handleCopyAddress = async () => {
    if (!address) return;
    await copyToClipboard(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshBalances = async () => {
    if (!address) return;
    setIsLoading(true);
    const res = await fetch(`/api/wallet/balances?address=${address}`);
    if (res.ok) {
      const data = await res.json();
      setBalances(data);
    }
    setIsLoading(false);
  };

  const handleSend = async () => {
    setIsSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsSending(false);
    setSendModal({ open: false, token: '' });
    setSendForm({ to: '', amount: '' });
  };

  const tokenBalances = {
    USDC: balances.usdc || '0.00',
    EURC: balances.eurc || '0.00',
    cirBTC: balances.cirBTC || '0.00000000',
  };

  if (!isConnected) {
    return (
      <AppLayout title="Wallet" description="Manage your wallet and assets">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
          <div className="w-20 h-20 rounded-full bg-glow-accent/10 flex items-center justify-center mb-6">
            <Wallet className="w-10 h-10 text-glow-accent" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">Connect Your Wallet</h2>
          <p className="text-gray-400 max-w-md mb-8">
            Connect a wallet to view your balances, transfer assets, and interact with Arc Testnet.
          </p>
          <WalletButton />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Wallet" description="Manage your wallet and assets">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Wallet Card */}
        <Card className="p-6 bg-gradient-to-br from-glow-accent/10 to-glow-cyan/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-glow-accent/20 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-glow-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-mono text-lg text-white font-medium">
                    {address ? truncateAddress(address) : ''}
                  </p>
                  <button onClick={handleCopyAddress} className="text-gray-500 hover:text-gray-300 transition-colors">
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-xs">Connected</Badge>
                  <Badge variant="info" className="text-xs">Arc Testnet</Badge>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" /> ArcScan
                </Button>
              </a>
              <Button variant="secondary" size="sm" onClick={handleRefreshBalances} isLoading={isLoading}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Token Balances */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Circle Assets</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CIRCLE_TOKENS.map((token) => (
              <Card key={token.symbol} className={`p-5 bg-gradient-to-br ${token.color} ${token.border}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{token.icon}</span>
                    <div>
                      <p className="font-semibold text-white">{token.symbol}</p>
                      <p className="text-xs text-gray-500">{token.name}</p>
                    </div>
                  </div>
                  {token.symbol === 'USDC' && (
                    <Badge variant="warning" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" /> Gas
                    </Badge>
                  )}
                </div>

                <p className={`text-2xl font-bold ${token.textColor} mb-1`}>
                  {tokenBalances[token.symbol as keyof typeof tokenBalances]}
                </p>
                <p className="text-xs text-gray-500 mb-4">{token.description}</p>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSendModal({ open: true, token: token.symbol })}
                  >
                    <Send className="w-3 h-3 mr-1" /> Send
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1">
                    <Download className="w-3 h-3 mr-1" /> Receive
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* CCTP Bridge Info */}
        <Card className="p-5 border-glow-cyan/20 bg-glow-cyan/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-glow-cyan/20 flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 text-glow-cyan" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Cross-Chain Transfer Protocol (CCTP)</h3>
              <p className="text-sm text-gray-400 mb-3">
                Transfer USDC natively across chains using Circle&apos;s CCTP. No wrapped tokens, no bridges — native USDC on every chain.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Ethereum', 'Base', 'Polygon', 'Arbitrum', 'Arc Testnet'].map((chain) => (
                  <Badge key={chain} variant="info" className="text-xs">{chain}</Badge>
                ))}
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Coming Soon
            </Button>
          </div>
        </Card>

        {/* Security Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white">Security</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Private keys never leave your wallet
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                All transactions require wallet signature
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Read-only access by default
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-5 h-5 text-glow-accent" />
              <h3 className="font-semibold text-white">Network Info</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex justify-between">
                <span>Network</span>
                <span className="text-white">Arc Testnet</span>
              </li>
              <li className="flex justify-between">
                <span>Chain ID</span>
                <span className="text-white font-mono">5042002</span>
              </li>
              <li className="flex justify-between">
                <span>Gas Token</span>
                <span className="text-white">USDC</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* Send Modal */}
        <Modal
          isOpen={sendModal.open}
          onClose={() => setSendModal({ open: false, token: '' })}
          title={`Send ${sendModal.token}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Testnet tokens have no real value. Always double-check the recipient address.
              </p>
            </div>

            <Input
              label="Recipient Address"
              placeholder="0x..."
              value={sendForm.to}
              onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
            />

            <Input
              label={`Amount (${sendModal.token})`}
              placeholder="0.00"
              type="number"
              value={sendForm.amount}
              onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
              hint={`Available: ${tokenBalances[sendModal.token as keyof typeof tokenBalances]} ${sendModal.token}`}
            />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setSendModal({ open: false, token: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                className="flex-1"
                isLoading={isSending}
                onClick={handleSend}
                disabled={!sendForm.to || !sendForm.amount}
              >
                <Send className="w-4 h-4 mr-2" /> Send
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
