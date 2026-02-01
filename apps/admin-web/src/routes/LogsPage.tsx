import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input, Select } from '../components/Input';
import { Button } from '../components/Button';
import { LogEntry } from '@htown/admin-shared';
import { useToast } from '../context/ToastContext';

const levels = ['debug', 'info', 'warn', 'error'];

export default function LogsPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState('');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState(false);

  const tailUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (level) qs.set('level', level);
    if (query) qs.set('q', query);
    const token = localStorage.getItem('admin_access_token');
    if (token) qs.set('token', token);
    return `${(import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:8080')}/logs/tail?${qs.toString()}`;
  }, [level, query]);

  useEffect(() => {
    let source: EventSource | null = new EventSource(tailUrl, { withCredentials: false });
    setConnected(true);
    source.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        setLogs((prev) => [...prev.slice(-199), entry]);
      } catch {
        // ignore
      }
    };
    source.onerror = () => {
      setConnected(false);
      source?.close();
    };
    return () => {
      source?.close();
      source = null;
    };
  }, [tailUrl]);

  const handleQuery = async () => {
    try {
      const result = await api.queryLogs({ level: level || undefined, q: query || undefined, limit: 200 });
      setLogs(result.data);
      push('Log search updated.', 'success');
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-logs-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Live Logs</h1>
        <p className="text-sm text-slate-400">Streaming admin and game adapter logs with filters.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_200px_auto_auto]">
        <Input label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="">All</option>
          {levels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </Select>
        <Button onClick={handleQuery}>Filter</Button>
        <Button variant="ghost" onClick={handleExport}>
          Export
        </Button>
      </div>
      <div className="text-xs text-slate-400">
        Stream: {connected ? 'connected' : 'disconnected'} · Showing {logs.length} entries
      </div>
      <div className="max-h-[540px] overflow-auto rounded-xl border border-panel-700 bg-panel-900 p-4 text-xs scrollbar-thin">
        <div className="space-y-2">
          {logs.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-panel-800 bg-panel-800/60 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{entry.level}</div>
                <div className="text-[11px] text-slate-500">{new Date(entry.ts).toLocaleTimeString()}</div>
              </div>
              <div className="text-sm text-slate-100">{entry.message}</div>
              {entry.context ? (
                <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-400">
                  {JSON.stringify(entry.context, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
          {logs.length === 0 && <div className="text-slate-500">No log entries yet.</div>}
        </div>
      </div>
    </div>
  );
}
