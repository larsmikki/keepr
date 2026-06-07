import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Modal } from '@/components/ui';
import { api } from '@/api';

interface SetupWizardProps {
  onClose: () => void;
}

type Step = 'provider' | 'credentials' | 'test' | 'done';

const PROVIDERS = [
  { value: 'none' as const, label: 'Skip for now', sub: 'You can configure AI later in Settings.' },
  { value: 'openai' as const, label: 'OpenAI / compatible', sub: 'Enter an API key and base URL.' },
  { value: 'ollama' as const, label: 'Ollama (local)', sub: 'Run models locally on your machine.' },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<'none' | 'openai' | 'ollama'>('none');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('');
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const detectModels = async () => {
    setDetecting(true);
    try {
      const result = await api.getLocalAiModels(ollamaUrl);
      setLocalModels(result.models || []);
    } catch {}
    finally { setDetecting(false); }
  };

  const handleSaveCredentials = async () => {
    setSaving(true);
    try {
      if (provider === 'none') { onClose(); return; }
      if (provider === 'openai') {
        await api.updateSettings({ ai_provider: 'openai', ai_openai_model: model, ai_api_key: apiKey, ai_base_url: baseUrl });
      } else {
        await api.updateSettings({ ai_provider: 'ollama', ai_ollama_url: ollamaUrl, ai_ollama_model: ollamaModel });
      }
      setStep('test');
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testAiConnection();
      setTestResult({ ok: true, message: result.message });
      setStep('done');
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message });
    } finally { setTesting(false); }
  };

  const stepTitles: Record<Step, string> = {
    provider: 'Choose AI provider',
    credentials: 'Configure credentials',
    test: 'Test connection',
    done: 'Ready to go',
  };

  return (
    <Modal open onClose={onClose} title={`Setup — ${stepTitles[step]}`} maxWidth="480px">
      {step === 'provider' && (
        <div className="space-y-3">
          <p className="text-sm text-text2">Vaulty uses AI to suggest document titles and tags. Choose a provider, or skip for now.</p>
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              type="button"
              className="w-full text-left p-3 rounded-xl transition-opacity hover:opacity-90"
              style={{
                background: provider === p.value ? `${theme.accent}15` : theme.surface2,
                border: `1px solid ${provider === p.value ? theme.accent : theme.border}`,
              }}
              onClick={() => setProvider(p.value)}
            >
              <div className="text-sm font-semibold text-text">{p.label}</div>
              <div className="text-xs text-text2 mt-0.5">{p.sub}</div>
            </button>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            {provider === 'none'
              ? <Button variant="primary" onClick={onClose}>Skip setup</Button>
              : <Button variant="primary" onClick={() => setStep('credentials')}>Next →</Button>
            }
          </div>
        </div>
      )}

      {step === 'credentials' && provider === 'openai' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">API key</label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-…" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Base URL</label>
            <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Model</label>
            <Input value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => setStep('provider')}>← Back</Button>
            <Button variant="primary" onClick={handleSaveCredentials} disabled={saving || !apiKey}>{saving ? 'Saving…' : 'Save & continue →'}</Button>
          </div>
        </div>
      )}

      {step === 'credentials' && provider === 'ollama' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Ollama URL</label>
            <div className="flex gap-2">
              <Input className="flex-1" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
              <Button onClick={detectModels} disabled={detecting}>{detecting ? '…' : 'Detect'}</Button>
            </div>
          </div>
          {localModels.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Model</label>
              <select
                className="w-full px-3 py-2 rounded-lg border text-sm text-text bg-surface"
                style={{ borderColor: theme.border, background: theme.surface }}
                value={ollamaModel}
                onChange={e => setOllamaModel(e.target.value)}
              >
                <option value="">Pick a model…</option>
                {localModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          {localModels.length === 0 && !detecting && (
            <p className="text-xs text-text2">Click Detect to fetch available models from Ollama.</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => setStep('provider')}>← Back</Button>
            <Button variant="primary" onClick={handleSaveCredentials} disabled={saving || !ollamaModel}>{saving ? 'Saving…' : 'Save & continue →'}</Button>
          </div>
        </div>
      )}

      {step === 'test' && (
        <div className="space-y-4">
          <p className="text-sm text-text2">Credentials saved. Test the connection to confirm everything works.</p>
          {testResult && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ background: testResult.ok ? '#f0fdf4' : '#fef2f2', color: testResult.ok ? '#15803d' : '#dc2626', border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}` }}
            >
              {testResult.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleTest} disabled={testing}>{testing ? 'Testing…' : 'Test connection'}</Button>
            <Button onClick={onClose}>Skip test &amp; close</Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 text-center py-2">
          <div className="text-4xl">✅</div>
          <p className="text-sm font-semibold text-text">AI is configured and ready.</p>
          <p className="text-sm text-text2">Head to the Inbox to start tagging documents with AI suggestions.</p>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
};
