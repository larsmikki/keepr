import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Select, Surface, useToast } from '@/components/ui';
import ThemePicker from '@/components/ThemePicker';
import { api } from '@/api';
import type { AiSettings, RescanResult, Settings } from '@/types';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

type FolderOrg = 'year-month' | 'category-year' | 'year-category' | 'type-year' | 'flat';

export const SettingsPage: React.FC = () => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [vaultPath, setVaultPath] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<RescanResult | { error: string } | null>(null);
  const [deleteMissing, setDeleteMissing] = useState(false);
  const [settings, setSettings] = useState<AiSettings>({
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    ai_api_key: '',
    ai_base_url: 'https://api.openai.com/v1',
    ai_ollama_url: 'http://localhost:11434',
  });
  const [folderOrg, setFolderOrg] = useState<FolderOrg>('year-month');
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [detectingModels, setDetectingModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const { data: storageStats = null, isLoading: loadingStats } = useQuery({
    queryKey: ['vault-storage-stats'],
    queryFn: api.getStorageStats,
  });

  const apiKeyIsConfigured = settings.ai_api_key === '***';

  const currentAiSettings = (): AiSettings => {
    if (settings.ai_provider === 'ollama') {
      return {
        ai_provider: 'ollama',
        ai_model: settings.ai_model || '',
        ai_ollama_url: settings.ai_ollama_url || 'http://localhost:11434',
      };
    }

    return {
      ai_provider: 'openai',
      ai_model: settings.ai_model || 'gpt-4o-mini',
      ai_api_key: settings.ai_api_key,
      ai_base_url: settings.ai_base_url || 'https://api.openai.com/v1',
    };
  };

  const autoSave = async (patch: Partial<AiSettings & { folder_organization: FolderOrg }>) => {
    try {
      const saved = await api.updateSettings(patch as AiSettings);
      setSettings(prev => ({ ...prev, ...saved }));
    } catch (err: any) {
      addToast('Failed to save: ' + err.message, 'error');
    }
  };

  const detectLocalModels = async (opts: { silent?: boolean; ollamaUrl?: string; model?: string } = {}) => {
    setDetectingModels(true);
    setOllamaError(null);
    const ollamaUrl = (opts.ollamaUrl ?? settings.ai_ollama_url)?.trim();
    const currentModel = opts.model ?? settings.ai_model;
    try {
      const result = await api.getLocalAiModels(ollamaUrl);
      setLocalModels(result.models);
      if (result.error) {
        setOllamaError(result.error);
        if (!opts.silent) addToast('Ollama detection failed: ' + result.error, 'error');
      } else if (result.models.length === 0) {
        setOllamaError('Ollama is reachable, but no chat models were found. Run `ollama pull <model>`.');
        if (!opts.silent) addToast('Ollama is reachable, but no chat models were found', 'info');
      } else {
        const nextModel = result.models.includes(currentModel || '') ? currentModel! : result.models[0];
        if (nextModel !== settings.ai_model) {
          setSettings(prev => ({ ...prev, ai_model: nextModel }));
          autoSave({ ai_provider: 'ollama', ai_ollama_url: ollamaUrl, ai_model: nextModel });
        } else if (ollamaUrl) {
          autoSave({ ai_provider: 'ollama', ai_ollama_url: ollamaUrl });
        }
        if (!opts.silent) addToast(`Found ${result.models.length} local model${result.models.length === 1 ? '' : 's'}`, 'success');
      }
    } catch (err: any) {
      setOllamaError(err.message);
      if (!opts.silent) addToast('Error: ' + err.message, 'error');
    } finally {
      setDetectingModels(false);
    }
  };

  useEffect(() => {
    api.getConfig().then(cfg => setVaultPath(cfg.vaultRoot)).catch(() => {});
    api.getSettings().then((data: Settings) => {
      setSettings(prev => ({ ...prev, ...data }));
      if (data.folder_organization) setFolderOrg(data.folder_organization);
    }).catch(() => {});
  }, []);

  // Auto-save non-credential settings (folder org, provider, model, ollama url).
  const updateFolderOrg = (next: FolderOrg) => {
    setFolderOrg(next);
    autoSave({ folder_organization: next });
  };

  const updateProvider = (provider: 'openai' | 'ollama') => {
    const next = { ai_provider: provider, ai_model: settings.ai_model || (provider === 'ollama' ? '' : 'gpt-4o-mini') };
    setSettings(prev => ({ ...prev, ...next }));
    autoSave(next);
    if (provider === 'ollama') {
      void detectLocalModels({ silent: true });
    }
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
      const data = await api.rescan(deleteMissing);
      setScanResult(data);
    } catch (err: any) {
      setScanResult({ error: err.message });
    } finally {
      setScanning(false);
    }
  };

  const folderOptions: { value: FolderOrg; label: string; example: string }[] = [
    { value: 'year-month', label: 'Year / Month', example: '2026/05/' },
    { value: 'category-year', label: 'Category / Year', example: 'Finance/2026/' },
    { value: 'year-category', label: 'Year / Category', example: '2026/Finance/' },
    { value: 'type-year', label: 'Type / Year', example: 'Receipt/2026/' },
    { value: 'flat', label: 'Flat', example: 'All in one folder' },
  ];

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-text">Settings</h1>
        <p className="text-sm mt-0.5 text-text2">Configure your vault, AI, and appearance.</p>
      </div>

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
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'openai', label: 'OpenAI / API', sub: 'OpenAI-compatible endpoint' },
              { value: 'ollama', label: 'Ollama', sub: 'Local model on your machine' },
            ] as const).map(opt => {
              const isActive = settings.ai_provider === opt.value;
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
                </button>
              );
            })}
          </div>

          {settings.ai_provider === 'openai' ? (
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
          ) : (
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
                  <Button type="button" onClick={() => detectLocalModels()} disabled={detectingModels}>
                    {detectingModels ? 'Detecting…' : (localModels.length > 0 ? 'Re-detect' : 'Detect')}
                  </Button>
                </div>
              </div>
              {localModels.length > 0 ? (
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Model</label>
                  <Select
                    value={settings.ai_model || ''}
                    onChange={e => {
                      const v = e.target.value;
                      setSettings(prev => ({ ...prev, ai_model: v }));
                      autoSave({ ai_provider: 'ollama', ai_ollama_url: settings.ai_ollama_url, ai_model: v });
                    }}
                  >
                    {localModels.map(model => <option key={model} value={model}>{model}</option>)}
                  </Select>
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
                value={settings.ai_model || ''}
                onChange={e => setSettings(prev => ({ ...prev, ai_model: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="primary" onClick={saveCredentials} disabled={credentialsSaving}>
              {credentialsSaving ? 'Saving…' : 'Save credentials'}
            </Button>
            <Button onClick={testAiConnection} disabled={testingConnection}>
              {testingConnection ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
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

          <div>
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
                  {scanResult.newFiles.length > 0 && <div><strong style={{ color: '#16a34a' }}>+ {scanResult.newFiles.length} new file(s)</strong> — on disk but not indexed</div>}
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
              {storageStats.byCategory.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-text2 mb-2">By category</div>
                  <div className="space-y-2">
                    {storageStats.byCategory.slice(0, 5).map(cat => (
                      <div key={cat.category} className="flex items-center justify-between text-sm">
                        <span className="text-text">{cat.category}</span>
                        <span className="text-text2">{cat.count} · {formatSize(cat.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {storageStats.byType.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-text2 mb-2">By type</div>
                  <div className="space-y-2">
                    {storageStats.byType.slice(0, 5).map(t => (
                      <div key={t.documentType} className="flex items-center justify-between text-sm">
                        <span className="text-text">{t.documentType}</span>
                        <span className="text-text2">{t.count} · {formatSize(t.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Surface>
    </div>
  );
};
