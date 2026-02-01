import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { formatDuration } from '../utils/format';

export default function DashboardPage() {
  const { api } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.metrics();
        setMetrics(data);
      } catch {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [api]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Dashboard</h1>
        <p className="text-sm text-slate-400">Live status overview for the admin environment.</p>
      </div>
      {loading && <div className="text-sm text-slate-400">Loading metrics...</div>}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Uptime">
            <div className="text-2xl font-semibold text-white">{formatDuration(metrics.uptime)}</div>
            <div className="text-xs text-slate-400">Admin API uptime</div>
          </Card>
          <Card title="RPS / Error Rate">
            <div className="text-2xl font-semibold text-white">{metrics.rps.toFixed(2)} RPS</div>
            <div className="text-xs text-slate-400">Errors: {(metrics.errorRate * 100).toFixed(1)}%</div>
          </Card>
          <Card title="Memory">
            <div className="text-2xl font-semibold text-white">
              {(metrics.memory.heapUsed / 1024 / 1024).toFixed(1)} MB
            </div>
            <div className="text-xs text-slate-400">Heap used</div>
          </Card>
          <Card title="Database">
            <div className="text-2xl font-semibold text-white">
              {metrics.db.connected ? 'Connected' : 'Offline'}
            </div>
            <div className="text-xs text-slate-400">Provider: {metrics.db.provider}</div>
          </Card>
        </div>
      )}
      <Card title="System Summary">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs text-slate-400">CPU</div>
            <div className="text-lg text-white">
              {(metrics?.cpu?.user ?? 0) / 1000} ms user
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">RAM RSS</div>
            <div className="text-lg text-white">
              {metrics ? (metrics.memory.rss / 1024 / 1024).toFixed(1) : '--'} MB
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Request Volume</div>
            <div className="text-lg text-white">{metrics ? metrics.rps.toFixed(2) : '--'} / sec</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
