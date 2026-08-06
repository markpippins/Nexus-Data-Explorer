import React, { useState } from 'react';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Check,
  X,
  Code,
  Download,
  Key,
  Edit2
} from 'lucide-react';
import { TableObject, SchemaObject } from '../../types/database';

interface TableDataViewerProps {
  schemaName: string;
  tableName: string;
  table: TableObject | undefined;
  onRefresh: () => void;
  onUpdateRow: (rowIndex: number, updatedRow: Record<string, any>) => void;
  onAddRow: (newRow: Record<string, any>) => void;
  onDeleteRow: (rowIndex: number) => void;
}

export const TableDataViewer: React.FC<TableDataViewerProps> = ({
  schemaName,
  tableName,
  table,
  onRefresh,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<{ rIdx: number; col: string; val: any } | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  if (!table) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#64748B] font-mono text-sm">
        <p>Table "{schemaName}.{tableName}" not found or dropped.</p>
      </div>
    );
  }

  const filteredData = table.data.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(term));
  });

  const handleSaveCell = () => {
    if (!editingCell) return;
    const originalRow = table.data[editingCell.rIdx];
    const updatedRow = { ...originalRow, [editingCell.col]: editingCell.val };
    onUpdateRow(editingCell.rIdx, updatedRow);
    setEditingCell(null);
  };

  const handleCreateNewRow = () => {
    onAddRow(newRowData);
    setIsAddingRow(false);
    setNewRowData({});
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-sm select-text overflow-hidden">
      {/* Table Viewer Header Toolbar */}
      <div className="h-10 bg-[#181A1F] border-b border-[#2D3139] px-4 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold text-[#E2E8F0] text-sm">
            <TableIcon className="w-4 h-4 text-blue-400" />
            <span>{schemaName}.{tableName}</span>
            <span className="text-sm text-[#64748B] font-normal ml-2">({table.rowCount} total records)</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#64748B] pointer-events-none" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0F1115] border border-[#2D3139] rounded pl-8 pr-2 py-1 text-sm text-[#E2E8F0] focus:outline-none focus:border-blue-500 placeholder:text-[#64748B]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setIsAddingRow(true);
              const init: Record<string, any> = {};
              table.columns.forEach((c) => {
                if (!c.isPrimaryKey) init[c.name] = '';
              });
              setNewRowData(init);
            }}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold flex items-center space-x-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>

          {selectedRowIdx !== null && (
            <button
              onClick={() => {
                onDeleteRow(selectedRowIdx);
                setSelectedRowIdx(null);
              }}
              className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded font-medium flex items-center space-x-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            title="Reload table records"
            className="p-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse border-[#2D3139]">
          <thead className="sticky top-0 bg-[#181A1F] z-10 shadow-sm">
            <tr>
              <th className="w-10 px-2 py-2 border-b border-r border-[#2D3139] text-[10px] text-[#64748B] text-center">
                #
              </th>
              {table.columns.map((col) => (
                <th
                  key={col.name}
                  className="px-3 py-2 border-b border-r border-[#2D3139] text-[#E2E8F0] font-semibold text-sm font-mono"
                >
                  <div className="flex items-center space-x-1.5">
                    {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span>{col.name}</span>
                    <span className="text-[9px] text-[#64748B] font-normal">({col.type})</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, rIdx) => {
              const isSelected = selectedRowIdx === rIdx;
              return (
                <tr
                  key={rIdx}
                  onClick={() => setSelectedRowIdx(rIdx)}
                  className={`border-b border-[#1F232B] transition-colors ${
                    isSelected ? 'bg-blue-950/40 border-blue-800/50' : 'hover:bg-[#2D3139]/50'
                  }`}
                >
                  <td className="px-2 py-1.5 border-r border-[#2D3139]/80 text-[10px] text-[#64748B] text-center font-mono">
                    {rIdx + 1}
                  </td>
                  {table.columns.map((col) => {
                    const val = row[col.name];
                    const isEditing = editingCell?.rIdx === rIdx && editingCell?.col === col.name;

                    return (
                      <td
                        key={col.name}
                        onDoubleClick={() => setEditingCell({ rIdx, col: col.name, val })}
                        className="px-3 py-1.5 border-r border-[#2D3139]/80 text-[#E2E8F0] truncate max-w-xs font-mono text-sm cursor-pointer hover:bg-[#2D3139]"
                      >
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              value={editingCell.val}
                              onChange={(e) => setEditingCell({ ...editingCell, val: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCell();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              autoFocus
                              className="w-full bg-[#0F1115] border border-blue-500 rounded px-1.5 py-0.5 text-sm text-white outline-none"
                            />
                            <button onClick={handleSaveCell} className="p-0.5 text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingCell(null)} className="p-0.5 text-[#94A3B8]">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : val === null || val === undefined ? (
                          <span className="text-[#64748B] italic">NULL</span>
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

      {/* Add Row Modal */}
      {isAddingRow && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1F232B] border border-[#3B414D] rounded-lg shadow-2xl p-4 font-mono text-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D3139] pb-2">
              <span className="font-bold text-blue-400 text-sm">Add New Row to {tableName}</span>
              <button onClick={() => setIsAddingRow(false)} className="text-[#94A3B8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {table.columns.map((col) => (
                <div key={col.name} className="space-y-1">
                  <label className="text-[11px] text-[#94A3B8] font-bold flex justify-between">
                    <span>{col.name}</span>
                    <span className="text-[#64748B] font-normal">({col.type})</span>
                  </label>
                  <input
                    type="text"
                    disabled={col.isPrimaryKey && (col.type === 'SERIAL' || col.type === 'BIGSERIAL')}
                    placeholder={col.isPrimaryKey ? 'Auto Serial ID' : `Enter ${col.name}...`}
                    value={newRowData[col.name] || ''}
                    onChange={(e) => setNewRowData({ ...newRowData, [col.name]: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-2.5 py-1 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 border-t border-[#2D3139] pt-3">
              <button
                onClick={() => setIsAddingRow(false)}
                className="px-3 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewRow}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
              >
                Insert Row
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
