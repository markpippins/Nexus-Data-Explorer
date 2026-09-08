import React, { useEffect, useRef } from 'react';
import {
  Play,
  PlusCircle,
  Edit,
  Trash2,
  Eye,
  Info,
  Layers,
  Code,
  Boxes,
  Target,
  GitCompare,
} from 'lucide-react';
import { ContextMenuState } from '../../types/database';

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onGenerateQuery: (
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE' | 'DDL',
    schemaName: string,
    objectData: any,
    databaseName?: string
  ) => void;
  onViewDataGrid: (schemaName: string, tableName: string, databaseName?: string) => void;
  onDropObject: (type: string, schemaName: string, objectName: string, databaseName?: string) => void;
  onViewProperties: (schemaName: string, objectName: string, objectData: any, databaseName?: string) => void;
  onOpenEavStudio?: (schemaName: string) => void;
  onOpenQueryBuilder?: (schemaName?: string, tableName?: string, databaseName?: string) => void;
  onSetActiveSchema?: (schemaName: string) => void;
  isActiveSchema?: boolean;
  onCompareSchemas?: (left: string) => void;
  onGenerateSchemaDDL?: (schemaName: string, databaseName?: string) => void;
  onGenerateDatabaseDDL?: (databaseName: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  onClose,
  onGenerateQuery,
  onViewDataGrid,
  onDropObject,
  onViewProperties,
  onOpenEavStudio,
  onOpenQueryBuilder,
  onSetActiveSchema,
  isActiveSchema,
  onCompareSchemas,
  onGenerateSchemaDDL,
  onGenerateDatabaseDDL,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!state.visible) return null;

  const { type, schemaName = 'public', objectName = '', objectData } = state;
  const databaseName = state.databaseName;
  const generateDDL = () => {
    onGenerateQuery('DDL', schemaName, { ...objectData, __objectType: type }, databaseName);
    onClose();
  };

  const actionClass = 'w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors';
  const ddlClass = 'w-full px-3 py-1.5 text-left hover:bg-indigo-950/60 flex items-center space-x-2 text-indigo-300 font-medium transition-colors';

  return (
    <div
      ref={menuRef}
      style={{ top: `${state.y}px`, left: `${state.x}px` }}
      className="fixed z-50 w-60 bg-[#1F232B] border border-[#3B414D] rounded-lg shadow-2xl py-1.5 text-[#E2E8F0] text-sm font-sans animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#94A3B8] border-b border-[#2D3139] flex items-center justify-between">
        <span className="truncate">{objectName || schemaName}</span>
        <span className="px-1 py-0.2 text-[9px] bg-[#2D3139] text-blue-400 rounded">{type.toUpperCase()}</span>
      </div>

      {type === 'table' && (
        <>
          <button onClick={() => { onViewDataGrid(schemaName, objectName, databaseName); onClose(); }} className={`${actionClass} font-medium`}>
            <Eye className="w-3.5 h-3.5 text-blue-400" /><span>View Data Grid (Double Click)</span>
          </button>
          <button onClick={() => { onOpenQueryBuilder?.(schemaName, objectName, databaseName); onClose(); }} className={`${actionClass} text-blue-300 font-medium`}>
            <Boxes className="w-3.5 h-3.5 text-blue-400" /><span>Visual Query Builder</span>
          </button>
          <button onClick={() => { onGenerateQuery('SELECT', schemaName, objectData, databaseName); onClose(); }} className={actionClass}>
            <Play className="w-3.5 h-3.5 text-emerald-400" /><span>Generate SELECT Statement</span>
          </button>
          <button onClick={() => { onGenerateQuery('INSERT', schemaName, objectData, databaseName); onClose(); }} className={actionClass}>
            <PlusCircle className="w-3.5 h-3.5 text-blue-400" /><span>Generate INSERT Statement</span>
          </button>
          <button onClick={() => { onGenerateQuery('UPDATE', schemaName, objectData, databaseName); onClose(); }} className={actionClass}>
            <Edit className="w-3.5 h-3.5 text-amber-400" /><span>Generate UPDATE Statement</span>
          </button>
          <button onClick={() => { onGenerateQuery('DELETE', schemaName, objectData, databaseName); onClose(); }} className={`${actionClass} text-rose-300`}>
            <Trash2 className="w-3.5 h-3.5 text-rose-400" /><span>Generate DELETE Statement</span>
          </button>
          <div className="my-1 border-t border-[#2D3139]" />
          <button onClick={generateDDL} className={ddlClass}>
            <Code className="w-3.5 h-3.5 text-indigo-400" /><span>Generate CREATE TABLE in New Query Tab</span>
          </button>
          <button onClick={() => { onViewProperties(schemaName, objectName, objectData, databaseName); onClose(); }} className={actionClass}>
            <Info className="w-3.5 h-3.5 text-[#94A3B8]" /><span>Inspect Table Structure &amp; Indexes</span>
          </button>
          <div className="my-1 border-t border-[#2D3139]" />
          <button onClick={() => { onDropObject('TABLE', schemaName, objectName, databaseName); onClose(); }} className={`${actionClass} text-rose-400 font-medium hover:bg-rose-950/50`}>
            <Trash2 className="w-3.5 h-3.5" /><span>Drop Table</span>
          </button>
        </>
      )}

      {type === 'view' && (
        <>
          <button onClick={() => { onViewDataGrid(schemaName, objectName, databaseName); onClose(); }} className={actionClass}>
            <Eye className="w-3.5 h-3.5 text-blue-400" /><span>View Data Grid</span>
          </button>
          <button onClick={generateDDL} className={ddlClass}>
            <Code className="w-3.5 h-3.5 text-indigo-400" /><span>Generate View DDL in New Query Tab</span>
          </button>
          <button onClick={() => { onViewProperties(schemaName, objectName, objectData, databaseName); onClose(); }} className={actionClass}>
            <Info className="w-3.5 h-3.5 text-[#94A3B8]" /><span>Inspect View Definition</span>
          </button>
          <div className="my-1 border-t border-[#2D3139]" />
          <button onClick={() => { onDropObject('VIEW', schemaName, objectName, databaseName); onClose(); }} className={`${actionClass} text-rose-400 font-medium hover:bg-rose-950/50`}>
            <Trash2 className="w-3.5 h-3.5" /><span>Drop View</span>
          </button>
        </>
      )}

      {(type === 'trigger' || type === 'procedure') && (
        <>
          <button onClick={generateDDL} className={ddlClass}>
            <Code className="w-3.5 h-3.5 text-indigo-400" /><span>Generate DDL in New Query Tab</span>
          </button>
          <button onClick={() => { onViewProperties(schemaName, objectName, objectData, databaseName); onClose(); }} className={actionClass}>
            <Info className="w-3.5 h-3.5 text-[#94A3B8]" /><span>View {type === 'trigger' ? 'Trigger' : 'Procedure'} Definition</span>
          </button>
        </>
      )}

      {type === 'schema' && (
        <>
          {onSetActiveSchema && !isActiveSchema && <button onClick={() => { onSetActiveSchema(schemaName); onClose(); }} className={`${actionClass} text-blue-300 font-medium`}>
            <Target className="w-3.5 h-3.5 text-blue-400" /><span>Set Active Schema</span>
          </button>}
          {onCompareSchemas && <button onClick={() => { onCompareSchemas(schemaName); onClose(); }} className={`${actionClass} text-purple-300 font-medium`}>
            <GitCompare className="w-3.5 h-3.5 text-purple-400" /><span>Compare with Another Schema…</span>
          </button>}
          {onGenerateSchemaDDL && <button onClick={() => { onGenerateSchemaDDL(schemaName, databaseName); onClose(); }} className={ddlClass}>
            <Code className="w-3.5 h-3.5 text-indigo-400" /><span>Generate Schema DDL in New Query Tab</span>
          </button>}
          <button onClick={() => { onOpenEavStudio?.(schemaName); onClose(); }} className={`${actionClass} text-purple-300 font-medium`}>
            <Layers className="w-3.5 h-3.5 text-purple-400" /><span>Open EAV Object Store Studio</span>
          </button>
        </>
      )}

      {type === 'connection' && state.databaseName && (
        <>
          {onGenerateDatabaseDDL && <button onClick={() => { onGenerateDatabaseDDL(state.databaseName!); onClose(); }} className={ddlClass}>
            <Code className="w-3.5 h-3.5 text-indigo-400" /><span>Generate Database DDL in New Query Tab</span>
          </button>}
        </>
      )}
    </div>
  );
};
