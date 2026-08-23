import React from 'react';
import {
  Database,
  Plus,
  Sparkles,
  Network,
  AlignLeft,
  HelpCircle,
  Play,
  RefreshCw,
  Layers,
  Terminal,
  Zap,
  CheckCircle2,
  Moon,
  Sun,
  Palette,
  Boxes,
  GitCompare
} from 'lucide-react';
import { DBConnection } from '../types/database';

interface HeaderProps {
  connections: DBConnection[];
  activeConnection: DBConnection | null;
  onSelectConnection: (conn: DBConnection) => void;
  onOpenNewConnectionModal: () => void;
  onOpenNewTableModal: () => void;
  onOpenAiAssistant: () => void;
  onOpenShortcutsModal: () => void;
  onOpenErdView: () => void;
  onOpenEavStudio: () => void;
  onOpenQueryBuilder: () => void;
  onOpenDiffViewer?: () => void;
  onRunCurrentQuery: () => void;
  onFormatCurrentQuery: () => void;
  onRefreshSchema: () => void;
  activeTabType: 'editor' | 'table-viewer' | 'erd' | 'eav-studio' | 'query-builder' | 'diff-viewer';
  theme?: 'dark' | 'light' | 'steel';
  onChangeTheme?: (theme: 'dark' | 'light' | 'steel') => void;
}

