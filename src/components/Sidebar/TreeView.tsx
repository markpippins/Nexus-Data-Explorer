import React, { useState, useMemo } from 'react';
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
  AlertCircle,
  Boxes,
  X,
  Layers,
  Filter
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
  onOpenQueryBuilder?: (schemaName?: string, tableName?: string) => void;
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
  onOpenEavStudio,
  onOpenQueryBuilder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tables' | 'views'>('all');
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

  // Helper to highlight matching substrings in object names
  const renderHighlightedText = (text: string, query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
    if (index === -1) return text;
    const before = text.substring(0, index);
    const match = text.substring(index, index + trimmed.length);
    const after = text.substring(index + trimmed.length);
    return (
      <>
        {before}
        <span className="bg-amber-500/30 text-amber-200 font-semibold px-0.5 rounded">
          {match}
        </span>
        {after}
      </>
    );
  };

  // Calculate filtered schemas dynamically as user types
  const { filteredSchemas, totalMatchingTables, totalMatchingViews, hasAnyMatches, totalUnfilteredCount } = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let matchTablesCount = 0;
    let matchViewsCount = 0;
    let totalAll = 0;

    schemas.forEach((s) => {
      totalAll += s.tables.length + (s.views?.length || 0);
    });

    if (!term && filterType === 'all') {
      const allTables = schemas.reduce((acc, s) => acc + s.tables.length, 0);
      const allViews = schemas.reduce((acc, s) => acc + (s.views?.length || 0), 0);
      return {
        filteredSchemas: schemas,
        totalMatchingTables: allTables,
        totalMatchingViews: allViews,
        hasAnyMatches: allTables > 0 || allViews > 0,
        totalUnfilteredCount: totalAll,
      };
    }

    const filtered = schemas
      .map((schema) => {
        const schemaNameMatches = term ? schema.name.toLowerCase().includes(term) : true;

        const matchingTables = (filterType === 'views' ? [] : schema.tables).filter(
          (t) =>
            !term ||
            t.name.toLowerCase().includes(term) ||
            t.columns.some((c) => c.name.toLowerCase().includes(term))
        );

        const matchingViews = (filterType === 'tables' ? [] : (schema.views || [])).filter(
          (v) => !term || v.name.toLowerCase().includes(term)
        );

        const matchingTriggers = (term ? (schema.triggers || []).filter((tr) => tr.name.toLowerCase().includes(term)) : (schema.triggers || []));
        const matchingProcedures = (term ? (schema.procedures || []).filter((p) => p.name.toLowerCase().includes(term)) : (schema.procedures || []));

        matchTablesCount += matchingTables.length;
        matchViewsCount += matchingViews.length;

        if (schemaNameMatches && !term) {
          return {
            ...schema,
            tables: matchingTables,
            views: matchingViews,
            triggers: matchingTriggers,
            procedures: matchingProcedures,
          };
        }

        return {
          ...schema,
          tables: matchingTables,
          views: matchingViews,
          triggers: matchingTriggers,
          procedures: matchingProcedures,
        };
      })
      .filter(
        (schema) =>
          schema.tables.length > 0 ||
          schema.views.length > 0 ||
          schema.triggers.length > 0 ||
          schema.procedures.length > 0
      );

    return {
      filteredSchemas: filtered,
      totalMatchingTables: matchTablesCount,
      totalMatchingViews: matchViewsCount,
      hasAnyMatches: filtered.length > 0,
      totalUnfilteredCount: totalAll,
    };
  }, [schemas, searchTerm, filterType]);

  const isFilteringActive = searchTerm.trim().length > 0 || filterType !== 'all';

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
              className="p-1 hover:bg-[#2D3139] text-[#94A3B8] hover:text-white rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRefreshSchema}
              title="Refresh Schema"
              className="p-1 hover:bg-[#2D3139] text-[#94A3B8] hover:text-white rounded transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Search Input Bar */}
        <div className="space-y-1.5">
          <div className="relative flex items-center">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 pointer-events-none transition-colors ${searchTerm ? 'text-blue-400' : 'text-[#64748B]'}`} />
            <input
              type="text"
              id="treeview-search-input"
              placeholder="Search tables, views..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchTerm('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full bg-[#0F1115] border border-[#2D3139] rounded text-xs text-[#E2E8F0] pl-8 pr-7 py-1.5 focus:outline-none focus:border-blue-500 font-mono transition-colors placeholder:text-[#64748B]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                title="Clear search (Esc)"
                className="absolute right-2 p-0.5 text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#2D3139] rounded cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Type Pills and Match Indicator */}
          <div className="flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  filterType === 'all'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('tables')}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  filterType === 'tables'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Tables
              </button>
              <button
                onClick={() => setFilterType('views')}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  filterType === 'views'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Views
              </button>
            </div>

            {isFilteringActive && (
              <span className="text-[#94A3B8] truncate">
                {totalMatchingTables + totalMatchingViews} match{totalMatchingTables + totalMatchingViews === 1 ? '' : 'es'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Active Connection Banner */}
      {activeConnection && (
        <div className="px-3 py-1.5 bg-[#0F1115] border-b border-[#2D3139] flex items-center justify-between text-xs">
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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-xs space-y-1">
        {filteredSchemas.length === 0 && isFilteringActive ? (
          <div className="py-8 px-3 text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-[#2D3139] flex items-center justify-center mx-auto text-[#94A3B8]">
              <Search className="w-4 h-4" />
            </div>
            <p className="text-xs text-[#E2E8F0] font-medium">No results found</p>
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              No tables or views match <span className="text-amber-300 font-semibold">"{searchTerm}"</span>
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
              }}
              className="mt-2 px-2.5 py-1 bg-[#2D3139] hover:bg-[#3E4451] text-[#E2E8F0] rounded text-[11px] font-sans transition-colors cursor-pointer"
            >
              Clear filter
            </button>
          </div>
        ) : (
          filteredSchemas.map((schema) => {
            const schemaId = `schema-${schema.name}`;
            const isSchemaExpanded = isFilteringActive ? true : (expandedNodes[schemaId] ?? true);

            return (
              <div key={schema.name} className="text-xs">
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
                  <span className="truncate">{renderHighlightedText(schema.name, searchTerm)}</span>
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
                    {schema.tables.length > 0 && (
                      <div>
                        <div
                          onClick={(e) => toggleNode(`cat-${schema.name}-tables`, e)}
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] font-mono text-[11px]"
                        >
                          {(isFilteringActive || expandedNodes[`cat-${schema.name}-tables`]) ? (
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

                        {(isFilteringActive || expandedNodes[`cat-${schema.name}-tables`]) && (
                          <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                            {schema.tables.map((table) => {
                              const tableId = `tbl-${schema.name}-${table.name}`;
                              const term = searchTerm.trim().toLowerCase();
                              const hasMatchingColumns = term && !table.name.toLowerCase().includes(term) &&
                                table.columns.some((c) => c.name.toLowerCase().includes(term));
                              const isTableExpanded = expandedNodes[tableId] || (isFilteringActive && hasMatchingColumns);

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
                                      {renderHighlightedText(table.name, searchTerm)}
                                    </span>
                                    {onOpenQueryBuilder && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenQueryBuilder(schema.name, table.name);
                                        }}
                                        title="Open in Visual Query Builder"
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-900/60 text-blue-400 rounded transition-opacity cursor-pointer"
                                      >
                                        <Boxes className="w-3 h-3" />
                                      </button>
                                    )}
                                    <span className="text-[10px] text-[#64748B] font-mono ml-auto">
                                      {table.rowCount}
                                    </span>
                                  </div>

                                  {/* Table Columns Expandable */}
                                  {isTableExpanded && (
                                    <div className="ml-4 pl-2 border-l border-[#2D3139]/60 space-y-0.5 my-0.5">
                                      {table.columns.map((col) => {
                                        const isColMatch = term && col.name.toLowerCase().includes(term);
                                        return (
                                          <div
                                            key={col.name}
                                            className={`flex items-center space-x-1.5 px-2 py-0.5 text-[11px] font-mono rounded ${
                                              isColMatch
                                                ? 'bg-amber-500/10 text-amber-200'
                                                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                                            }`}
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
                                            <span className="truncate">
                                              {renderHighlightedText(col.name, searchTerm)}
                                            </span>
                                            <span className="text-[9px] text-[#64748B] ml-auto font-mono truncate">
                                              {col.type}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* VIEWS CATEGORY */}
                    {schema.views.length > 0 && (
                      <div>
                        <div
                          onClick={(e) => toggleNode(`cat-${schema.name}-views`, e)}
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] font-mono text-[11px]"
                        >
                          {(isFilteringActive || expandedNodes[`cat-${schema.name}-views`]) ? (
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

                        {(isFilteringActive || expandedNodes[`cat-${schema.name}-views`]) && (
                          <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                            {schema.views.map((view) => (
                              <div
                                key={view.name}
                                onDoubleClick={() => onSelectTable(schema.name, view.name)}
                                onContextMenu={(e) =>
                                  handleRightClick(e, 'view', schema.name, view.name, view)
                                }
                                className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono text-xs group"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate group-hover:text-white">
                                  {renderHighlightedText(view.name, searchTerm)}
                                </span>
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
                          {(isFilteringActive || expandedNodes[`cat-${schema.name}-triggers`]) ? (
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

                        {(isFilteringActive || expandedNodes[`cat-${schema.name}-triggers`]) && (
                          <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                            {schema.triggers.map((trg) => (
                              <div
                                key={trg.name}
                                onContextMenu={(e) =>
                                  handleRightClick(e, 'trigger', schema.name, trg.name, trg)
                                }
                                className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono text-xs group"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate group-hover:text-white">
                                  {renderHighlightedText(trg.name, searchTerm)}
                                </span>
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
                          {(isFilteringActive || expandedNodes[`cat-${schema.name}-procedures`]) ? (
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

                        {(isFilteringActive || expandedNodes[`cat-${schema.name}-procedures`]) && (
                          <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
                            {schema.procedures.map((proc) => (
                              <div
                                key={proc.name}
                                onContextMenu={(e) =>
                                  handleRightClick(e, 'procedure', schema.name, proc.name, proc)
                                }
                                className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] font-mono text-xs group"
                              >
                                <Code className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate group-hover:text-white">
                                  {renderHighlightedText(proc.name, searchTerm)}()
                                </span>
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
          })
        )}
      </div>

      {/* Bookmarks & Saved Snippets Footer Drawer */}
      <div className="p-2 border-t border-[#2D3139] bg-[#0F1115] text-xs">
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
