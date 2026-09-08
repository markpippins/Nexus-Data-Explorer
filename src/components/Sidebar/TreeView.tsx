import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Plus,
  RefreshCw,
  Folder,
  FolderOpen,
  X,
  Boxes,
  Target,
  GitCompare,
  Loader2,
} from 'lucide-react';
import {
  DBConnection,
  DatabaseNode,
  SchemaObject,
  SavedQuery,
  ContextMenuState,
} from '../../types/database';

interface TreeViewProps {
  activeConnection: DBConnection | null;
  databases?: DatabaseNode[];
  activeDatabase?: string | null;
  databaseLoading?: boolean;
  onSelectDatabase?: (databaseName: string) => void;
  schemas: SchemaObject[];
  savedQueries: SavedQuery[];
  history: string[];
  onContextMenu: (state: ContextMenuState) => void;
  onSelectTable: (schemaName: string, tableName: string, databaseName?: string) => void;
  onOpenSavedQuery: (query: SavedQuery) => void;
  onOpenHistoryQuery: (queryStr: string) => void;
  onOpenNewConnectionModal: () => void;
  onOpenNewTableModal: () => void;
  onRefreshSchema: () => void;
  onOpenEavStudio?: (schemaName?: string) => void;
  onOpenQueryBuilder?: (schemaName?: string, tableName?: string, databaseName?: string) => void;
  activeSchema?: string | null;
  onSetActiveSchema?: (schemaName: string) => void;
  onCompareSchemas?: (left: string, right?: string) => void;
  width?: number;
  onResize?: (width: number) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  activeConnection,
  databases = [],
  activeDatabase,
  databaseLoading = false,
  onSelectDatabase,
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
  activeSchema,
  onSetActiveSchema,
  onCompareSchemas,
  width,
  onResize,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tables' | 'views'>('all');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, startWidth: 0 });

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDatabaseClick = (databaseName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNode(`database-${databaseName}`);
    if (databaseName !== activeDatabase) onSelectDatabase?.(databaseName);
  };

