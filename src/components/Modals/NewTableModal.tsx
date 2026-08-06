import React, { useState } from 'react';
import { Layers, X, Plus, Trash2, Code, Play } from 'lucide-react';
import { ColumnDefinition } from '../../types/database';

interface NewTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTable: (ddlQuery: string) => void;
}

const DATA_TYPES = [
  'SERIAL',
  'BIGSERIAL',
  'INT',
  'BIGINT',
  'VARCHAR(255)',
  'VARCHAR(100)',
  'TEXT',
  'NUMERIC(10,2)',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'UUID',
  'JSONB'
];

export const NewTableModal: React.FC<NewTableModalProps> = ({
  isOpen,
  onClose,
  onCreateTable,
}) => {
  const [schemaName, setSchemaName] = useState('public');
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
    { name: 'name', type: 'VARCHAR(255)', isNullable: false },
    { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
  ]);

  if (!isOpen) return null;

  const addColumn = () => {
    setColumns([
      ...columns,
      { name: `col_${columns.length + 1}`, type: 'VARCHAR(255)', isNullable: true },
    ]);
  };

  const removeColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const updateColumn = (idx: number, field: keyof ColumnDefinition, val: any) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], [field]: val };
    setColumns(updated);
  };

  const generatedDDL = `CREATE TABLE ${schemaName}.${tableName || 'new_table'} (\n` +
    columns
      .map((c) => {
        let line = `  ${c.name || 'col'} ${c.type}`;
        if (c.isPrimaryKey) line += ' PRIMARY KEY';
        if (!c.isNullable && !c.isPrimaryKey) line += ' NOT NULL';
        if (c.defaultValue) line += ` DEFAULT ${c.defaultValue}`;
        return line;
      })
      .join(',\n') +
    `\n);`;

  const handleSubmit = () => {
    if (!tableName.trim()) return;
    onCreateTable(generatedDDL);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#1F232B] border border-[#3B414D] rounded-xl shadow-2xl overflow-hidden font-mono text-sm">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm">Visual Table DDL Builder</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-[#94A3B8] font-bold">Schema</label>
              <input
                type="text"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-2.5 py-1.5 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-[#94A3B8] font-bold">Table Name</label>
              <input
                type="text"
                placeholder="e.g. audit_logs"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-2.5 py-1.5 text-blue-400 focus:outline-none focus:border-blue-500 font-bold"
              />
            </div>
          </div>

          {/* Columns Builder Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#94A3B8] font-bold uppercase tracking-wider">Columns Schema</span>
              <button
                onClick={addColumn}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Column</span>
              </button>
            </div>

            <div className="border border-[#2D3139] rounded-lg overflow-hidden bg-[#0F1115]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#181A1F] border-b border-[#2D3139] text-[10px] uppercase text-[#94A3B8]">
                  <tr>
                    <th className="p-2">Name</th>
                    <th className="p-2">Type</th>
                    <th className="p-2 text-center">PK</th>
                    <th className="p-2 text-center">Nullable</th>
                    <th className="p-2">Default</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr key={idx} className="border-b border-[#1F232B]">
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                          className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-[#E2E8F0] outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          value={col.type}
                          onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                          className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-[#E2E8F0] outline-none"
                        >
                          {DATA_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={col.isPrimaryKey || false}
                          onChange={(e) => updateColumn(idx, 'isPrimaryKey', e.target.checked)}
                          className="rounded border-[#2D3139] bg-[#181A1F] text-blue-500"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={col.isNullable || false}
                          onChange={(e) => updateColumn(idx, 'isNullable', e.target.checked)}
                          className="rounded border-[#2D3139] bg-[#181A1F] text-blue-500"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="e.g. 'active'"
                          value={col.defaultValue || ''}
                          onChange={(e) => updateColumn(idx, 'defaultValue', e.target.value)}
                          className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-[#E2E8F0] outline-none"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          onClick={() => removeColumn(idx)}
                          className="p-1 hover:bg-[#2D3139] text-[#64748B] hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DDL Preview Box */}
          <div className="space-y-1">
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider flex items-center space-x-1">
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>Generated PostgreSQL DDL</span>
            </span>
            <pre className="p-3 bg-[#0F1115] border border-[#2D3139] rounded text-blue-300 overflow-x-auto whitespace-pre-wrap">
              {generatedDDL}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#181A1F] border-t border-[#2D3139] flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!tableName.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-semibold shadow-md flex items-center space-x-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute DDL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
