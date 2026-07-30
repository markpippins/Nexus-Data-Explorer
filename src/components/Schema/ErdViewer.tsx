import React, { useState } from 'react';
import {
  Network,
  Key,
  Layers,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { SchemaObject } from '../../types/database';

interface ErdViewerProps {
  schemas: SchemaObject[];
  onOpenTableQuery: (schemaName: string, tableName: string) => void;
}

export const ErdViewer: React.FC<ErdViewerProps> = ({ schemas, onOpenTableQuery }) => {
  const [selectedSchema, setSelectedSchema] = useState(schemas[0]?.name || 'public');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1);

  const activeSchema = schemas.find((s) => s.name === selectedSchema) || schemas[0];
  const tables = activeSchema?.tables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-xs select-none overflow-hidden relative">
      {/* ERD Control Bar */}
      <div className="h-10 bg-[#181A1F] border-b border-[#2D3139] px-4 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-bold text-[#E2E8F0]">
            <Network className="w-4 h-4 text-purple-400" />
            <span>Entity Relationship Diagram (ERD)</span>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-[11px] text-[#94A3B8] font-medium">Schema:</label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="bg-[#0F1115] border border-[#2D3139] rounded px-2 py-1 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500 font-mono"
            >
              {schemas.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#64748B] pointer-events-none" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0F1115] border border-[#2D3139] rounded pl-8 pr-2 py-1 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500 placeholder:text-[#64748B]"
            />
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            className="p-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className="p-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ERD Canvas Area */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-[#0F1115] relative">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-transform duration-200 ease-out"
        >
          {tables.map((table) => (
            <div
              key={table.name}
              onDoubleClick={() => onOpenTableQuery(selectedSchema, table.name)}
              className="bg-[#1F232B] border border-[#2D3139] rounded-lg shadow-xl overflow-hidden hover:border-blue-500/80 transition-all group cursor-pointer"
            >
              {/* Table Header */}
              <div className="px-3 py-2 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-bold text-[#E2E8F0] text-xs font-mono">{table.name}</span>
                </div>
                <span className="text-[10px] text-[#64748B] font-mono">{table.rowCount} rows</span>
              </div>

              {/* Table Columns List */}
              <div className="p-2 space-y-1 bg-[#1F232B]">
                {table.columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center justify-between px-2 py-1 rounded bg-[#0F1115]/60 border border-[#2D3139]/60 text-[11px] font-mono"
                  >
                    <div className="flex items-center space-x-1.5 truncate mr-2">
                      {col.isPrimaryKey ? (
                        <Key className="w-3 h-3 text-amber-400 shrink-0" />
                      ) : col.isForeignKey ? (
                        <Key className="w-3 h-3 text-blue-400 shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full bg-[#2D3139] text-[9px] text-[#64748B] flex items-center justify-center font-bold">
                          #
                        </span>
                      )}
                      <span className={`truncate ${col.isPrimaryKey ? 'text-amber-300 font-bold' : 'text-[#E2E8F0]'}`}>
                        {col.name}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#64748B] shrink-0">{col.type}</span>
                  </div>
                ))}
              </div>

              {/* FK Links Footer */}
              {table.columns.some((c) => c.isForeignKey) && (
                <div className="px-3 py-1.5 bg-[#181A1F]/80 border-t border-[#2D3139] text-[10px] text-blue-400 font-mono flex items-center space-x-1">
                  <Network className="w-3 h-3" />
                  <span>
                    FK Ref:{' '}
                    {table.columns
                      .filter((c) => c.isForeignKey)
                      .map((c) => c.referencesTable)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
