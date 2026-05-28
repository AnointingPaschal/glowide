'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useEditorStore } from '@/store/editorStore';
import {
  User,
  Palette,
  Code2,
  Bell,
  Shield,
  Save,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Check,
  ChevronRight,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';

const THEMES: { id: 'vs-dark' | 'vs-light' | 'hc-black'; name: string; preview: string }[] = [
  { id: 'vs-dark', name: 'VS Dark', preview: 'bg-gray-900' },
  { id: 'vs-light', name: 'VS Light', preview: 'bg-gray-100' },
  { id: 'hc-black', name: 'High Contrast', preview: 'bg-black' },
];

const FONT_FAMILIES = [
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Code',
  'Source Code Pro',
  'Monaco',
  'Consolas',
];

export default function SettingsPage() {
  const { theme, setTheme, fontSize, setFontSize } = useEditorStore();

  const [profile, setProfile] = useState({
    displayName: 'GlowIDE User',
    email: 'user@example.com',
    bio: 'Building the next generation of Web3 apps.',
  });

  const [editorPrefs, setEditorPrefs] = useState({
    fontFamily: 'JetBrains Mono',
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    lineNumbers: true,
    formatOnSave: true,
    autoSave: true,
    autoSaveDelay: 2000,
  });

  const [notifications, setNotifications] = useState({
    deploymentSuccess: true,
    deploymentFailed: true,
    walletActivity: true,
    aiUsageLimit: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'editor' | 'notifications' | 'security'>('profile');

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    toast.success('Settings saved');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'editor', label: 'Editor', icon: Code2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ] as const;

  return (
    <AppLayout title="Settings" description="Customize your GlowIDE experience">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-52 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-glow-accent/10 text-glow-accent-light border border-glow-accent/20'
                      : 'text-gray-400 hover:text-white hover:bg-glow-card'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-glow-accent" />
                  <h3 className="font-semibold text-white">Profile Information</h3>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-glow-accent/20 flex items-center justify-center text-2xl font-bold text-glow-accent">
                    {profile.displayName[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{profile.displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{profile.email}</p>
                  </div>
                </div>

                <Input
                  label="Display Name"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Bio</label>
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-glow-accent/50 resize-none"
                  />
                </div>
              </Card>
            )}

            {/* Editor Tab */}
            {activeTab === 'editor' && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <Code2 className="w-5 h-5 text-glow-accent" />
                  <h3 className="font-semibold text-white">Editor Preferences</h3>
                </div>

                {/* Theme */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-3">Editor Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          theme === t.id
                            ? 'border-glow-accent/40 bg-glow-accent/10'
                            : 'border-glow-border hover:border-glow-border/80'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded ${t.preview} border border-white/10`} />
                        <span className="text-sm text-gray-300">{t.name}</span>
                        {theme === t.id && <Check className="w-4 h-4 text-glow-accent ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Font Size: <span className="text-white">{fontSize}px</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-glow-accent"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>10px</span>
                    <span>24px</span>
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Font Family</label>
                  <select
                    value={editorPrefs.fontFamily}
                    onChange={(e) => setEditorPrefs({ ...editorPrefs, fontFamily: e.target.value })}
                    className="w-full bg-glow-bg border border-glow-border rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-glow-accent/50"
                  >
                    {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                {/* Tab Size */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Tab Size</label>
                  <div className="flex gap-2">
                    {[2, 4, 8].map((size) => (
                      <button
                        key={size}
                        onClick={() => setEditorPrefs({ ...editorPrefs, tabSize: size })}
                        className={`px-4 py-2 rounded-lg text-sm transition-all ${
                          editorPrefs.tabSize === size
                            ? 'bg-glow-accent text-white'
                            : 'bg-glow-card text-gray-400 hover:text-white border border-glow-border'
                        }`}
                      >
                        {size} spaces
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  {([
                    { key: 'wordWrap', label: 'Word Wrap' },
                    { key: 'minimap', label: 'Show Minimap' },
                    { key: 'lineNumbers', label: 'Line Numbers' },
                    { key: 'formatOnSave', label: 'Format on Save' },
                    { key: 'autoSave', label: 'Auto Save' },
                  ] as const).map((toggle) => (
                    <div key={toggle.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{toggle.label}</span>
                      <button
                        onClick={() => setEditorPrefs((prev) => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          editorPrefs[toggle.key] ? 'bg-glow-accent' : 'bg-glow-card border border-glow-border'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          editorPrefs[toggle.key] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Bell className="w-5 h-5 text-glow-accent" />
                  <h3 className="font-semibold text-white">Notification Preferences</h3>
                </div>

                {([
                  { key: 'deploymentSuccess', label: 'Deployment Success', desc: 'When a contract is successfully deployed' },
                  { key: 'deploymentFailed', label: 'Deployment Failed', desc: 'When a deployment fails' },
                  { key: 'walletActivity', label: 'Wallet Activity', desc: 'Incoming transactions and balance changes' },
                  { key: 'aiUsageLimit', label: 'AI Usage Limit', desc: 'When approaching AI request limits' },
                ] as const).map((notif) => (
                  <div key={notif.key} className="flex items-center justify-between p-4 rounded-lg bg-glow-card border border-glow-border">
                    <div>
                      <p className="text-sm font-medium text-white">{notif.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{notif.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifications((prev) => ({ ...prev, [notif.key]: !prev[notif.key] }))}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        notifications[notif.key] ? 'bg-glow-accent' : 'bg-glow-bg border border-glow-border'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notifications[notif.key] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-glow-accent" />
                  <h3 className="font-semibold text-white">Security Settings</h3>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Wallet Signature Login', desc: 'Use wallet signature for authentication', enabled: true },
                    { label: 'Session Timeout', desc: 'Auto-logout after 24 hours of inactivity', enabled: true },
                    { label: 'Audit Logging', desc: 'Log all admin and deployment actions', enabled: true },
                    { label: 'Rate Limiting', desc: 'Protect against API abuse', enabled: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 p-4 rounded-lg bg-glow-card border border-glow-border">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        item.enabled ? 'bg-emerald-500/10' : 'bg-gray-500/10'
                      }`}>
                        <Shield className={`w-4 h-4 ${item.enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                      <Badge variant={item.enabled ? 'success' : 'default'} className="text-xs">
                        {item.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button variant="gradient" onClick={handleSave} isLoading={isSaving}>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
