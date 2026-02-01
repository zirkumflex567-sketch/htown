import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { AssetEntry } from '@htown/admin-shared';

const isImage = (path: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

export default function AssetsPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [targetPath, setTargetPath] = useState('');
  const [targetName, setTargetName] = useState('');
  const [replace, setReplace] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listAssets();
      setAssets(result.data);
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [api, push]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleUpload = async () => {
    if (!file) {
      push('Select a file first.', 'warning');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (targetPath) formData.append('path', targetPath);
    if (targetName) formData.append('name', targetName);
    if (replace) formData.append('replace', 'true');
    try {
      await api.uploadAsset(formData);
      push('Upload complete', 'success');
      setFile(null);
      setTargetPath('');
      setTargetName('');
      setReplace(false);
      await loadAssets();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  const handleDelete = async (entry: AssetEntry) => {
    if (!confirm(`Delete ${entry.path}?`)) return;
    try {
      await api.deleteAsset(entry.path);
      push('Asset deleted', 'success');
      await loadAssets();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Asset Store</h1>
        <p className="text-sm text-slate-400">Upload and replace game assets.</p>
      </div>

      <Card title="Upload">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="file"
            className="rounded-md border border-panel-700 bg-panel-900 p-2 text-sm text-slate-100"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <input
            className="rounded-md border border-panel-700 bg-panel-900 px-3 py-2 text-sm text-slate-100"
            placeholder="Folder path (optional) e.g. ui/icons"
            value={targetPath}
            onChange={(event) => setTargetPath(event.target.value)}
          />
          <input
            className="rounded-md border border-panel-700 bg-panel-900 px-3 py-2 text-sm text-slate-100"
            placeholder="Override filename (optional)"
            value={targetName}
            onChange={(event) => setTargetName(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
            />
            Replace if exists
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleUpload}>Upload</Button>
          <Button variant="ghost" onClick={() => void loadAssets()}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card title={`Assets (${assets.length})`}>
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Preview</th>
                  <th className="px-3 py-2 text-left">Path</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {assets.map((asset) => (
                  <tr key={asset.path} className="border-t border-panel-800">
                    <td className="px-3 py-2">
                      {isImage(asset.path) ? (
                        <img src={asset.url} alt={asset.path} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="text-xs text-slate-500">File</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a className="text-accent-400 hover:text-accent-300" href={asset.url} target="_blank" rel="noreferrer">
                        {asset.path}
                      </a>
                    </td>
                    <td className="px-3 py-2">{(asset.size / 1024).toFixed(1)} KB</td>
                    <td className="px-3 py-2">{new Date(asset.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Button variant="danger" onClick={() => handleDelete(asset)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No assets yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
