import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adminConfigSchema, ConfigVersion } from '@htown/admin-shared';
import { Button } from '../components/Button';
import { TextArea, Input, Select } from '../components/Input';
import { toJson } from '../utils/format';

const diffKeys = (current: any, next: any, prefix = ''): string[] => {
  const keys = new Set([...Object.keys(current ?? {}), ...Object.keys(next ?? {})]);
  const changes: string[] = [];
  keys.forEach((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const left = current?.[key];
    const right = next?.[key];
    if (typeof left === 'object' && typeof right === 'object' && left && right) {
      changes.push(...diffKeys(left, right, path));
    } else if (JSON.stringify(left) !== JSON.stringify(right)) {
      changes.push(path);
    }
  });
  return changes;
};

export default function ConfigPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [current, setCurrent] = useState<ConfigVersion | null>(null);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [message, setMessage] = useState('');
  const [editorText, setEditorText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  const changes = useMemo(() => {
    if (!current) return [];
    try {
      const parsed = JSON.parse(editorText || '{}');
      return diffKeys(current.data, parsed);
    } catch {
      return [];
    }
  }, [current, editorText]);

  const load = async () => {
    try {
      const currentVersion = await api.getConfigCurrent();
      const list = await api.getConfigVersions();
      setCurrent(currentVersion);
      setVersions(list);
      setEditorText(toJson(currentVersion.data));
      setSelectedVersionId(currentVersion.id);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(editorText);
      const validated = adminConfigSchema.parse(parsed);
      setError(null);
      push(`Config valid. ${Object.keys(validated).length} root keys.`, 'success');
    } catch (err) {
      setError((err as Error).message);
      push('Validation failed. Check JSON format.', 'error');
    }
  };

  const handlePublish = async () => {
    try {
      const parsed = adminConfigSchema.parse(JSON.parse(editorText));
      const published = await api.publishConfig({ data: parsed, message: message || 'Config update' });
      push('Config published.', 'success');
      setMessage('');
      setCurrent(published);
      setEditorText(toJson(published.data));
      const list = await api.getConfigVersions();
      setVersions(list);
      setSelectedVersionId(published.id);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const handleRollback = async () => {
    if (!selected) return;
    try {
      const rollback = await api.rollbackConfig({
        versionId: selected.id,
        message: message || `Rollback to ${selected.id}`
      });
      push('Rollback published.', 'success');
      setMessage('');
      setCurrent(rollback);
      setEditorText(toJson(rollback.data));
      const list = await api.getConfigVersions();
      setVersions(list);
      setSelectedVersionId(rollback.id);
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Config & Feature Flags</h1>
        <p className="text-sm text-slate-400">Versioned configuration with validation and rollback.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <TextArea
            label="Config JSON"
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            className="min-h-[360px] font-mono text-xs"
          />
          {error && <div className="text-xs text-danger-500">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleValidate}>
              Validate
            </Button>
            <Button onClick={handlePublish}>Publish</Button>
            <Button variant="ghost" onClick={handleRollback}>
              Rollback to Selected
            </Button>
          </div>
          <Input label="Change message" value={message} onChange={(event) => setMessage(event.target.value)} />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-panel-700 bg-panel-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Current Version</div>
            <div className="text-sm text-white">{current?.id ?? '—'}</div>
            <div className="text-xs text-slate-500">{current?.message ?? 'No message'}</div>
          </div>
          <div className="rounded-xl border border-panel-700 bg-panel-900 p-4">
            <Select
              label="Select version"
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id.slice(0, 8)} · {version.message}
                </option>
              ))}
            </Select>
            {selected && (
              <div className="mt-4 text-xs text-slate-400">
                <div>Created: {new Date(selected.createdAt).toLocaleString()}</div>
                <div>By: {selected.createdBy ?? 'system'}</div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-panel-700 bg-panel-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Change Preview</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {changes.length === 0 && <span className="text-slate-500">No changes detected.</span>}
              {changes.map((key) => (
                <span key={key} className="rounded-full border border-panel-700 px-2 py-1 text-slate-300">
                  {key}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
