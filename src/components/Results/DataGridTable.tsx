import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  FileSpreadsheet,
  FileCode,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { QueryExecutionResult } from '../../types/database';

interface DataGridTableProps {
  result: QueryExecutionResult;
}

export const DataGridTable: React.FC<DataGridTableProps> = ({ result }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [inspectCell, setInspectCell] = useState<{ col: string; val: any } | null>(null);

  if (!result || result.columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 font-mono text-xs">
        <p>No tabular dataset returned for this statement.</p>
        {result.message && <p className="text-emerald-400 mt-2">{result.message}</p>}
      </div>
    );
  }

  // Filter rows
  let processedRows = result.rows.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(term));
  });

  // Sort rows
  if (sortCol) {
    processedRows.sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const cmp = valA > valB ? 1 : -1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const totalRows = processedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = processedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Export handlers
  const exportCsv = () => {
    const headers = result.columns.join(',');
    const rowsText = result.rows
      .map((r) =>
        result.columns
          .map((c) => {
            const val = r[c];
            if (val === null || val === undefined) return '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([`${headers}\n${rowsText}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_export_${Date.now()}.csv`;
    a.click();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_export_${Date.now()}.json`;
    a.click();
  };

  const copySqlInserts = () => {
    const table = 'query_result';
    const sql = result.rows
      .map((r) => {
        const cols = result.columns.join(', ');
        const vals = result.columns
          .map((c) => {
            const v = r[c];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');
        return `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
      })
      .join('\n');

    navigator.clipboard.writeText(sql);
    setCopiedType('sql');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const copyMarkdown = () => {
    const headerRow = `| ${result.columns.join(' | ')} |`;
    const dividerRow = `| ${result.columns.map(() => '---').join(' | ')} |`;
    const dataRows = result.rows
      .map((r) => `| ${result.columns.map((c) => String(r[c] ?? '')).join(' | ')} |`)
      .join('\n');

    const md = `${headerRow}\n${dividerRow}\n${dataRows}`;
    navigator.clipboard.writeText(md);
    setCopiedType('md');
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-xs select-text overflow-hidden">
      {/* Table Toolbar */}
      <div className="h-9 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-[#64748B] pointer-events-none" />
            <input
              type="text"
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0F1115] border border-[#2D3139] rounded pl-7 pr-2 py-1 text-[11px] text-[#E2E8F0] focus:outline-none focus:border-blue-500 placeholder:text-[#64748B]"
            />
          </div>

          <span className="text-[11px] text-[#94A3B8]">
            {totalRows} rows returned in <strong className="text-blue-400">{result.executionTimeMs} ms</strong>
          </span>
        </div>

        {/* Exports & Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={exportCsv}
            title="Download CSV"
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">CSV</span>
          </button>

          <button
            onClick={exportJson}
            title="Download JSON"
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px]">JSON</span>
          </button>

          <button
            onClick={copySqlInserts}
            title="Copy SQL Inserts"
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
          >
            {copiedType === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">SQL Inserts</span>
          </button>

          <button
            onClick={copyMarkdown}
            title="Copy Markdown Table"
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
          >
            {copiedType === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">Markdown</span>
          </button>
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse border-[#2D3139]">
          <thead className="sticky top-0 bg-[#181A1F] z-10 shadow-sm">
            <tr>
              <th className="w-10 px-2 py-1.5 border-b border-r border-[#2D3139] text-[10px] text-[#64748B] font-mono text-center">
                #
              </th>
              {result.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-1.5 border-b border-r border-[#2D3139] text-[#E2E8F0] font-semibold text-[11px] font-mono cursor-pointer hover:bg-[#2D3139] select-none group transition-colors"
                >
                  <div className="flex items-center justify-between space-x-2">
                    <span className="truncate">{col}</span>
                    <ArrowUpDown className="w-3 h-3 text-[#64748B] group-hover:text-blue-400 transition-colors shrink-0" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rIdx) => {
              const actualRowIdx = (currentPage - 1) * pageSize + rIdx + 1;
              return (
                <tr key={rIdx} className="hover:bg-[#2D3139]/60 border-b border-[#1F232B] transition-colors">
                  <td className="px-2 py-1 border-r border-[#2D3139]/80 text-[10px] text-[#64748B] text-center font-mono">
                    {actualRowIdx}
                  </td>
                  {result.columns.map((col) => {
                    const val = row[col];
                    const isNull = val === null || val === undefined;

                    return (
                      <td
                        key={col}
                        onDoubleClick={() => setInspectCell({ col, val })}
                        title="Double-click to inspect cell content"
                        className="px-3 py-1 border-r border-[#2D3139]/80 text-[#E2E8F0] truncate max-w-xs font-mono text-xs cursor-pointer hover:bg-blue-950/30 transition-colors"
                      >
                        {isNull ? (
                          <span className="text-[#64748B] italic">NULL</span>
                        ) : typeof val === 'boolean' ? (
                          <span
                            className={`px-1 rounded text-[10px] font-bold ${
                              val ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                            }`}
                          >
                            {String(val).toUpperCase()}
                          </span>
                        ) : (
                          <span>{String(val)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination & Footer Bar */}
      <div className="h-8 bg-[#181A1F] border-t border-[#2D3139] px-3 flex items-center justify-between text-[#94A3B8] shrink-0">
        <div className="flex items-center space-x-2 text-[11px]">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="bg-[#0F1115] border border-[#2D3139] rounded px-1.5 py-0.5 text-[#E2E8F0] focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <span>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <div className="flex items-center space-x-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 bg-[#2D3139] disabled:opacity-40 hover:bg-[#3B414D] text-[#E2E8F0] rounded"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 bg-[#2D3139] disabled:opacity-40 hover:bg-[#3B414D] text-[#E2E8F0] rounded"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Cell Modal */}
      {inspectCell && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1F232B] border border-[#3B414D] rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-4 py-2 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
              <span className="font-bold text-blue-400">Column: {inspectCell.col}</span>
              <button
                onClick={() => setInspectCell(null)}
                className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-[#0F1115] text-[#E2E8F0] overflow-auto max-h-96">
              <pre className="whitespace-pre-wrap font-mono text-xs text-[#E2E8F0] bg-[#181A1F] p-3 rounded border border-[#2D3139]">
                {typeof inspectCell.val === 'object'
                  ? JSON.stringify(inspectCell.val, null, 2)
                  : String(inspectCell.val)}
              </pre>
            </div>
            <div className="px-4 py-2 bg-[#181A1F] border-t border-[#2D3139] flex justify-end">
              <button
                onClick={() => setInspectCell(null)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
