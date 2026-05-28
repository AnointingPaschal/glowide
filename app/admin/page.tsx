'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Key, Brain, Save, Eye, EyeOff, CheckCircle, AlertCircle, Sliders, FileText, Plus, Trash2, Edit2, X, Loader2, ToggleLeft, ToggleRight, DollarSign, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PublicModel } from '@/app/api/models/route';

const DEFAULT_MODELS: PublicModel[] = [
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', tier: 'premium', context_length: 200000, description: 'Latest Claude', enabled: true },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tier: 'premium', context_length: 200000, description: 'Powerful & fast', enabled: true },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', tier: 'fast', context_length: 200000, description: 'Fastest Claude', enabled: true },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'premium', context_length: 128000, description: 'OpenAI flagship', enabled: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'fast', context_length: 128000, description: 'Fast & affordable', enabled: true },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', provider: 'Google', tier: 'fast', context_length: 1000000, description: '1M context', enabled: true },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta', tier: 'fast', context_length: 128000, description: 'Open source', enabled: true },
  { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', tier: 'coding', context_length: 16000, description: 'Code specialist', enabled: true },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral', tier: 'premium', context_length: 32000, description: 'European AI', enabled: true },
];

const DEFAULT_SYSTEM_PROMPT = `You are GlowIDE AI, an expert coding assistant specialized in Web3 development, smart contracts, and full-stack engineering. You write production-grade, type-safe code with clear explanations.\n\nExpertise:\n- Solidity smart contracts (ERC20, ERC721, DeFi, security)\n- TypeScript, React, Next.js, Node.js, Express\n- Arc Testnet (Chain ID 5042002), Circle assets (USDC, EURC, cirBTC)\n- Web3 integration with viem/wagmi/ethers\n- Security best practices and gas optimization\n- Full-stack app architecture\n\nAlways write clean, well-commented, production-ready code.`;

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'models' | 'prompts' | 'fees'>('ai');

  const [settings, setSettings] = useState({
    openrouterKey: '', defaultModel: 'anthropic/claude-sonnet-4-5',
    temperature: 0.7, maxTokens: 4096,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    rateLimitPerUser: 100,
    deploymentFee: '0',
    feeRecipient: '',
  });
  const [models, setModels] = useState<PublicModel[]>(DEFAULT_MODELS);
  const [fees, setFees] = useState({
    deploymentFeeUsdc: '0.50',
    deploymentFeePercent: '0',
    freeDeploymentsPerUser: '3',
    verificationFeeUsdc: '0.00',
    feesEnabled: false,
  });
  const [editingModel, setEditingModel] = useState<PublicModel | null>(null);
  const [newModel, setNewModel] = useState<{ id: string; name: string; provider: string; tier: PublicModel['tier']; context_length: number; description: string }>({ id: '', name: '', provider: '', tier: 'fast', context_length: 128000, description: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState(false);

  // Load settings from API
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/admin/settings', { headers: { authorization: `Bearer ${adminKey}` } })
      .then(r => r.json())
      .then(d => {
        const s = d.settings as { key: string; value: string }[] ?? [];
        const map = Object.fromEntries(s.map((x: { key: string; value: string }) => [x.key, x.value]));
        if (map.openrouter_api_key) setSettings(prev => ({ ...prev, openrouterKey: map.openrouter_api_key }));
        if (map.default_model) setSettings(prev => ({ ...prev, defaultModel: map.default_model }));
        if (map.temperature) setSettings(prev => ({ ...prev, temperature: parseFloat(map.temperature) }));
        if (map.max_tokens) setSettings(prev => ({ ...prev, maxTokens: parseInt(map.max_tokens) }));
        if (map.system_prompt) setSettings(prev => ({ ...prev, systemPrompt: map.system_prompt }));
        if (map.deployment_fee) setSettings(prev => ({ ...prev, deploymentFee: map.deployment_fee }));
        if (map.fee_recipient) setSettings(prev => ({ ...prev, feeRecipient: map.fee_recipient }));
        if (map.available_models) {
          try { setModels(JSON.parse(map.available_models)); } catch {}
        }
      }).catch(() => {});
  }, [isAuthenticated, adminKey]);

  const handleAuth = async () => {
    setIsAuthLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const res = await fetch('/api/admin/settings', { headers: { authorization: `Bearer ${adminKey}` } });
    setIsAuthLoading(false);
    if (res.ok || res.status === 200) {
      setIsAuthenticated(true);
      toast.success('Admin access granted');
    } else {
      toast.error('Invalid admin key');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        openrouter_api_key: settings.openrouterKey,
        default_model: settings.defaultModel,
        temperature: String(settings.temperature),
        max_tokens: String(settings.maxTokens),
        system_prompt: settings.systemPrompt,
        available_models: JSON.stringify(models),
        deployment_fee: settings.deploymentFee,
        fee_recipient: settings.feeRecipient,
        deployment_fee_usdc: fees.deploymentFeeUsdc,
        deployment_fee_percent: fees.deploymentFeePercent,
        free_deployments_per_user: fees.freeDeploymentsPerUser,
        verification_fee_usdc: fees.verificationFeeUsdc,
        fees_enabled: String(fees.feesEnabled),
        rate_limit_per_user: String(settings.rateLimitPerUser),
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModel = (id: string) => setModels(m => m.map(x => x.id === id ? { ...x, enabled: !x.enabled } : x));
  const deleteModel = (id: string) => { setModels(m => m.filter(x => x.id !== id)); toast.success('Model removed'); };
  const addModel = () => {
    if (!newModel.id || !newModel.name) { toast.error('ID and name required'); return; }
    if (models.find(m => m.id === newModel.id)) { toast.error('Model ID already exists'); return; }
    setModels(m => [...m, { ...newModel, enabled: true }]);
    setNewModel({ id: '', name: '', provider: '', tier: 'fast', context_length: 128000, description: '' });
    setShowNewForm(false);
    toast.success('Model added');
  };
  const saveEdit = () => {
    if (!editingModel) return;
    setModels(m => m.map(x => x.id === editingModel.id ? editingModel : x));
    setEditingModel(null);
    toast.success('Model updated');
  };

  if (!isAuthenticated) {
    return (
      <AppLayout title="Admin">
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <Card className="p-6 md:p-8 w-full max-w-sm space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-glow-accent/10 flex items-center justify-center mx-auto mb-3">
                <Key className="w-6 h-6 text-glow-accent" />
              </div>
              <h2 className="text-lg font-bold text-white">Admin Access</h2>
              <p className="text-xs text-gray-400 mt-1">Enter your admin key to continue</p>
            </div>
            <Input label="Admin Key" type={showKey ? 'text' : 'password'} value={adminKey}
              onChange={e => setAdminKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()}
              rightIcon={<button onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
            />
            <Button onClick={handleAuth} isLoading={isAuthLoading} variant="gradient" className="w-full">
              Authenticate
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const tabs = [
    { id: 'ai', label: 'AI Settings', icon: Brain },
    { id: 'models', label: 'Models', icon: Sliders },
    { id: 'prompts', label: 'System Prompt', icon: FileText },
    { id: 'fees', label: 'Deployment Fees', icon: DollarSign },
  ] as const;

  return (
    <AppLayout title="Admin Panel">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-white">Admin Panel</h1>
          <Badge variant="success" className="text-xs">Authenticated</Badge>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-glow-border overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? 'text-glow-accent-light border-b-2 border-glow-accent' : 'text-gray-500 hover:text-gray-300'}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* AI Settings */}
        {activeTab === 'ai' && (
          <Card className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">OpenRouter API Key</label>
              <div className="flex gap-2">
                <input type={showKeyValue ? 'text' : 'password'} value={settings.openrouterKey}
                  onChange={e => setSettings(p => ({ ...p, openrouterKey: e.target.value }))}
                  placeholder="sk-or-v1-..."
                  className="flex-1 bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50 font-mono"
                />
                <button onClick={() => setShowKeyValue(!showKeyValue)} className="p-2 rounded-lg border border-glow-border text-gray-500 hover:text-white hover:bg-glow-card transition-colors">
                  {showKeyValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Default Model</label>
              <select value={settings.defaultModel} onChange={e => setSettings(p => ({ ...p, defaultModel: e.target.value }))}
                className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50">
                {models.filter(m => m.enabled).map(m => <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Temperature: {settings.temperature}</label>
              <input type="range" min="0" max="1" step="0.1" value={settings.temperature}
                onChange={e => setSettings(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-glow-accent" />
              <div className="flex justify-between text-xs text-gray-600 mt-1"><span>Precise (0)</span><span>Creative (1)</span></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Tokens: {settings.maxTokens.toLocaleString()}</label>
              <input type="range" min="512" max="8192" step="256" value={settings.maxTokens}
                onChange={e => setSettings(p => ({ ...p, maxTokens: parseInt(e.target.value) }))}
                className="w-full accent-glow-accent" />
            </div>

            <div>
              <Input label="Rate Limit (requests / user / 24h)" type="number" value={settings.rateLimitPerUser}
                onChange={e => setSettings(p => ({ ...p, rateLimitPerUser: parseInt(e.target.value) || 100 }))} />
            </div>
            <div className="pt-2 border-t border-glow-border">
              <p className="text-xs font-semibold text-glow-muted uppercase tracking-wider mb-3">Contract Deployment Fee</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Fee Amount (USDC)"
                  type="number"
                  placeholder="0"
                  value={settings.deploymentFee}
                  hint="Set to 0 for free deployments"
                  onChange={e => setSettings(p => ({ ...p, deploymentFee: e.target.value }))}
                />
                <Input
                  label="Fee Recipient Address"
                  placeholder="0x..."
                  value={settings.feeRecipient}
                  hint="Your wallet address to receive fees"
                  onChange={e => setSettings(p => ({ ...p, feeRecipient: e.target.value }))}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Models Management */}
        {activeTab === 'models' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{models.filter(m => m.enabled).length} of {models.length} models enabled</p>
              <Button size="sm" onClick={() => setShowNewForm(!showNewForm)} variant="secondary" className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />Add Model
              </Button>
            </div>

            {showNewForm && (
              <Card className="p-4 border-glow-accent/30 space-y-3">
                <p className="text-sm font-semibold text-white">Add Model</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Model ID (OpenRouter)" placeholder="provider/model-name" value={newModel.id} onChange={e => setNewModel(p => ({ ...p, id: e.target.value }))} />
                  <Input label="Display Name" placeholder="GPT-4o" value={newModel.name} onChange={e => setNewModel(p => ({ ...p, name: e.target.value }))} />
                  <Input label="Provider" placeholder="OpenAI" value={newModel.provider} onChange={e => setNewModel(p => ({ ...p, provider: e.target.value }))} />
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tier</label>
                    <select value={newModel.tier} onChange={e => setNewModel(p => ({ ...p, tier: e.target.value as PublicModel['tier'] }))}
                      className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50">
                      <option value="premium">Premium</option><option value="fast">Fast</option><option value="coding">Coding</option>
                    </select>
                  </div>
                  <Input label="Context Length" type="number" value={newModel.context_length} onChange={e => setNewModel(p => ({ ...p, context_length: parseInt(e.target.value) || 128000 }))} />
                  <Input label="Description" value={newModel.description} onChange={e => setNewModel(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={addModel}>Add Model</Button>
                </div>
              </Card>
            )}

            <div className="space-y-2">
              {models.map(m => (
                <Card key={m.id} className="p-3">
                  {editingModel?.id === m.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Name" value={editingModel.name} onChange={e => setEditingModel(p => p ? ({ ...p, name: e.target.value }) : p)} />
                        <Input label="Provider" value={editingModel.provider} onChange={e => setEditingModel(p => p ? ({ ...p, provider: e.target.value }) : p)} />
                        <Input label="Description" value={editingModel.description ?? ''} onChange={e => setEditingModel(p => p ? ({ ...p, description: e.target.value }) : p)} />
                        <Input label="Context Length" type="number" value={editingModel.context_length ?? 0} onChange={e => setEditingModel(p => p ? ({ ...p, context_length: parseInt(e.target.value) }) : p)} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingModel(null)}><X className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" onClick={saveEdit}><CheckCircle className="w-3.5 h-3.5 mr-1" />Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{m.name}</span>
                          <Badge variant="default" className="text-[10px]">{m.tier}</Badge>
                          <span className="text-[10px] text-gray-500">{m.provider}</span>
                          {m.context_length && <span className="text-[10px] text-gray-600">{(m.context_length/1000).toFixed(0)}k ctx</span>}
                        </div>
                        <p className="text-xs text-gray-600 font-mono truncate mt-0.5">{m.id}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleModel(m.id)} className={`transition-colors ${m.enabled ? 'text-glow-accent' : 'text-gray-600'}`} title={m.enabled ? 'Disable' : 'Enable'}>
                          {m.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button onClick={() => setEditingModel(m)} className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-glow-card transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteModel(m.id)} className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* System Prompt */}
        {activeTab === 'prompts' && (
          <Card className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">System Prompt</label>
              <textarea rows={16} value={settings.systemPrompt}
                onChange={e => setSettings(p => ({ ...p, systemPrompt: e.target.value }))}
                className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50 resize-none font-mono"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSettings(p => ({ ...p, systemPrompt: DEFAULT_SYSTEM_PROMPT }))}>
              Reset to default
            </Button>
          </Card>
        )}


        {/* Deployment Fees */}
        {activeTab === 'fees' && (
          <Card className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--glow-text)]">Deployment Fees</h3>
                <p className="text-xs text-[var(--glow-muted)] mt-0.5">Charge users USDC fees for contract deployments</p>
              </div>
              <button onClick={() => setFees(p => ({ ...p, feesEnabled: !p.feesEnabled }))} className={`relative w-12 h-6 rounded-full transition-colors ${fees.feesEnabled ? 'bg-[var(--glow-accent)]' : 'bg-[var(--glow-card)] border border-[var(--glow-border)]'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${fees.feesEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {fees.feesEnabled && (
              <div className="p-3 bg-[var(--glow-accent)]/10 border border-[var(--glow-accent)]/20 rounded-xl">
                <p className="text-xs text-[var(--glow-accent-light)]">Fees are enabled. Users will be charged when deploying contracts.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--glow-muted)] mb-1.5">
                  <DollarSign className="w-3.5 h-3.5 inline mr-1" />Deployment Fee (USDC)
                </label>
                <input type="number" min="0" step="0.01" value={fees.deploymentFeeUsdc}
                  onChange={e => setFees(p => ({ ...p, deploymentFeeUsdc: e.target.value }))}
                  className="w-full bg-[var(--glow-bg)] border border-[var(--glow-border)] rounded-lg px-3 py-2 text-sm text-[var(--glow-text)] focus:outline-none focus:border-[var(--glow-accent)]/50" />
                <p className="text-xs text-[var(--glow-muted)] mt-1">Fixed USDC fee per deployment</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--glow-muted)] mb-1.5">
                  <Percent className="w-3.5 h-3.5 inline mr-1" />Fee Percentage (%)
                </label>
                <input type="number" min="0" max="100" step="0.1" value={fees.deploymentFeePercent}
                  onChange={e => setFees(p => ({ ...p, deploymentFeePercent: e.target.value }))}
                  className="w-full bg-[var(--glow-bg)] border border-[var(--glow-border)] rounded-lg px-3 py-2 text-sm text-[var(--glow-text)] focus:outline-none focus:border-[var(--glow-accent)]/50" />
                <p className="text-xs text-[var(--glow-muted)] mt-1">% of gas cost charged as fee</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--glow-muted)] mb-1.5">Free Deployments / User</label>
                <input type="number" min="0" value={fees.freeDeploymentsPerUser}
                  onChange={e => setFees(p => ({ ...p, freeDeploymentsPerUser: e.target.value }))}
                  className="w-full bg-[var(--glow-bg)] border border-[var(--glow-border)] rounded-lg px-3 py-2 text-sm text-[var(--glow-text)] focus:outline-none focus:border-[var(--glow-accent)]/50" />
                <p className="text-xs text-[var(--glow-muted)] mt-1">Free deployments before charging</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--glow-muted)] mb-1.5">Verification Fee (USDC)</label>
                <input type="number" min="0" step="0.01" value={fees.verificationFeeUsdc}
                  onChange={e => setFees(p => ({ ...p, verificationFeeUsdc: e.target.value }))}
                  className="w-full bg-[var(--glow-bg)] border border-[var(--glow-border)] rounded-lg px-3 py-2 text-sm text-[var(--glow-text)] focus:outline-none focus:border-[var(--glow-accent)]/50" />
                <p className="text-xs text-[var(--glow-muted)] mt-1">Fee for contract source verification</p>
              </div>
            </div>

            <div className="p-3 bg-[var(--glow-surface)] border border-[var(--glow-border)] rounded-xl space-y-1.5">
              <p className="text-xs font-semibold text-[var(--glow-text)]">Fee Summary</p>
              <div className="flex justify-between text-xs text-[var(--glow-muted)]"><span>Per deployment</span><span className="text-[var(--glow-text)] font-medium">{fees.deploymentFeeUsdc} USDC {parseFloat(fees.deploymentFeePercent)>0 ? `+ ${fees.deploymentFeePercent}% of gas` : ''}</span></div>
              <div className="flex justify-between text-xs text-[var(--glow-muted)]"><span>Free tier</span><span className="text-[var(--glow-text)] font-medium">{fees.freeDeploymentsPerUser} deployments / user</span></div>
              <div className="flex justify-between text-xs text-[var(--glow-muted)]"><span>Verification</span><span className="text-[var(--glow-text)] font-medium">{parseFloat(fees.verificationFeeUsdc)===0 ? 'Free' : `${fees.verificationFeeUsdc} USDC`}</span></div>
              <div className="flex justify-between text-xs text-[var(--glow-muted)]"><span>Status</span><span className={fees.feesEnabled ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>{fees.feesEnabled ? 'Active' : 'Disabled'}</span></div>
            </div>
          </Card>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <Button variant="gradient" onClick={handleSave} isLoading={isSaving}>
            <Save className="w-4 h-4 mr-2" />Save All Settings
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
