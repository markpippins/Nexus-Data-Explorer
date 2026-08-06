import React from 'react';
import { Info, X, Code, Key, Layers } from 'lucide-react';

interface ObjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemaName: string;
  objectName: string;
  objectData: any;
}

export const ObjectDetailsModal: React.FC<ObjectDetailsModalProps> = ({
  isOpen,
  onClose,
  schemaName,
  objectName,
  objectData,
}) => {
  if (!isOpen || !objectData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#1F232B] border border-[#3B414D] rounded-xl shadow-2xl overflow-hidden font-mono text-sm">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm">
              Object Properties: {schemaName}.{objectName}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {objectData.comment && (
            <div className="p-2.5 bg-[#0F1115] border border-[#2D3139] rounded text-[#E2E8F0]">
              <span className="text-[#64748B] font-bold block mb-1">Comment:</span>
              <p>{objectData.comment}</p>
            </div>
          )}

          {/* Columns Section */}
          {objectData.columns && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#94A3B8] font-bold uppercase tracking-wider flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Columns ({objectData.columns.length})</span>
              </span>
              <div className="border border-[#2D3139] rounded-lg overflow-hidden bg-[#0F1115]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#181A1F] text-[#94A3B8] text-[10px] uppercase border-b border-[#2D3139]">
                    <tr>
                      <th className="p-2">Column</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Constraints</th>
                      <th className="p-2">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objectData.columns.map((col: any) => (
                      <tr key={col.name} className="border-b border-[#1F232B] text-[#E2E8F0]">
                        <td className="p-2 font-bold flex items-center space-x-1.5">
                          {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span>{col.name}</span>
                        </td>
                        <td className="p-2 text-blue-400">{col.type}</td>
                        <td className="p-2 text-[#94A3B8]">
                          {col.isPrimaryKey ? 'PK' : !col.isNullable ? 'NOT NULL' : 'NULL'}
                        </td>
                        <td className="p-2 text-[#64748B]">{col.defaultValue || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Indexes Section */}
          {objectData.indexes && objectData.indexes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#94A3B8] font-bold uppercase tracking-wider">Indexes</span>
              <div className="p-3 bg-[#0F1115] border border-[#2D3139] rounded-lg space-y-1">
                {objectData.indexes.map((idx: any) => (
                  <div key={idx.name} className="flex items-center justify-between text-[#E2E8F0]">
                    <span className="font-bold text-emerald-400">{idx.name}</span>
                    <span className="text-[#64748B]">Columns: ({idx.columns.join(', ')})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View / Procedure Definition */}
          {objectData.definition && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#94A3B8] font-bold uppercase tracking-wider flex items-center space-x-1">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>SQL Definition DDL</span>
              </span>
              <pre className="p-3 bg-[#0F1115] border border-[#2D3139] rounded text-blue-300 overflow-x-auto whitespace-pre-wrap">
                {objectData.definition}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#181A1F] border-t border-[#2D3139] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
