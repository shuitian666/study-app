import { useState, useCallback } from 'react';
import { X, Check, Eye, EyeOff, Key } from 'lucide-react';
import type { AIProvider, AIConfig } from '@/types';
import { getAIConfig, setAIConfig, resetBackendCache } from '@/services/aiClient';

interface AISettingsModalProps {
  show: boolean;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<AIProvider, { name: string; desc: string; placeholder: string }> = {
  ollama: { name: 'Ollama', desc: '本地部署，快速免费', placeholder: '' },
  volcengine: { name: '火山引擎', desc: '豆包大模型', placeholder: '输入 API Key' },
  minimax: { name: 'MiniMax', desc: 'MiniMax 大模型', placeholder: '输入 API Key' },
  douban: { name: '豆包 API', desc: '火山引擎豆包大模型', placeholder: '输入 API Key' },
  openclaw: { name: 'OpenClaw', desc: '本地 OpenClaw 服务', placeholder: '' },
};

function AISettingsModalInner({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AIConfig>(getAIConfig);
  const [showApiKey, setShowApiKey] = useState(false);

  const mode: 'local' | 'cloud' = config.provider === 'ollama' ? 'local' : 'cloud';

  const handleModeChange = useCallback((newMode: 'local' | 'cloud') => {
    if (newMode === 'local') {
      setConfig(prev => ({ ...prev, provider: 'ollama' }));
    }
  }, []);

  const handleSelectProvider = useCallback((provider: AIProvider) => {
    setConfig(prev => ({ ...prev, provider, presetId: undefined }));
  }, []);

  const handleApiKeyChange = useCallback((value: string) => {
    setConfig(prev => ({ ...prev, apiKey: value || undefined }));
  }, []);

  const handleModelIdChange = useCallback((value: string) => {
    setConfig(prev => ({ ...prev, modelId: value || undefined }));
  }, []);

  const handleSave = useCallback(() => {
    setAIConfig(config);
    resetBackendCache();
    onClose();
  }, [config, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold">AI 设置</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => handleModeChange('local')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'local' ? 'bg-white shadow text-primary' : 'text-text-muted'
              }`}
            >
              本地模式
            </button>
            <button
              onClick={() => handleModeChange('cloud')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'cloud' ? 'bg-white shadow text-primary' : 'text-text-muted'
              }`}
            >
              云端模式
            </button>
          </div>
        </div>

        {/* Provider Selection (Cloud mode) */}
        {mode === 'cloud' && (
          <div className="p-4 space-y-3">
            <div className="text-xs text-text-muted">选择云端/本地服务</div>
            {(['volcengine', 'minimax', 'douban', 'openclaw'] as AIProvider[]).map(provider => (
              <button
                key={provider}
                onClick={() => handleSelectProvider(provider)}
                className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                  config.provider === provider
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-white hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{PROVIDER_LABELS[provider].name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{PROVIDER_LABELS[provider].desc}</div>
                  </div>
                  {config.provider === provider && (
                    <Check size={16} className="text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* API Config (Cloud mode) */}
        {mode === 'cloud' && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Key size={12} className="text-text-muted" />
                <span className="text-xs text-text-muted">{PROVIDER_LABELS[config.provider].placeholder}</span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey || ''}
                  onChange={e => handleApiKeyChange(e.target.value)}
                  placeholder="sk-xxxxx"
                  className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg outline-none focus:border-primary"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs text-text-muted mb-1">模型 ID (可选)</div>
              <input
                type="text"
                value={config.modelId || ''}
                onChange={e => handleModelIdChange(e.target.value)}
                placeholder="如: doubao-pro-32k"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* Local mode info */}
        {mode === 'local' && (
          <div className="p-4">
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              本地模式需要先运行后端服务：
              <code className="block mt-1 bg-blue-100 rounded p-1"> node server/index.js</code>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSave}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium active:opacity-80"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

// Wrapper that remounts when show changes to reset state
export default function AISettingsModal({ show, onClose }: AISettingsModalProps) {
  if (!show) return null;
  return <AISettingsModalInner key={String(show)} onClose={onClose} />;
}