export const Header: React.FC<HeaderProps> = ({
  connections,
  activeConnection,
  onSelectConnection,
  onOpenNewConnectionModal,
  onOpenNewTableModal,
  onOpenAiAssistant,
  onOpenShortcutsModal,
  onOpenErdView,
  onOpenEavStudio,
  onOpenQueryBuilder,
  onOpenDiffViewer,
  onRunCurrentQuery,
  onFormatCurrentQuery,
  onRefreshSchema,
  activeTabType,
  theme = 'dark',
  onChangeTheme,
}) => {
  return (
    <header className="h-10 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between text-[#E2E8F0] select-none shrink-0">
      {/* Left: Branding & Connection Picker */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-xs font-bold tracking-tight uppercase text-white">
            FluxDB <span className="font-normal opacity-50 text-[#94A3B8]">Workbench</span>
          </span>
        </div>

        <div className="h-4 w-px bg-[#2D3139] mx-1" />

        {/* Active Connection Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-[11px] text-[#94A3B8] font-medium hidden sm:inline">Connected:</label>
          <div className="relative flex items-center">
            <select
              value={activeConnection?.id || ''}
              onChange={(e) => {
                const conn = connections.find((c) => c.id === e.target.value);
                if (conn) onSelectConnection(conn);
              }}
              className="bg-[#0F1115] border border-[#2D3139] rounded px-2.5 pl-6 py-1 text-[11px] text-[#E2E8F0] focus:outline-none focus:border-blue-500 font-mono transition-colors cursor-pointer"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#181A1F] text-[#E2E8F0]">
                  {c.name} ({c.host}:{c.port})
                </option>
              ))}
            </select>
            <div
              className="w-2 h-2 rounded-full absolute left-2 pointer-events-none"
              style={{ backgroundColor: activeConnection?.color || '#10b981' }}
            />
          </div>

          <button
            onClick={onOpenNewConnectionModal}
            title="Add New Connection"
            className="p-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8] hover:text-white rounded border border-[#3B414D] transition-colors text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onRefreshSchema}
            title="Refresh Database Schema"
            className="p-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8] hover:text-white rounded border border-[#3B414D] transition-colors text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle: Quick Action Bar for Editor */}
      <div className="flex items-center space-x-2">
        {activeTabType === 'editor' && (
          <>
            <button
              onClick={onRunCurrentQuery}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Execute</span>
            </button>

            <button
              onClick={onFormatCurrentQuery}
              className="px-2.5 py-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#E2E8F0] font-medium text-xs rounded flex items-center space-x-1.5 transition-colors"
            >
              <AlignLeft className="w-3 h-3" />
              <span className="hidden md:inline">Format SQL</span>
            </button>
          </>
        )}

        <button
          onClick={onOpenNewTableModal}
          className="px-2.5 py-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#E2E8F0] font-medium text-xs rounded flex items-center space-x-1.5 transition-colors"
        >
          <Layers className="w-3 h-3 text-cyan-400" />
          <span className="hidden md:inline">New Table DDL</span>
        </button>

        <button
          onClick={onOpenQueryBuilder}
          className={`px-2.5 py-1 rounded flex items-center space-x-1.5 text-xs font-semibold transition-all border shadow-sm cursor-pointer ${
            activeTabType === 'query-builder'
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-blue-950/80 hover:bg-blue-900 border-blue-700/60 text-blue-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Query Builder</span>
        </button>

        <button
          onClick={onOpenErdView}
          className="px-2.5 py-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#E2E8F0] font-medium text-xs rounded flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Network className="w-3 h-3 text-blue-400" />
          <span className="hidden md:inline">Schema ERD</span>
        </button>

        <button
          onClick={onOpenDiffViewer}
          className={`px-2.5 py-1 rounded flex items-center space-x-1.5 text-xs font-semibold transition-all border shadow-sm cursor-pointer ${
            activeTabType === 'diff-viewer'
              ? 'bg-purple-600 text-white border-purple-500'
              : 'bg-purple-950/80 hover:bg-purple-900 border-purple-700/60 text-purple-200'
          }`}
          title="Compare two SQL result sets side-by-side"
        >
          <GitCompare className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Diff Viewer</span>
        </button>

        <button
          onClick={onOpenEavStudio}
          className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200 font-medium text-xs rounded flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Layers className="w-3 h-3 text-purple-400" />
          <span className="hidden lg:inline">EAV Studio</span>
          <span className="px-1 py-0.2 text-[9px] bg-purple-800/80 text-purple-200 rounded font-mono">shrapnel</span>
        </button>
      </div>

      {/* Right: Theme Toggle, AI Assistant & Utilities */}
      <div className="flex items-center space-x-2">
        {/* Global Theme Toggle */}
        <div className="flex items-center space-x-0.5 bg-[#0F1115] border border-[#2D3139] rounded p-0.5 font-mono text-[10px]">
          <button
            onClick={() => onChangeTheme?.('dark')}
            className={`px-2 py-0.5 rounded flex items-center space-x-1 font-semibold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-purple-600 text-white shadow ring-1 ring-purple-400'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#2D3139]'
            }`}
            title="Dark CAD Theme (Default)"
          >
            <Moon className="w-3 h-3 text-purple-300" />
            <span className="hidden sm:inline">Dark</span>
          </button>
          <button
            onClick={() => onChangeTheme?.('light')}
            className={`px-2 py-0.5 rounded flex items-center space-x-1 font-semibold transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-amber-500 text-white shadow ring-1 ring-amber-300'
                : 'text-[#94A3B8] hover:text-slate-900 hover:bg-[#2D3139]'
            }`}
            title="Light Draft Blueprint Theme"
          >
            <Sun className="w-3 h-3 text-amber-200" />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button
            onClick={() => onChangeTheme?.('steel')}
            className={`px-2 py-0.5 rounded flex items-center space-x-1 font-semibold transition-all cursor-pointer ${
              theme === 'steel'
                ? 'bg-cyan-600 text-white shadow ring-1 ring-cyan-300'
                : 'text-[#94A3B8] hover:text-slate-100 hover:bg-[#2D3139]'
            }`}
            title="Steel Blue Theme"
          >
            <Palette className="w-3 h-3 text-cyan-200" />
            <span className="hidden sm:inline">Steel</span>
          </button>
        </div>

        <button
          onClick={onOpenAiAssistant}
          className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded shadow flex items-center space-x-1.5 transition-all"
        >
          <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
          <span>AI Architect</span>
        </button>

        <button
          onClick={onOpenShortcutsModal}
          title="Keyboard Shortcuts"
          className="p-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8] hover:text-white rounded border border-[#3B414D] transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        <div className="hidden lg:flex items-center space-x-1 pl-2 border-l border-[#2D3139] text-[10px] text-[#94A3B8] font-mono">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>SSL</span>
        </div>
      </div>
    </header>
  );
};
