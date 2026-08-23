import React from 'react';
import { Terminal, Table, Network, Plus, X, Boxes, Layers, GitCompare } from 'lucide-react';
import { QueryTab } from '../../types/database';

interface QueryTabsProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export const QueryTabs: React.FC<QueryTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div className="h-9 bg-[#181A1F] border-b border-[#2D3139] flex items-center px-1 overflow-x-auto custom-scrollbar select-none shrink-0">
      <div className="flex items-center space-x-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group h-8 px-3 rounded-t flex items-center space-x-2 text-sm font-mono cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#0F1115] text-[#E2E8F0] border-t-2 border-t-blue-500 font-medium border-x border-[#2D3139]'
                  : 'bg-[#181A1F] text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]/50 border-t-2 border-transparent'
              }`}
            >
              {tab.type === 'editor' && <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              {tab.type === 'table-viewer' && <Table className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {tab.type === 'erd' && <Network className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
              {tab.type === 'query-builder' && <Boxes className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              {tab.type === 'eav-studio' && <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
              {tab.type === 'diff-viewer' && <GitCompare className="w-3.5 h-3.5 text-purple-400 shrink-0" />}

              <span className="truncate max-w-[140px]">{tab.title}</span>

              {tab.isUnsaved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}

              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-[#2D3139] text-[#64748B] hover:text-[#E2E8F0] transition-colors opacity-70 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onNewTab}
        title="Open New Query Console"
        className="ml-2 p-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#94A3B8] hover:text-white rounded transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