  // Expanding a schema reveals exactly one more level: its Tables/Views/
  // Triggers/Procedures categories (categories auto-open so the tables are
  // visible immediately; collapsing hides them again). Categories remain
  // individually toggleable afterwards.
  const handleSchemaClick = (schemaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const opening = !prev[schemaId];
      return {
        ...prev,
        [schemaId]: opening,
        [`${schemaId}-tables`]: opening,
        [`${schemaId}-views`]: opening,
        [`${schemaId}-triggers`]: opening,
        [`${schemaId}-procedures`]: opening,
      };
    });
  };

  const handleRightClick = (
    e: React.MouseEvent,
    type: ContextMenuState['type'],
    schemaName?: string,
    objectName?: string,
    objectData?: any,
    databaseName?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      connectionId: activeConnection?.id,
      databaseName,
      schemaName,
      objectName,
      objectData,
    });
  };

  const highlight = (text: string) => {
    const term = searchTerm.trim();
    if (!term) return text;
    const index = text.toLowerCase().indexOf(term.toLowerCase());
    if (index < 0) return text;
    return <>{text.slice(0, index)}<span className="bg-amber-500/30 text-amber-200 font-semibold px-0.5 rounded">{text.slice(index, index + term.length)}</span>{text.slice(index + term.length)}</>;
  };

  const filteredSchemas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return schemas.map((schema) => ({
      ...schema,
      tables: filterType === 'views' ? [] : schema.tables.filter((table) => !term || schema.name.toLowerCase().includes(term) || table.name.toLowerCase().includes(term) || table.columns.some((column) => column.name.toLowerCase().includes(term))),
      views: filterType === 'tables' ? [] : (schema.views || []).filter((view) => !term || schema.name.toLowerCase().includes(term) || view.name.toLowerCase().includes(term)),
      triggers: (schema.triggers || []).filter((trigger) => !term || schema.name.toLowerCase().includes(term) || trigger.name.toLowerCase().includes(term)),
      procedures: (schema.procedures || []).filter((procedure) => !term || schema.name.toLowerCase().includes(term) || procedure.name.toLowerCase().includes(term)),
    })).filter((schema) => !term || schema.tables.length > 0 || schema.views.length > 0 || schema.triggers.length > 0 || schema.procedures.length > 0);
  }, [schemas, searchTerm, filterType]);

  const beginResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { x: e.clientX, startWidth: width ?? 256 };
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.min(560, Math.max(200, resizeStartRef.current.startWidth + e.clientX - resizeStartRef.current.x));
      onResize?.(next);
    };
    const onUp = () => setResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizing, onResize]);

  const renderSchema = (schema: SchemaObject, databaseName: string) => {
    const schemaId = `schema-${databaseName}-${schema.name}`;
    const schemaExpanded = searchTerm.trim() ? true : (expandedNodes[schemaId] ?? false);
    const isActive = activeSchema === schema.name && activeDatabase === databaseName;
    const isDefault = activeConnection?.database === databaseName && activeConnection.defaultSchema === schema.name;
    const renderCategory = (kind: 'tables' | 'views' | 'triggers' | 'procedures', label: string, icon: React.ReactNode, items: any[]) => {
      if (!items.length) return null;
      const id = `${schemaId}-${kind}`;
      const expanded = searchTerm.trim() ? true : (expandedNodes[id] ?? false);
      return <div>
        <div onClick={(e) => toggleNode(id, e)} className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139]/60 cursor-pointer text-[#94A3B8] text-[11px]">
          {expanded ? <ChevronDown className="w-3 h-3 text-[#64748B]" /> : <ChevronRight className="w-3 h-3 text-[#64748B]" />}
          {icon}<span>{label}</span><span className="text-[10px] text-[#64748B] ml-auto">{items.length}</span>
        </div>
        {expanded && <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-0.5 my-0.5">
          {items.map((item) => {
            const objectName = item.name;
            const isTable = kind === 'tables';
            const itemId = `${id}-${objectName}`;
            const itemExpanded = isTable && (expandedNodes[itemId] || (!!searchTerm && item.columns.some((column: any) => column.name.toLowerCase().includes(searchTerm.toLowerCase()))));
            return <div key={objectName}>
              <div
                onClick={(e) => isTable ? toggleNode(itemId, e) : undefined}
                onDoubleClick={() => isTable && onSelectTable(schema.name, objectName, databaseName)}
                onContextMenu={(e) => handleRightClick(e, kind === 'tables' ? 'table' : kind === 'views' ? 'view' : kind === 'triggers' ? 'trigger' : 'procedure', schema.name, objectName, item, databaseName)}
                className="flex items-center space-x-1.5 px-2 py-0.5 rounded hover:bg-[#2D3139] cursor-pointer text-[#E2E8F0] text-xs group"
              >
                {isTable && (itemExpanded ? <ChevronDown className="w-3 h-3 text-[#64748B]" /> : <ChevronRight className="w-3 h-3 text-[#64748B]" />)}
                {kind === 'tables' ? <TableIcon className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-cyan-300 shrink-0" /> : icon}
                <span className="truncate group-hover:text-white">{highlight(objectName)}{kind === 'procedures' ? '()' : ''}</span>
                {isTable && onOpenQueryBuilder && <button onClick={(e) => { e.stopPropagation(); onOpenQueryBuilder(schema.name, objectName); }} title="Open in Visual Query Builder" className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-400 rounded shrink-0"><Boxes className="w-3 h-3" /></button>}
                {isTable && <span className="text-[10px] text-[#64748B] ml-auto">{item.rowCount}</span>}
              </div>
              {itemExpanded && isTable && <div className="ml-4 pl-2 border-l border-[#2D3139]/60 space-y-0.5">
                {item.columns.map((column: any) => <div key={column.name} className="flex items-center space-x-1.5 px-2 py-0.5 text-[11px] text-[#94A3B8] rounded">
                  {column.isPrimaryKey || column.isForeignKey ? <Key className={`w-3 h-3 shrink-0 ${column.isPrimaryKey ? 'text-amber-400' : 'text-blue-400'}`} /> : <span className="w-3 h-3 rounded bg-[#2D3139] text-[9px] flex items-center justify-center">#</span>}
                  <span className="truncate">{highlight(column.name)}</span><span className="text-[9px] text-[#64748B] ml-auto truncate">{column.type}</span>
                </div>)}
              </div>}
            </div>;
          })}
        </div>}
      </div>;
    };

    return <div key={`${databaseName}-${schema.name}`} className="text-xs">
      <div onClick={(e) => handleSchemaClick(schemaId, e)} onContextMenu={(e) => handleRightClick(e, 'schema', schema.name, undefined, undefined, databaseName)} className={`flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer font-medium group ${isActive ? 'bg-blue-950/50 border border-blue-600/40 text-[#E2E8F0]' : 'hover:bg-[#2D3139] text-[#E2E8F0]'}`}>
        {schemaExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />}
        {schemaExpanded ? <FolderOpen className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-amber-400'}`} /> : <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-amber-400'}`} />}
        <span className="truncate">{highlight(schema.name)}</span>
        {isActive && <span className="px-1.5 py-0.2 text-[9px] bg-blue-600/30 text-blue-300 border border-blue-500/50 rounded font-semibold">ACTIVE</span>}
        {isDefault && !isActive && <span className="px-1.5 py-0.2 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">default</span>}
        {(schema.category === 'shrapnel' || schema.name === 'shrapnel') && <button onClick={(e) => { e.stopPropagation(); onOpenEavStudio?.(schema.name); }} className="px-1.5 py-0.2 text-[9px] bg-purple-950/80 text-purple-300 border border-purple-700/50 rounded font-semibold">shrapnel</button>}
        {onSetActiveSchema && !isActive && <button onClick={(e) => { e.stopPropagation(); onSetActiveSchema(schema.name); }} title="Set active schema" className="opacity-0 group-hover:opacity-100 p-0.5 text-blue-400 rounded shrink-0"><Target className="w-3 h-3" /></button>}
        {onCompareSchemas && <button onClick={(e) => { e.stopPropagation(); onCompareSchemas(schema.name); }} title="Compare schema" className="opacity-0 group-hover:opacity-100 p-0.5 text-purple-400 rounded shrink-0"><GitCompare className="w-3 h-3" /></button>}
        <span className="text-[10px] text-[#64748B] ml-auto">({schema.tables.length})</span>
      </div>
      {schemaExpanded && <div className="ml-3 pl-2 border-l border-[#2D3139] space-y-1 my-0.5">
        {renderCategory('tables', 'Tables', <TableIcon className="w-3.5 h-3.5 text-cyan-400" />, schema.tables)}
        {renderCategory('views', 'Views', <Eye className="w-3.5 h-3.5 text-indigo-400" />, schema.views || [])}
        {renderCategory('triggers', 'Triggers', <Zap className="w-3.5 h-3.5 text-amber-400" />, schema.triggers || [])}
        {renderCategory('procedures', 'Procedures', <Code className="w-3.5 h-3.5 text-emerald-400" />, schema.procedures || [])}
      </div>}
    </div>;
  };

  return <aside style={{ width: `${width ?? 256}px` }} className={`bg-[#181A1F] border-r border-[#2D3139] flex flex-col h-full select-none text-[#E2E8F0] font-sans shrink-0 relative ${resizing ? 'cursor-col-resize' : ''}`}>
    <div onMouseDown={beginResize} title="Drag to resize" className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-10 ${resizing ? 'bg-blue-500/60' : 'hover:bg-blue-500/40'}`} />
    <div className="p-3 border-b border-[#2D3139] space-y-2">
      <div className="flex items-center justify-between"><span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#94A3B8] flex items-center space-x-1.5"><Database className="w-3.5 h-3.5 text-blue-400" /><span>Database Explorer</span></span><div className="flex items-center space-x-1"><button onClick={onOpenNewTableModal} title="New Table DDL" className="p-1 hover:bg-[#2D3139] text-[#94A3B8] rounded"><Plus className="w-3.5 h-3.5" /></button><button onClick={onRefreshSchema} title="Refresh database" className="p-1 hover:bg-[#2D3139] text-[#94A3B8] rounded"><RefreshCw className="w-3.5 h-3.5" /></button></div></div>
      <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#64748B]" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setSearchTerm('')} placeholder="Search schemas, tables, views..." className="w-full bg-[#0F1115] border border-[#2D3139] rounded text-xs pl-8 pr-7 py-1.5 focus:outline-none focus:border-blue-500 placeholder:text-[#64748B]" />{searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1.5 text-[#64748B]"><X className="w-3.5 h-3.5" /></button>}</div>
      <div className="flex items-center space-x-1 text-[10px] font-mono"><button onClick={() => setFilterType('all')} className={`px-1.5 py-0.5 rounded ${filterType === 'all' ? 'bg-blue-600/30 text-blue-300' : 'text-[#94A3B8]'}`}>All</button><button onClick={() => setFilterType('tables')} className={`px-1.5 py-0.5 rounded ${filterType === 'tables' ? 'bg-blue-600/30 text-blue-300' : 'text-[#94A3B8]'}`}>Tables</button><button onClick={() => setFilterType('views')} className={`px-1.5 py-0.5 rounded ${filterType === 'views' ? 'bg-blue-600/30 text-blue-300' : 'text-[#94A3B8]'}`}>Views</button></div>
    </div>
    {activeConnection && <div className="px-3 py-1.5 bg-[#0F1115] border-b border-[#2D3139] flex items-center justify-between text-xs"><div className="flex items-center space-x-2 truncate"><div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeConnection.color }} /><span className="font-mono text-[11px] truncate">{activeConnection.name}</span>{activeDatabase && <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 rounded truncate">{activeDatabase}</span>}{activeSchema && <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded truncate">{activeSchema}</span>}</div><span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">{activeConnection.engine}</span></div>}
    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-xs space-y-1">
      {databaseLoading && <div className="flex items-center justify-center space-x-2 py-4 text-[#94A3B8] text-[11px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Loading database catalog…</span></div>}
      {!databaseLoading && databases.length === 0 && <div className="py-8 px-3 text-center text-[#64748B] text-[11px]">No databases discovered.</div>}
      {!databaseLoading && databases.map((database) => {
        const databaseId = `database-${database.name}`;
        const expanded = expandedNodes[databaseId] ?? false;
        const isActiveDatabase = database.name === activeDatabase;
        const visibleSchemas = isActiveDatabase ? filteredSchemas : (database.schemas || []);
        return <div key={database.name}>
          <div onClick={(e) => handleDatabaseClick(database.name, e)} onContextMenu={(e) => handleRightClick(e, 'connection', undefined, undefined, undefined, database.name)} className={`flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer font-semibold ${isActiveDatabase ? 'bg-cyan-950/40 border border-cyan-700/40 text-cyan-100' : 'hover:bg-[#2D3139] text-[#E2E8F0]'}`}>
            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />}
            <Database className={`w-3.5 h-3.5 ${isActiveDatabase ? 'text-cyan-300' : 'text-blue-400'}`} /><span className="truncate">{database.name}</span>
            {database.isTemplate && <span className="text-[9px] text-[#64748B]">template</span>}
            {database.error && <span title={database.error} className="text-rose-400">!</span>}
            {database.schemasLoaded && <span className="text-[10px] text-[#64748B] ml-auto">{visibleSchemas.length} schemas</span>}
          </div>
          {expanded && <div className="ml-3 pl-2 border-l border-cyan-900/40 space-y-1 my-0.5">
            {isActiveDatabase && visibleSchemas.length === 0 && <div className="px-2 py-2 text-[11px] text-[#64748B]">{searchTerm ? 'No matching objects.' : 'No schemas found.'}</div>}
            {visibleSchemas.map((schema) => renderSchema(schema, database.name))}
          </div>}
        </div>;
      })}
    </div>
    <div className="p-2 border-t border-[#2D3139] bg-[#0F1115] text-xs"><div onClick={(e) => toggleNode('drawer-saved', e)} className="flex items-center justify-between font-mono text-[#94A3B8] cursor-pointer p-1 rounded hover:bg-[#181A1F]"><div className="flex items-center space-x-1.5"><Bookmark className="w-3.5 h-3.5 text-amber-400" /><span className="font-semibold text-[11px]">Saved Snippets</span></div><span className="text-[10px]">({savedQueries.length})</span></div>{expandedNodes['drawer-saved'] && <div className="mt-1 space-y-1 max-h-28 overflow-y-auto"><>{savedQueries.map((query) => <div key={query.id} onClick={() => onOpenSavedQuery(query)} className="p-1.5 bg-[#181A1F] hover:bg-[#2D3139] rounded cursor-pointer truncate text-[11px] flex items-center justify-between"><span className="truncate">{query.title}</span><ChevronRight className="w-3 h-3 text-[#64748B]" /></div>)}</></div>}</div>
  </aside>;
};
