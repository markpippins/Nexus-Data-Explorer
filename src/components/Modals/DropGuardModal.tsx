import React, { useState } from 'react';
import { ShieldAlert, X, Trash2 } from 'lucide-react';

interface DropGuardModalProps {
  isOpen: boolean;
  target: { type: string; schemaName: string; objectName: string; databaseName?: string } | null;
  /** The schema currently marked ACTIVE in the tree (for context in the copy). */
  activeSchema: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Schema-activity drop guard. Dropping an object in a schema other than the
 * active one is exactly the "wrong tab" mistake — the tree now browses every
 * schema, so a right-click meant for schema A can land on schema B. This
 * modal forces a typed confirmation of the fully-qualified object name
 * before the DROP is emitted.
 */
export const DropGuardModal: React.FC<DropGuardModalProps> = ({ isOpen, target, activeSchema, onConfirm, onClose }) => {
  const [confirmedText, setConfirmedText] = useState('');

  if (!isOpen || !target) return null;

  const qualified = `${target.databaseName ? `${target.databaseName}.` : ''}${target.schemaName}.${target.objectName}`;
  const ready = confirmedText.trim() === qualified;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1F232B] border border-rose-800/70 rounded-xl shadow-2xl overflow-hidden font-mono text-sm">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-sm">Drop outside active schema</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-[#E2E8F0] leading-relaxed">
            You are about to <span className="text-rose-400 font-semibold">DROP {target.type} {qualified}</span> —
            but your active schema is{' '}
            <span className="text-blue-300 font-semibold">{activeSchema || '(none)'}</span>. The tree now shows every
            schema, so this may not be the object you think it is.
          </p>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            This cannot be undone. Type the fully-qualified name exactly to confirm.
          </p>
          <input
            type="text"
            autoFocus
            value={confirmedText}
            onChange={(e) => setConfirmedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready) {
                onConfirm();
              }
              if (e.key === 'Escape') onClose();
            }}
            placeholder={qualified}
            className={`w-full bg-[#0F1115] border rounded px-3 py-2 text-[#E2E8F0] focus:outline-none font-mono transition-colors placeholder:text-[#64748B] ${
              confirmedText && !ready ? 'border-rose-600/60' : 'border-[#2D3139] focus:border-blue-500'
            }`}
          />
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className={ready ? 'text-emerald-400' : 'text-[#64748B]'}>
              {ready ? '✓ matches — drop is armed' : `waiting for: ${qualified}`}
            </span>
            <span className="text-[#64748B]">active: {activeSchema || '—'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2D3139] flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => ready && onConfirm()}
            disabled={!ready}
            className="px-4 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Drop {qualified}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
