import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import Modal from '../components/Modal';
import type { DataColumn, DataRow, DataSource, DataTable } from '@htown/admin-shared';

type EditorMode = 'edit' | 'insert';

const parseValue = (value: string, column: DataColumn) => {
  if (value === '') return null;
  const type = column.type.toUpperCase();
  if (type.includes('INT')) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed;
  }
  if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB') || type.includes('NUM')) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
};

const isJsonColumn = (columnName: string) =>
  columnName.endsWith('_json') ||
  columnName.endsWith('_stats') ||
  columnName.endsWith('_summary') ||
  columnName === 'data_json';

export default function DataPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [tables, setTables] = useState<DataTable[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState('admin');
  const [selectedTable, setSelectedTable] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [editorRow, setEditorRow] = useState<DataRow | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});

  const activeTable = useMemo(() => tables.find((table) => table.name === selectedTable) ?? null, [tables, selectedTable]);
  const columns = activeTable?.columns ?? [];

  const loadSources = useCallback(async () => {
    try {
      const result = await api.listDataSources();
      setSources(result.sources);
    } catch (error) {
      push((error as Error).message, 'error');
    }
  }, [api, push]);

  const loadTables = useCallback(async () => {
    if (!selectedSource) return;
    try {
      const result = await api.listDataTables(selectedSource);
      setTables(result.tables);
      if (result.tables.length > 0 && !result.tables.find((table) => table.name === selectedTable)) {
        setSelectedTable(result.tables[0].name);
      }
    } catch (error) {
      push((error as Error).message, 'error');
    }
  }, [api, push, selectedSource, selectedTable]);

  const loadRows = useCallback(async () => {
    if (!selectedSource || !selectedTable) return;
    setLoading(true);
    try {
      const result = await api.listDataRows({
        source: selectedSource,
        table: selectedTable,
        page,
        pageSize,
        q: query || undefined
      });
      setRows(result.data);
      setPrimaryKey(result.primaryKey ?? null);
      setTotal(result.pagination.total);
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [api, selectedSource, selectedTable, page, pageSize, query, push]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openEditor = (mode: EditorMode, row?: DataRow) => {
    setEditorMode(mode);
    setEditorRow(row ?? null);
    const values: Record<string, string> = {};
    columns.forEach((col) => {
      const value = row ? row[col.name] : '';
      values[col.name] = value === null || value === undefined ? '' : String(value);
    });
    setEditorValues(values);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!activeTable) return;
    const payload: Record<string, any> = {};
    const editableColumns = columns.filter((col) => col.editable || (editorMode === 'insert' && col.primaryKey));
    editableColumns.forEach((col) => {
      payload[col.name] = parseValue(editorValues[col.name] ?? '', col);
    });
    try {
      if (editorMode === 'edit') {
        if (!primaryKey || !editorRow) throw new Error('Missing primary key');
        await api.updateDataRow({
          source: selectedSource,
          table: selectedTable,
          id: editorRow[primaryKey],
          changes: payload
        });
        push('Row updated', 'success');
      } else {
        await api.insertDataRow({
          source: selectedSource,
          table: selectedTable,
          record: payload
        });
        push('Row inserted', 'success');
      }
      setModalOpen(false);
      await loadRows();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  const handleDelete = async (row: DataRow) => {
    if (!primaryKey) return;
    if (!confirm('Delete this row?')) return;
    try {
      await api.deleteDataRow({ source: selectedSource, table: selectedTable, id: row[primaryKey] });
      push('Row deleted', 'success');
      await loadRows();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Data Explorer</h1>
        <p className="text-sm text-slate-400">Browse and edit game data tables.</p>
      </div>

      <Card title="Filters">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-md border border-panel-700 bg-panel-900 px-3 py-2 text-sm text-slate-100"
            value={selectedSource}
            onChange={(event) => {
              setSelectedSource(event.target.value);
              setPage(1);
            }}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-panel-700 bg-panel-900 px-3 py-2 text-sm text-slate-100"
            value={selectedTable}
            onChange={(event) => {
              setSelectedTable(event.target.value);
              setPage(1);
            }}
          >
            {tables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded-md border border-panel-700 bg-panel-900 px-3 py-2 text-sm text-slate-100"
            placeholder="Search..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setPage(1);
                void loadRows();
              }
            }}
          />
          <Button onClick={() => void loadRows()}>Refresh</Button>
          {activeTable?.canInsert && (
            <Button onClick={() => openEditor('insert')}>Add Row</Button>
          )}
        </div>
      </Card>

      <Card title={`${selectedTable || 'Table'} (${total})`}>
        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col.name} className="px-3 py-2 text-left">
                      {col.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-panel-800">
                    {columns.map((col) => (
                      <td key={col.name} className="px-3 py-2 align-top">
                        <div className="max-w-[280px] truncate text-slate-200">
                          {row[col.name] === null || row[col.name] === undefined ? '—' : String(row[col.name])}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {activeTable?.canUpdate && (
                          <Button variant="ghost" onClick={() => openEditor('edit', row)}>
                            Edit
                          </Button>
                        )}
                        {activeTable?.canDelete && (
                          <Button variant="danger" onClick={() => handleDelete(row)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-slate-500">
                      No rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-panel-700 bg-panel-900 px-2 py-1 text-xs"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        title={editorMode === 'edit' ? 'Edit Row' : 'Add Row'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-3">
          {columns.map((col) => {
            const isEditable = col.editable || (editorMode === 'insert' && col.primaryKey);
            const isTextArea = isJsonColumn(col.name);
            return (
              <label key={col.name} className="block text-xs text-slate-400">
                {col.name}
                {isTextArea ? (
                  <textarea
                    className="mt-1 w-full rounded-md border border-panel-700 bg-panel-900 p-2 text-sm text-slate-100"
                    rows={3}
                    value={editorValues[col.name] ?? ''}
                    onChange={(event) =>
                      setEditorValues((prev) => ({ ...prev, [col.name]: event.target.value }))
                    }
                    disabled={!isEditable}
                  />
                ) : (
                  <input
                    className="mt-1 w-full rounded-md border border-panel-700 bg-panel-900 px-3 py-2 text-sm text-slate-100"
                    value={editorValues[col.name] ?? ''}
                    onChange={(event) =>
                      setEditorValues((prev) => ({ ...prev, [col.name]: event.target.value }))
                    }
                    disabled={!isEditable}
                  />
                )}
              </label>
            );
          })}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editorMode === 'edit' ? 'Save' : 'Insert'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
