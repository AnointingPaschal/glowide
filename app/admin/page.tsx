'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Settings,
  Key,
  Brain,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sliders,
  FileText,
  Shield,
  Cpu,
  Activity,
  Users,
  BarChart2,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tier: 'premium' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', tier: 'fast' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'premium' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'fast' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta', tier: 'fast' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', provider: 'Google', tier: 'fast' },
  { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', provider: 'Mistral', tier: 'fast' },
  { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', tier: 'coding' },
];

const DEFAULT_SYSTEM_PROMPT = `You are GlowIDE AI, an expert coding assistant specialized in Web3 development, smart contracts, and blockchain technology. You help developers write production-grade code, debug issues, deploy contracts to Arc Testnet, and build Web3 applications.

Your expertise includes:
- Solidity smart contract development (ERC20, ERC721, DeFi protocols)
- JavaScript/TypeScript, React, Next.js development
- Arc Testnet integration and USDC gas token usage
- Circle assets (USDC, EURC, cirBTC) and CCTP
- Security best practices and gas optimization

Always write clean, well-commented, production-ready code. When writing Solidity, prioritize security and gas efficiency.`;

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'models' | 'prompts' | 'usage'>('ai');

  const [settings, setSettings] = useState({
    openrouterKey: '',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    rateLimitPerUser: 100,
    rateLimitWindow: 24,
  });

  const handleAuth = async () => {
    setIsAuthLoading(true);
    await new Promise((r) => setTimeout(r, 800));

    // In production, validate against Supabase admin_keys table
    if (adminKey === 'admin123' || adminKey.length > 8) {
      setIsAuthenticated(true);
      toast.success('Admin access granted');
    } else {
      toast.error('Invalid admin key');
    }
    setIsAuthLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          openrouter_api_key: settings.openrouterKey,
          default_model: settings.defaultModel,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          system_prompt: settings.systemPrompt,
        }),
      });

      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AppLayout title="Admin" description="System administration">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="w-full max-w-md p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-glow-accent/10 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-7 h-7 text-glow-accent" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Admin Authentication</h2>
            <p className="text-sm text-gray-400 mb-6">
              Enter your admin key to access the administration panel.
            </p>
            <div className="space-y-4 text-left">
              <Input
                label="Admin Key"
                type={showKey ? 'text' : 'password'}
                placeholder="Enter admin key..."
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                rightIcon={
                  <button onClick={() => setShowKey(!showKey)} className="text-gray-500 hover:text-gray-300">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <Button
                variant="gradient"
                className="w-full"
                onClick={handleAuth}
                isLoading={isAuthLoading}
              >
                <Key className="w-4 h-4 mr-2" /> Access Admin Panel
              </Button>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Admin Panel" description="Manage AI settings, models, and system configuration">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Auth badge */}
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 font-medium">Admin authenticated</span>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-glow-surface border border-glow-border rounded-xl p-1">
          {([
            { id: 'ai', label: 'AI Settings', icon: Brain },
            { id: 'models', label: 'Models', icon: Cpu },
            { id: 'prompts', label: 'System Prompts', icon: FileText },
            { id: 'usage', label: 'Usage', icon: BarChart2 },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-glow-accent text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-glow-card'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* AI Settings Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <Key className="w-5 h-5 text-glow-accent" />
                <h3 className="font-semibold text-white">OpenRouter API</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder="sk-or-v1-..."
                      value={settings.openrouterKey}
                      onChange={(e) => setSettings({ ...settings, openrouterKey: e.target.value })}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Get your API key at{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-glow-accent hover:underline">
                      openrouter.ai/keys
                    </a>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Temperature</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                        className="flex-1 accent-glow-accent"
                      />
                      <span className="text-sm text-white font-mono w-8 text-right">{settings.temperature}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Tokens</label>
                    <select
                      value={settings.maxTokens}
                      onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50"
                    >
                      {[1024, 2048, 4096, 8192, 16384].map((v) => (
                        <option key={v} value={v}>{v.toLocaleString()} tokens</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Rate Limit (requests/user)</label>
                    <input
                      type="number"
                      value={settings.rateLimitPerUser}
                      onChange={(e) => setSettings({ ...settings, rateLimitPerUser: parseInt(e.target.value) })}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Rate Limit Window (hours)</label>
                    <input
                      type="number"
                      value={settings.rateLimitWindow}
                      onChange={(e) => setSettings({ ...settings, rateLimitWindow: parseInt(e.target.value) })}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="space-y-3">
            {AVAILABLE_MODELS.map((model) => (
              <Card
                key={model.id}
                className={`p-4 cursor-pointer transition-all ${
                  settings.defaultModel === model.id
                    ? 'border-glow-accent/30 bg-glow-accent/5'
                    : 'hover:border-glow-border/80'
                }`}
                onClick={() => setSettings({ ...settings, defaultModel: model.id })}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      settings.defaultModel === model.id ? 'bg-glow-accent/20' : 'bg-glow-card'
                    }`}>
                      <Cpu className={`w-5 h-5 ${settings.defaultModel === model.id ? 'text-glow-accent' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-white">{model.name}</p>
                      <p className="text-xs text-gray-500">{model.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={model.tier === 'premium' ? 'purple' : model.tier === 'coding' ? 'success' : 'info'}
                      className="text-xs"
                    >
                      {model.tier}
                    </Badge>
                    <span className="text-xs text-gray-500">{model.provider}</span>
                    {settings.defaultModel === model.id && (
                      <CheckCircle className="w-4 h-4 text-glow-accent" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* System Prompts Tab */}
        {activeTab === 'prompts' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <FileText className="w-5 h-5 text-glow-accent" />
              <h3 className="font-semibold text-white">System Prompt</h3>
            </div>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
              rows={16}
              className="w-full bg-glow-bg border border-glow-border rounded-xl p-4 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50 font-mono resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">{settings.systemPrompt.length} characters</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings({ ...settings, systemPrompt: DEFAULT_SYSTEM_PROMPT })}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Reset to Default
              </Button>
            </div>
          </Card>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Requests', value: '1,247', icon: Activity, color: 'text-glow-accent' },
                { label: 'Active Users', value: '23', icon: Users, color: 'text-emerald-400' },
                { label: 'Tokens Used', value: '892K', icon: Cpu, color: 'text-glow-cyan' },
                { label: 'Avg Response', value: '1.2s', icon: Sliders, color: 'text-amber-400' },
              ].map((stat) => (
                <Card key={stat.label} className="p-4">
                  <div className="flex items-center gap-3">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <div>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                      <p className="text-lg font-semibold text-white">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <Card className="p-6 text-center">
              <BarChart2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Detailed analytics available in the Supabase dashboard</p>
            </Card>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="gradient" onClick={handleSave} isLoading={isSaving}>
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
