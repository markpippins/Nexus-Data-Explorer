import React from 'react';
import { HelpCircle, X, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + Enter / Cmd + Enter', desc: 'Execute current query or highlighted selection' },
  { key: 'Ctrl + Shift + F', desc: 'Auto-format SQL statement with uppercase keywords' },
  { key: 'Double Click Table / View', desc: 'Open interactive tabular Data Grid tab' },
  { key: 'Right Click Tree Object', desc: 'Open context menu for DDL generation & object actions' },
  { key: 'Tab / Enter in Editor', desc: 'Accept autocomplete keyword / table suggestion' },
  { key: 'Escape', desc: 'Close open modals, context menus, or autocomplete popups' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1F232B] border border-[#3B414D] rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm">Data Workbench Shortcuts</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-5 space-y-3">
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              className="p-2.5 bg-[#0F1115] border border-[#2D3139] rounded-lg flex items-center justify-between"
            >
              <span className="text-[#E2E8F0] font-medium">{s.desc}</span>
              <kbd className="px-2 py-1 bg-[#2D3139] text-blue-400 border border-[#3B414D] rounded text-[11px] font-bold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#181A1F] border-t border-[#2D3139] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
