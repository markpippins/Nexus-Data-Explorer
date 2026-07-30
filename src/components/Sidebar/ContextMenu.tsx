import React, { useEffect, useRef } from 'react';
import {
  FileText,
  Play,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Info,
  Copy,
  Layers,
  Code
} from 'lucide-react';
import { ContextMenuState } from '../../types/database';

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onGenerateQuery: (
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE',
    schemaName: string,
    objectData: any
  ) => void;
  onViewDataGrid: (schemaName: string, tableName: string) => void;
  onDropObject: (type: string, schemaName: string, objectName: string) => void;
  onViewProperties: (schemaName: string, objectName: string, objectData: any) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  onClose,
  onGenerateQuery,
  onViewDataGrid,
  onDropObject,
  onViewProperties,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
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

  return (
    <div
      ref={menuRef}
      style={{ top: `${state.y}px`, left: `${state.x}px` }}
      className="fixed z-50 w-56 bg-[#1F232B] border border-[#3B414D] rounded-lg shadow-2xl py-1.5 text-[#E2E8F0] text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#94A3B8] border-b border-[#2D3139] flex items-center justify-between">
        <span className="truncate">{objectName || schemaName}</span>
        <span className="px-1 py-0.2 text-[9px] bg-[#2D3139] text-blue-400 rounded">
          {type.toUpperCase()}
        </span>
      </div>

      {type === 'table' && (
        <>
          <button
            onClick={() => {
              onViewDataGrid(schemaName, objectName);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] font-medium transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>View Data Grid (Double Click)</span>
          </button>

          <button
            onClick={() => {
              onGenerateQuery('SELECT', schemaName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Generate SELECT Statement</span>
          </button>

          <button
            onClick={() => {
              onGenerateQuery('INSERT', schemaName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>Generate INSERT Statement</span>
          </button>

          <button
            onClick={() => {
              onGenerateQuery('UPDATE', schemaName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Edit className="w-3.5 h-3.5 text-amber-400" />
            <span>Generate UPDATE Statement</span>
          </button>

          <button
            onClick={() => {
              onGenerateQuery('DELETE', schemaName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-rose-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Generate DELETE Statement</span>
          </button>

          <div className="my-1 border-t border-[#2D3139]" />

          <button
            onClick={() => {
              onGenerateQuery('CREATE_TABLE', schemaName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span>Show CREATE TABLE DDL</span>
          </button>

          <button
            onClick={() => {
              onViewProperties(schemaName, objectName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>Inspect Table Structure & Indexes</span>
          </button>

          <div className="my-1 border-t border-[#2D3139]" />

          <button
            onClick={() => {
              onDropObject('TABLE', schemaName, objectName);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-950/50 hover:text-rose-300 flex items-center space-x-2 text-rose-400 font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Drop Table</span>
          </button>
        </>
      )}

      {type === 'view' && (
        <>
          <button
            onClick={() => {
              onViewDataGrid(schemaName, objectName);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>View Data Grid</span>
          </button>

          <button
            onClick={() => {
              onViewProperties(schemaName, objectName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span>Show View DDL Definition</span>
          </button>

          <div className="my-1 border-t border-[#2D3139]" />

          <button
            onClick={() => {
              onDropObject('VIEW', schemaName, objectName);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-950/50 flex items-center space-x-2 text-rose-400 font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Drop View</span>
          </button>
        </>
      )}

      {(type === 'trigger' || type === 'procedure') && (
        <>
          <button
            onClick={() => {
              onViewProperties(schemaName, objectName, objectData);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] flex items-center space-x-2 text-[#E2E8F0] transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span>View Function Definition</span>
          </button>
        </>
      )}
    </div>
  );
};
