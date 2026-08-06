import React, { useState } from 'react';
import {
  Database,
  Table as TableIcon,
  Eye,
  Zap,
  Code,
  ChevronRight,
  ChevronDown,
  Key,
  Search,
  Bookmark,
  History,
  Plus,
  RefreshCw,
  Folder,
  FolderOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  DBConnection,
  SchemaObject,
  TableObject,
  ViewObject,
  TriggerObject,
  StoredProcedureObject,
  ContextMenuState,
  SavedQuery
} from '../../types/database';

interface TreeViewProps {
  activeConnection: DBConnection | null;
  schemas: SchemaObject[];
  savedQueries: SavedQuery[];
  history: string[];
  onContextMenu: (state: ContextMenuState) => void;
  onSelectTable: (schemaName: string, tableName: string) => void;
  onOpenSavedQuery: (query: SavedQuery) => void;
  onOpenHistoryQuery: (queryStr: string) => void;
  onOpenNewConnectionModal: () => void;
  onOpenNewTableModal: () => void;
  onRefreshSchema: () => void;
  onOpenEavStudio?: (schemaName?: string) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  activeConnection,
  schemas,
  savedQueries,
  history,
  onContextMenu,
  onSelectTable,
  onOpenSavedQuery,
  onOpenHistoryQuery,
  onOpenNewConnectionModal,
  onOpenNewTableModal,
  onRefreshSchema,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'schema-public': true,
    'cat-public-tables': true,
  });

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRightClick = (
    e: React.MouseEvent,
    type: ContextMenuState['type'],
    schemaName?: string,
    objectName?: string,
    objectData?: any
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      connectionId: activeConnection?.id,
      schemaName,
      objectName,
      objectData,
    });
  };

  const filteredSchemas = schemas.map((schema) => {
    if (!searchTerm) return schema;
    const term = searchTerm.toLowerCase();
    return {
      ...schema,
      tables: schema.tables.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.columns.some((c) => c.name.toLowerCase().includes(term))
      ),
      views: schema.views.filter((v) => v.name.toLowerCase().includes(term)),
      triggers: schema.triggers.filter((tr) => tr.name.toLowerCase().includes(term)),
      procedures: schema.procedures.filter((p) => p.name.toLowerCase().includes(term)),
    };
  });

  return (
    <aside className="w-64 bg-[#181A1F] border-r border-[#2D3139] flex flex-col h-full select-none text-[#E2E8F0] font-sans shrink-0">
      {/* Search & Actions Header */}
      <div className="p-3 border-b border-[#2D3139] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#94A3B8] flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Database Explorer</span>
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={onOpenNewTableModal}
              title="New Table DDL"
              className="p-1 hover:bg-[#2D3139] text-[#94A3B8] hover:text-white rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRefreshSchema}
              title="Refresh Schema"
              className="p-1 hover:bg-[#2D3139] text-[#94A3B8] hover:text-white rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B] pointer-events-none" />
          <input
            type="text"
            placeholder="Filter tables, views..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0F1115] border border-[#2D3139] rounded text-sm text-[#E2E8F0] pl-8 pr-3 py-1 focus:outline-none focus:border-blue-500 font-mono transition-colors placeholder:text-[#64748B]"
          />
        </div>
      </div>

      {/* Active Connection Banner */}
      {activeConnection && (
        <div className="px-3 py-1.5 bg-[#0F1115] border-b border-[#2D3139] flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2 truncate">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: activeConnection.color }}
            />
            <span className="font-mono text-[11px] font-medium text-[#E2E8F0] truncate">
              {activeConnection.database}
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
            PostgreSQL
          </span>
        </div>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-sm space-y-1">
        {filteredSchemas.map((schema) => {
          const schemaId = `schema-${schema.name}`;
          const isSchemaExpanded = expandedNodes[schemaId] ?? true;

          return (
            <div key={schema.name} className="text-sm">
              {/* Schema Node */}
              <div
                onClick={(e) => toggleNode(schemaId, e)}
                onContextMenu={(e) => handleRightClick(e, 'schema', schema.name)}
                className="flex items-center space-x-1.5 px-2 py-1 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-medium group"
              >
                {isSchemaExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                )}
                {isSchemaExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="truncate">{schema.name}</span>
                {(schema.category === 'shrapnel' || schema.name === 'shrapnel') && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenEavStudio) onOpenEavStudio(schema.name);
                    }}
                    title="Open EAV Studio"
                    className="px-1.5 py-0.2 text-[9px] bg-purple-950/80 text-purple-300 border border-purple-700/50 rounded font-semibold ml-1 hover:bg-purple-900 transition-colors"
                  >
                    shrapnel
                  </span>
                )}
                <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                  ({schema.tables.length})
                </span>
              </div>

              {/* Schema Children */}
              {isSchemaExpanded && (
                <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-1 my-0.5">
                  {/* TABLES CATEGORY */}
                  <div>
                    <div
                      onClick={(e) => toggleNode(`cat-${schema.name}-tables`, e)}
                      className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] font-mono text-[11px]"
                    >
                      {expandedNodes[`cat-${schema.name}-tables`] ? (
                        <ChevronDown className="w-3 h-3 text-[#64748B]" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[#64748B]" />
                      )}
                      <TableIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Tables</span>
                      <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                        {schema.tables.length}
                      </span>
                    </div>

                    {expandedNodes[`cat-${schema.name}-tables`] && (
                      <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                        {schema.tables.map((table) => {
                          const tableId = `tbl-${schema.name}-${table.name}`;
                          const isTableExpanded = expandedNodes[tableId] ?? false;

                          return (
                            <div key={table.name}>
                              <div
                                onClick={(e) => toggleNode(tableId, e)}
                                onDoubleClick={() => onSelectTable(schema.name, table.name)}
                                onContextMenu={(e) =>
                                  handleRightClick(e, 'table', schema.name, table.name, table)
                                }
                                title="Double-click to open data grid"
                                className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono group transition-colors"
                              >
                                {isTableExpanded ? (
                                  <ChevronDown className="w-3 h-3 text-[#64748B]" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-[#64748B]" />
                                )}
                                <TableIcon className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 group-hover:text-cyan-300" />
                                <span className="truncate group-hover:text-white">
                                  {table.name}
                                </span>
                                <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                                  {table.rowCount}
                                </span>
                              </div>

                              {/* Table Columns Expandable */}
                              {isTableExpanded && (
                                <div className="ml-4 pl-2 border-l border-[#2D3139]/60 space-y-0.5 my-0.5">
                                  {table.columns.map((col) => (
                                    <div
                                      key={col.name}
                                      className="flex items-center space-x-1.5 px-2 py-0.5 text-[11px] font-mono text-[#94A3B8] hover:text-[#E2E8F0]"
                                    >
                                      {col.isPrimaryKey ? (
                                        <Key className="w-3 h-3 text-amber-400 shrink-0" />
                                      ) : col.isForeignKey ? (
                                        <Key className="w-3 h-3 text-blue-400 shrink-0" />
                                      ) : (
                                        <span className="w-3 h-3 rounded bg-[#2D3139] text-[9px] text-[#94A3B8] flex items-center justify-center font-bold">
                                          #
                                        </span>
                                      )}
                                      <span className="truncate">{col.name}</span>
                                      <span className="text-[9px] text-[#64748B] ml-auto font-mono truncate">
                                        {col.type}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* VIEWS CATEGORY */}
                  {schema.views.length > 0 && (
                    <div>
                      <div
                        onClick={(e) => toggleNode(`cat-${schema.name}-views`, e)}
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] font-mono text-[11px]"
                      >
                        {expandedNodes[`cat-${schema.name}-views`] ? (
                          <ChevronDown className="w-3 h-3 text-[#64748B]" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-[#64748B]" />
                        )}
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Views</span>
                        <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                          {schema.views.length}
                        </span>
                      </div>

                      {expandedNodes[`cat-${schema.name}-views`] && (
                        <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                          {schema.views.map((view) => (
                            <div
                              key={view.name}
                              onDoubleClick={() => onSelectTable(schema.name, view.name)}
                              onContextMenu={(e) =>
                                handleRightClick(e, 'view', schema.name, view.name, view)
                              }
                              className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono text-sm group"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate group-hover:text-white">{view.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TRIGGERS CATEGORY */}
                  {schema.triggers.length > 0 && (
                    <div>
                      <div
                        onClick={(e) => toggleNode(`cat-${schema.name}-triggers`, e)}
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] font-mono text-[11px]"
                      >
                        {expandedNodes[`cat-${schema.name}-triggers`] ? (
                          <ChevronDown className="w-3 h-3 text-[#64748B]" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-[#64748B]" />
                        )}
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Triggers</span>
                        <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                          {schema.triggers.length}
                        </span>
                      </div>

                      {expandedNodes[`cat-${schema.name}-triggers`] && (
                        <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                          {schema.triggers.map((trg) => (
                            <div
                              key={trg.name}
                              onContextMenu={(e) =>
                                handleRightClick(e, 'trigger', schema.name, trg.name, trg)
                              }
                              className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono text-sm group"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate group-hover:text-white">{trg.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PROCEDURES CATEGORY */}
                  {schema.procedures.length > 0 && (
                    <div>
                      <div
                        onClick={(e) => toggleNode(`cat-${schema.name}-procedures`, e)}
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] font-mono text-[11px]"
                      >
                        {expandedNodes[`cat-${schema.name}-procedures`] ? (
                          <ChevronDown className="w-3 h-3 text-[#64748B]" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-[#64748B]" />
                        )}
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Procedures</span>
                        <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                          {schema.procedures.length}
                        </span>
                      </div>

                      {expandedNodes[`cat-${schema.name}-procedures`] && (
                        <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                          {schema.procedures.map((proc) => (
                            <div
                              key={proc.name}
                              onContextMenu={(e) =>
                                handleRightClick(e, 'procedure', schema.name, proc.name, proc)
                              }
                              className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono text-sm group"
                            >
                              <Code className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="truncate group-hover:text-white">{proc.name}()</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bookmarks & Saved Snippets Footer Drawer */}
      <div className="p-2 border-t border-[#2D3139] bg-[#0F1115] text-sm">
        <div
          onClick={(e) => toggleNode('drawer-saved', e)}
          className="flex items-center justify-between font-mono text-[#94A3B8] cursor-pointer p-1 rounded hover:bg-[#181A1F]"
        >
          <div className="flex items-center space-x-1.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">Saved Snippets</span>
          </div>
          <span className="text-[10px] text-[#64748B] font-mono">({savedQueries.length})</span>
        </div>

        {expandedNodes['drawer-saved'] && (
          <div className="mt-1 space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
            {savedQueries.length === 0 ? (
              <p className="text-[11px] text-[#64748B] italic p-1">No saved snippets yet.</p>
            ) : (
              savedQueries.map((q) => (
                <div
                  key={q.id}
                  onClick={() => onOpenSavedQuery(q)}
                  className="p-1.5 bg-[#181A1F] hover:bg-[#2D3139] border border-[#2D3139] rounded cursor-pointer truncate font-mono text-[11px] text-[#E2E8F0] transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{q.title}</span>
                  <ChevronRight className="w-3 h-3 text-[#64748B] shrink-0" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
