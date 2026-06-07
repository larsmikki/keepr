import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Select, Surface, useToast } from '@/components/ui';
import ThemePicker from '@/components/ThemePicker';
import { SetupWizard } from '@/components/SetupWizard';
import { api } from '@/api';
import type { AiSettings, RescanResult, Settings } from '@/types';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

type FolderOrg = 'year-month' | 'flat';

export const SettingsPage: React.FC = () => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [vaultPath, setVaultPath] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RescanResult | { error: string } | null>(null);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [importNew, setImportNew] = useState(true);
  const [settings, setSettings] = useState<AiSettings>({
    ai_provider: 'none',
    ai_openai_model: '',
    ai_ollama_model: '',
    ai_api_key: '',
    ai_base_url: '',
    ai_ollama_url: '',
    ai_temperature: '',
  });
  const [folderOrg, setFolderOrg] = useState<FolderOrg>('year-month');
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [detectingModels, setDetectingModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [settingsLoadError, setSettingsLoadError] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { data: storageStats = null, isLoading: loadingStats } = useQuery({
    queryKey: ['vault-storage-stats'],
    queryFn: api.getStorageStats,
  });

  const apiKeyIsConfigured = settings.ai_api_key === '***';

  const currentAiSettings = (): AiSettings => {
    if (settings.ai_provider === 'ollama') {
      return {
        ai_provider: 'ollama',
        ai_ollama_model: settings.ai_ollama_model || '',
        ai_ollama_url: settings.ai_ollama_url || '',
        ai_temperature: settings.ai_temperature || '',
      };
    }
    if (settings.ai_provider === 'openai') {
      return {
        ai_provider: 'openai',
        ai_openai_model: settings.ai_openai_model || '',
        ai_api_key: settings.ai_api_key,
        ai_base_url: settings.ai_base_url || '',
        ai_temperature: settings.ai_temperature || '',
      };
    }
    return { ai_provider: 'none' };
  };

  const autoSave = async (patch: Partial<AiSettings & { folder_organization: FolderOrg }>) => {
    try {
      const saved = await api.updateSettings(patch as AiSettings);
      setSettings(prev => ({ ...prev, ...saved }));
    } catch (err: any) {
      addToast('Failed to save: ' + err.message, 'error');
    }
  };

  const detectLocalModels = async (ollamaUrl?: string, silent = false) => {
    setDetectingModels(true);
    setOllamaError(null);
    const url = (ollamaUrl ?? settings.ai_ollama_url)?.trim();
    try {
      const result = await api.getLocalAiModels(url);
      if (result.error) {
        setOllamaError(result.error);
        if (!silent) addToast('Ollama detection failed: ' + result.error, 'error');
      } else if (result.models.length === 0) {
        setLocalModels([]);
        setOllamaError('No chat models found. Run `ollama pull <model>`.');
        if (!silent) addToast('No chat models found', 'info');
      } else {
        setLocalModels(result.models);
        if (!silent) addToast(`Found ${result.models.length} local model${result.models.length === 1 ? '' : 's'}`, 'success');
      }
    } catch (err: any) {
      setOllamaError(err.message);
      if (!silent) addToast('Error: ' + err.message, 'error');
    } finally {
      setDetectingModels(false);
    }
  };

  useEffect(() => {
    api.getConfig().then(cfg => setVaultPath(cfg.vaultRoot)).catch(() => {});
    api.getSettings().then((data: Settings) => {
      setSettings(prev => ({ ...prev, ...data }));
      if (data.folder_organization) setFolderOrg(data.folder_organization);
      setSettingsLoaded(true);
      setSettingsLoadError(false);
      // Auto-detect models if Ollama is configured, using the URL from DB (not stale state)
      if (data.ai_provider === 'ollama') {
        void detectLocalModels(data.ai_ollama_url, true);
      }
    }).catch(() => {
      setSettingsLoadError(true);
    });
  }, []);

  // Auto-save non-credential settings (folder org, provider, model, ollama url).
  const updateFolderOrg = (next: FolderOrg) => {
    setFolderOrg(next);
    autoSave({ folder_organization: next });
  };

  const updateProvider = (provider: 'none' | 'openai' | 'ollama') => {
    setSettings(prev => ({ ...prev, ai_provider: provider }));
    autoSave({ ai_provider: provider });
    if (provider === 'ollama') void detectLocalModels(settings.ai_ollama_url, true);
  };

  // Explicit save for credentials (API key + base URL + model).
  const saveCredentials = async () => {
    setCredentialsSaving(true);
    try {
      const saved = await api.updateSettings(currentAiSettings());
      setSettings(prev => ({ ...prev, ...saved }));
      addToast('Credentials saved', 'success');
    } catch (err: any) {
      addToast('Save failed: ' + err.message, 'error');
    } finally {
      setCredentialsSaving(false);
    }
  };

  const testAiConnection = async () => {
    setTestingConnection(true);
    try {
      await api.updateSettings(currentAiSettings());
      const result = await api.testAiConnection();
      addToast(result.message, 'success');
    } catch (err: any) {
      addToast('Connection failed: ' + err.message, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleImport = async () => {
    if (!importPath) return;
    setImporting(true);
    try {
      const data = await api.importFolder(importPath);
      addToast(data.message, 'success');
      setImportPath('');
    } catch (err: any) {
      addToast('Import failed: ' + err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleRescan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const data = await api.rescan(deleteMissing, importNew);
      setScanResult(data);
    } catch (err: any) {
      setScanResult({ error: err.message });
    } finally {
      setScanning(false);
    }
  };

  const folderOptions: { value: FolderOrg; label: string; example: string }[] = [
    { value: 'year-month', label: 'Year / Month', example: '2026/05/' },
    { value: 'flat', label: 'Flat', example: 'All in one folder' },
  ];

  return (
    <div className="max-w-2xl mx-auto w-full">
      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">Settings</h1>
          <p className="text-sm mt-0.5 text-text2">Configure your vault, AI, and appearance.</p>
        </div>
        <Button onClick={() => setShowWizard(true)} size="sm">Setup wizard</Button>
      </div>

      {settingsLoadError && (
        <div
          className="p-4 mb-5 rounded-lg flex items-start justify-between gap-4"
          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
        >
          <div>
            <p className="text-sm font-semibold">Server unavailable — could not load your settings.</p>
            <p className="text-xs mt-0.5" style={{ color: '#b91c1c' }}>What you see below are defaults, not your saved configuration. Do not save while this banner is showing.</p>
          </div>
          <button
            className="text-xs font-semibold underline whitespace-nowrap flex-shrink-0"
            style={{ color: '#dc2626' }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )}

      {/* Themes */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">Themes</h2>
        <p className="text-xs mb-5 text-text2">Choose how Vaulty looks to you.</p>
        <ThemePicker />
      </Surface>

      {/* Layout (folder organization) */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">Folder organization</h2>
        <p className="text-xs mb-5 text-text2">How new documents are organized on disk. Existing files are not moved.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {folderOptions.map(opt => {
            const isActive = folderOrg === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateFolderOrg(opt.value)}
                className="p-3 text-left rounded-lg transition-opacity hover:opacity-90"
                style={{
                  background: isActive ? `${theme.accent}15` : theme.surface2,
                  border: `1px solid ${isActive ? theme.accent : theme.border}`,
                  color: isActive ? theme.accent : theme.text,
                  boxShadow: isActive ? `0 0 0 3px ${theme.accent}15` : 'none',
                }}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-xs mt-1" style={{ color: isActive ? theme.accent : theme.text2 }}>{opt.example}</div>
              </button>
            );
          })}
        </div>
      </Surface>

      {/* AI metadata */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">AI metadata</h2>
        <p className="text-xs mb-5 text-text2">Configure the AI provider used for inbox classification.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'none',   label: 'None',         sub: 'AI disabled',   tip: undefined                                          },
              { value: 'openai', label: 'OpenAI / API', sub: 'OpenAI-compatible', tip: undefined                                        },
              { value: 'ollama', label: 'Ollama',       sub: 'Local model',   tip: 'Use a vision model (e.g. qwen3-vl) for images & PDFs' },
            ] as const).map(opt => {
              const isActive = settingsLoaded && settings.ai_provider === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateProvider(opt.value)}
                  className="p-3 text-left rounded-lg transition-opacity hover:opacity-90"
                  style={{
                    background: isActive ? `${theme.accent}15` : theme.surface2,
                    border: `1px solid ${isActive ? theme.accent : theme.border}`,
                    color: isActive ? theme.accent : theme.text,
                    boxShadow: isActive ? `0 0 0 3px ${theme.accent}15` : 'none',
                  }}
                >
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="text-xs mt-1" style={{ color: isActive ? theme.accent : theme.text2 }}>{opt.sub}</div>
                  {opt.tip && (
                    <div className="text-xs mt-1.5" style={{ color: isActive ? `${theme.accent}99` : theme.text2, opacity: 0.7 }}>{opt.tip}</div>
                  )}
                </button>
              );
            })}
          </div>

          {settings.ai_provider === 'openai' && (
            <>
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">API key</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    className="flex-1"
                    value={apiKeyIsConfigured ? '' : settings.ai_api_key || ''}
                    disabled={apiKeyIsConfigured}
                    onChange={e => setSettings(prev => ({ ...prev, ai_api_key: e.target.value }))}
                    placeholder={apiKeyIsConfigured ? 'Configured and locked' : 'sk-…'}
                  />
                  {apiKeyIsConfigured && (
                    <Button type="button" size="sm" onClick={() => setSettings(prev => ({ ...prev, ai_api_key: '' }))}>
                      Replace
                    </Button>
                  )}
                </div>
                {apiKeyIsConfigured && (
                  <p className="text-xs mt-1 text-text2">The saved key is preserved when changing other AI settings.</p>
                )}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Base URL</label>
                <Input
                  type="url"
                  value={settings.ai_base_url || ''}
                  onChange={e => setSettings(prev => ({ ...prev, ai_base_url: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            </>
          )}

          {settings.ai_provider === 'ollama' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Ollama URL</label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    className="flex-1"
                    value={settings.ai_ollama_url || ''}
                    onChange={e => setSettings(prev => ({ ...prev, ai_ollama_url: e.target.value }))}
                    placeholder="http://localhost:11434"
                  />
                  <Button type="button" onClick={() => detectLocalModels(settings.ai_ollama_url)} disabled={detectingModels}>
                    {detectingModels ? 'Detecting…' : (localModels.length > 0 ? 'Re-detect' : 'Detect')}
                  </Button>
                </div>
              </div>
              {localModels.length > 0 ? (
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Model</label>
                  <Select
                    value={localModels.includes(settings.ai_ollama_model || '') ? settings.ai_ollama_model || '' : ''}
                    onChange={e => {
                      const v = e.target.value;
                      setSettings(prev => ({ ...prev, ai_ollama_model: v }));
                      autoSave({ ai_provider: 'ollama', ai_ollama_url: settings.ai_ollama_url, ai_ollama_model: v });
                    }}
                  >
                    {!localModels.includes(settings.ai_ollama_model || '') && (
                      <option value="" disabled>Pick a model…</option>
                    )}
                    {localModels.map(model => <option key={model} value={model}>{model}</option>)}
                  </Select>
                  {settings.ai_ollama_model && !localModels.includes(settings.ai_ollama_model) && (
                    <p className="text-xs mt-1 text-text2">
                      Saved model <strong>{settings.ai_ollama_model}</strong> not found — pick one above.
                    </p>
                  )}
                </div>
              ) : ollamaError ? (
                <p className="text-xs text-text2">
                  {ollamaError}{' '}
                  <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="underline">Install Ollama</a>
                </p>
              ) : detectingModels ? (
                <p className="text-xs text-text2">Asking Ollama for available models…</p>
              ) : null}
            </div>
          )}

          {settings.ai_provider === 'openai' && (
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Model</label>
              <Input
                value={settings.ai_openai_model || ''}
                onChange={e => setSettings(prev => ({ ...prev, ai_openai_model: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
            </div>
          )}

          {settings.ai_provider !== 'none' && (
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">
                Temperature <span className="normal-case font-normal">(optional)</span>
              </label>
              <Input
                type="text"
                value={settings.ai_temperature || ''}
                onChange={e => setSettings(prev => ({ ...prev, ai_temperature: e.target.value }))}
                placeholder="0 to 2 — blank uses model default"
              />
              <p className="text-xs mt-1 text-text2">Leave blank for reasoning models (o1, o3, o4) that do not accept a temperature parameter.</p>
            </div>
          )}

          {settings.ai_provider !== 'none' && (
            <div className="flex gap-2">
              <Button variant="primary" onClick={saveCredentials} disabled={credentialsSaving || settingsLoadError}>
                {credentialsSaving ? 'Saving…' : 'Save credentials'}
              </Button>
              <Button onClick={testAiConnection} disabled={testingConnection || settingsLoadError}>
                {testingConnection ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
          )}
        </div>
      </Surface>

      {/* Data */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">Data</h2>
        <p className="text-xs mb-5 text-text2">Export the metadata index or import an existing folder.</p>
        <div className="space-y-4">
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
          >
            <div>
              <div className="text-sm font-medium text-text">CSV index</div>
              <div className="text-xs text-text2">Spreadsheet of all document metadata.</div>
            </div>
            <Button variant="primary" onClick={() => api.exportCsvIndex()}>Export CSV</Button>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Import folder</label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={importPath}
                onChange={e => setImportPath(e.target.value)}
                placeholder="C:\\Documents\\Important"
              />
              <Button variant="primary" onClick={handleImport} disabled={importing || !importPath}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </div>
            <p className="text-xs mt-1 text-text2">Files are copied; duplicates are skipped.</p>
          </div>
        </div>
      </Surface>

      {/* Vault */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">Vault</h2>
        <p className="text-xs mb-5 text-text2">Check vault integrity and view storage usage.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Vault root</label>
            <Input value={vaultPath} readOnly placeholder="Loading…" />
            <p className="text-xs mt-1 text-text2">Set the VAULT_ROOT environment variable and restart the server to change this.</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={importNew}
                onChange={e => setImportNew(e.target.checked)}
                className="w-4 h-4"
              />
              Add new files to index
            </label>
            <label className="flex items-center gap-2 text-sm text-text mb-3">
              <input
                type="checkbox"
                checked={deleteMissing}
                onChange={e => setDeleteMissing(e.target.checked)}
                className="w-4 h-4"
              />
              Remove missing files from the database
            </label>
            <Button variant="primary" onClick={handleRescan} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Run rescan'}
            </Button>
          </div>

          {scanResult && (
            <div
              className="p-3 rounded-lg text-xs space-y-1"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
            >
              {'error' in scanResult ? `Error: ${scanResult.error}` : (
                <>
                  {scanResult.newFiles.length > 0 && <div><strong style={{ color: '#16a34a' }}>+ {scanResult.newFiles.length} new file(s) found on disk</strong>{scanResult.importedNewFiles > 0 ? ` — ${scanResult.importedNewFiles} added to index` : ' — not indexed (enable "Add new files to index")'}</div>}
                  {scanResult.missingFiles.length > 0 && <div><strong style={{ color: '#dc2626' }}>! {scanResult.missingFiles.length} missing file(s)</strong> — indexed but not on disk</div>}
                  {'deletedFromDb' in scanResult && scanResult.deletedFromDb.length > 0 && <div><strong style={{ color: '#dc2626' }}>- {scanResult.deletedFromDb.length} removed from database</strong></div>}
                  {scanResult.checksumMismatches.length > 0 && <div><strong style={{ color: '#f59e0b' }}>! {scanResult.checksumMismatches.length} checksum mismatch(es)</strong> — file contents changed</div>}
                  {scanResult.sidecarConflicts.length > 0 && <div><strong style={{ color: theme.accent }}>* {scanResult.sidecarConflicts.length} sidecar conflict(s)</strong> — metadata needs sync</div>}
                  {scanResult.newFiles.length === 0 && scanResult.missingFiles.length === 0 && scanResult.checksumMismatches.length === 0 && scanResult.sidecarConflicts.length === 0 && (
                    <div style={{ color: '#16a34a' }} className="font-medium">Vault is in sync.</div>
                  )}
                </>
              )}
            </div>
          )}

          {loadingStats ? (
            <div className="py-4 text-sm text-text2">Loading storage stats…</div>
          ) : storageStats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="p-3 rounded-lg"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  <div className="text-2xl font-bold text-text">{storageStats.totalDocuments}</div>
                  <div className="text-xs text-text2">Documents</div>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  <div className="text-2xl font-bold text-text">{formatSize(storageStats.totalSize)}</div>
                  <div className="text-xs text-text2">Total size</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Surface>
    </div>
  );
};
