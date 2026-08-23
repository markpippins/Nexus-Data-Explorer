import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Network,
  ArrowRight,
  ArrowRightLeft,
  Key,
  Shield,
  Check,
  Copy,
  Terminal,
  Layers,
  AlertCircle,
  CheckCircle2,
  Database
} from 'lucide-react';
import { SchemaObject, TableObject } from '../../types/database';

interface NewRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemas: SchemaObject[];
  activeSchemaName: string;
  initialSourceTable?: string;
  initialSourceColumn?: string;
  initialTargetTable?: string;
  initialTargetColumn?: string;
  onSaveRelationship: (params: {
    schemaName: string;
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    constraintName: string;
    cardinality: '1:N' | '1:1';
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate: 'CASCADE' | 'RESTRICT' | 'NO ACTION';
  }) => void;
  onExecuteSql?: (sql: string) => void;
  theme?: 'dark' | 'light' | 'steel';
}

export const NewRelationshipModal: React.FC<NewRelationshipModalProps> = ({
  isOpen,
  onClose,
  schemas,
  activeSchemaName,
  initialSourceTable,
  initialSourceColumn,
  initialTargetTable,
  initialTargetColumn,
  onSaveRelationship,
  onExecuteSql,
  theme = 'dark',
}) => {
  const currentSchema = schemas.find((s) => s.name === activeSchemaName) || schemas[0];
  const tables = currentSchema?.tables || [];

  const [sourceTable, setSourceTable] = useState<string>(initialSourceTable || tables[0]?.name || '');
  const [sourceColumn, setSourceColumn] = useState<string>(initialSourceColumn || '');
  const [targetTable, setTargetTable] = useState<string>(initialTargetTable || tables[1]?.name || tables[0]?.name || '');
  const [targetColumn, setTargetColumn] = useState<string>(initialTargetColumn || '');
  const [constraintName, setConstraintName] = useState<string>('');
  const [cardinality, setCardinality] = useState<'1:N' | '1:1'>('1:N');
  const [onDelete, setOnDelete] = useState<'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'>('CASCADE');
  const [onUpdate, setOnUpdate] = useState<'CASCADE' | 'RESTRICT' | 'NO ACTION'>('CASCADE');
  const [copiedSql, setCopiedSql] = useState(false);
  const [customNameTouched, setCustomNameTouched] = useState(false);

  // Sync with initial props whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const srcT = initialSourceTable || tables[0]?.name || '';
      const srcObj = tables.find((t) => t.name === srcT);
      const srcC = initialSourceColumn || srcObj?.columns[0]?.name || '';

      const tgtT = initialTargetTable || (tables.length > 1 ? tables.find((t) => t.name !== srcT)?.name || tables[0]?.name : srcT);
      const tgtObj = tables.find((t) => t.name === tgtT);
      const tgtC = initialTargetColumn || tgtObj?.columns.find((c) => c.isPrimaryKey)?.name || tgtObj?.columns[0]?.name || 'id';

      setSourceTable(srcT);
      setSourceColumn(srcC);
      setTargetTable(tgtT);
      setTargetColumn(tgtC);
      setCustomNameTouched(false);
    }
  }, [isOpen, initialSourceTable, initialSourceColumn, initialTargetTable, initialTargetColumn]);

  // Update default source column when source table changes
  const sourceTableObj = useMemo(() => tables.find((t) => t.name === sourceTable), [tables, sourceTable]);
  const targetTableObj = useMemo(() => tables.find((t) => t.name === targetTable), [tables, targetTable]);

  useEffect(() => {
    if (sourceTableObj && (!sourceColumn || !sourceTableObj.columns.some((c) => c.name === sourceColumn))) {
      setSourceColumn(sourceTableObj.columns[0]?.name || '');
    }
  }, [sourceTableObj, sourceColumn]);

  useEffect(() => {
    if (targetTableObj && (!targetColumn || !targetTableObj.columns.some((c) => c.name === targetColumn))) {
      const pk = targetTableObj.columns.find((c) => c.isPrimaryKey);
      setTargetColumn(pk ? pk.name : targetTableObj.columns[0]?.name || 'id');
    }
  }, [targetTableObj, targetColumn]);

  // Auto-generate default constraint name if user hasn't typed custom name
  useEffect(() => {
    if (!customNameTouched && sourceTable && sourceColumn && targetTable) {
      setConstraintName(`fk_${sourceTable}_${sourceColumn}_${targetTable}`);
    }
  }, [sourceTable, sourceColumn, targetTable, customNameTouched]);

  if (!isOpen) return null;

  // Swap relationship direction (invert child and parent)
  const handleSwapDirection = () => {
    const prevSrcT = sourceTable;
    const prevSrcC = sourceColumn;
    const prevTgtT = targetTable;
    const prevTgtC = targetColumn;

    setSourceTable(prevTgtT);
    setSourceColumn(prevTgtC);
    setTargetTable(prevSrcT);
    setTargetColumn(prevSrcC);
    setCustomNameTouched(false);
  };

  // Generate standard SQL DDL statement
  const generatedSql = `-- Define Foreign Key Relationship on ${activeSchemaName}.${sourceTable}
ALTER TABLE "${activeSchemaName}"."${sourceTable}"
  ADD CONSTRAINT "${constraintName || `fk_${sourceTable}_${sourceColumn}`}"
  FOREIGN KEY ("${sourceColumn}")
  REFERENCES "${activeSchemaName}"."${targetTable}" ("${targetColumn}")
  ON DELETE ${onDelete}
  ON UPDATE ${onUpdate};`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleSave = () => {
    if (!sourceTable || !sourceColumn || !targetTable || !targetColumn) return;
    onSaveRelationship({
      schemaName: activeSchemaName,
      sourceTable,
      sourceColumn,
      targetTable,
      targetColumn,
      constraintName: constraintName || `fk_${sourceTable}_${sourceColumn}`,
      cardinality,
      onDelete,
      onUpdate,
    });
    onClose();
  };

  const isLight = theme === 'light';
  const isSteel = theme === 'steel';

  const sourceColDef = sourceTableObj?.columns.find((c) => c.name === sourceColumn);
  const targetColDef = targetTableObj?.columns.find((c) => c.name === targetColumn);

  const typeMismatch =
    sourceColDef &&
    targetColDef &&
    sourceColDef.type.toUpperCase() !== targetColDef.type.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-mono select-none animate-in fade-in duration-150">
      <div
        className={`w-full max-w-2xl ${
          isLight ? 'bg-white text-slate-900 border-slate-300' : isSteel ? 'bg-[#1E293B] text-slate-100 border-slate-700' : 'bg-[#181A1F] text-[#E2E8F0] border-[#2D3139]'
        } border rounded-2xl shadow-2xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-3.5 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : isSteel ? 'bg-[#334155] border-slate-700' : 'bg-[#1E232A] border-[#2D3139]'
          } flex items-center justify-between`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center space-x-2">
                <span>Define Foreign Key Relationship</span>
                <span className="px-2 py-0.5 text-[10px] rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono">
                  {activeSchemaName}
                </span>
              </h2>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#94A3B8]'}`}>
                Connect child foreign key column with parent referenced key
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-[#2D3139] text-[#94A3B8] hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar text-xs">
          {/* Visual Entity Link Diagram */}
          <div
            className={`p-4 rounded-xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0F1115] border-[#2D3139]'
            } flex flex-col md:flex-row items-center justify-between gap-3`}
          >
            {/* Child Table & Column (Source) */}
            <div className="flex-1 w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-400 flex items-center space-x-1">
                  <Key className="w-3 h-3" />
                  <span>Child Table (Foreign Key)</span>
                </span>
                {sourceColDef && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50">
                    {sourceColDef.type}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-[#64748B]'}`}>Table</label>
                  <select
                    value={sourceTable}
                    onChange={(e) => {
                      setSourceTable(e.target.value);
                      setCustomNameTouched(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-[#181A1F] border-[#3B414D]'
                    } focus:outline-none focus:border-purple-500 text-xs font-semibold`}
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-[#64748B]'}`}>Column</label>
                  <select
                    value={sourceColumn}
                    onChange={(e) => {
                      setSourceColumn(e.target.value);
                      setCustomNameTouched(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-[#181A1F] border-[#3B414D]'
                    } focus:outline-none focus:border-purple-500 text-xs font-semibold`}
                  >
                    {sourceTableObj?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type}) {c.isPrimaryKey ? '★ PK' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Direction Arrow & Swap Button */}
            <div className="flex flex-col items-center justify-center shrink-0 px-1 py-2">
              <button
                type="button"
                onClick={handleSwapDirection}
                title="Swap child & parent relationship direction"
                className={`p-2 rounded-full border transition-all cursor-pointer shadow-md ${
                  isLight
                    ? 'bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200'
                    : 'bg-purple-900/60 border-purple-600/80 text-purple-300 hover:bg-purple-800'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
              <span className="text-[9px] text-[#94A3B8] mt-1 font-mono font-bold">REFERENCES</span>
            </div>

            {/* Parent Table & Column (Target) */}
            <div className="flex-1 w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center space-x-1">
                  <Key className="w-3 h-3" />
                  <span>Parent Table (Primary Key)</span>
                </span>
                {targetColDef && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                    {targetColDef.type}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-[#64748B]'}`}>Table</label>
                  <select
                    value={targetTable}
                    onChange={(e) => {
                      setTargetTable(e.target.value);
                      setCustomNameTouched(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-[#181A1F] border-[#3B414D]'
                    } focus:outline-none focus:border-purple-500 text-xs font-semibold`}
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-[#64748B]'}`}>Column</label>
                  <select
                    value={targetColumn}
                    onChange={(e) => {
                      setTargetColumn(e.target.value);
                      setCustomNameTouched(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded border ${
                      isLight ? 'bg-white border-slate-300' : 'bg-[#181A1F] border-[#3B414D]'
                    } focus:outline-none focus:border-purple-500 text-xs font-semibold`}
                  >
                    {targetTableObj?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type}) {c.isPrimaryKey ? '★ PK' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Type Warning */}
          {typeMismatch && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-700/60 text-amber-300 rounded-lg flex items-center space-x-2 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>Notice:</strong> Source column type (<code>{sourceColDef?.type}</code>) differs from target column type (<code>{targetColDef?.type}</code>). Ensure they are compatible types.
              </span>
            </div>
          )}

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Constraint Name */}
            <div>
              <label className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'} block mb-1`}>
                Constraint Name
              </label>
              <input
                type="text"
                value={constraintName}
                onChange={(e) => {
                  setConstraintName(e.target.value);
                  setCustomNameTouched(true);
                }}
                placeholder={`fk_${sourceTable}_${sourceColumn}_${targetTable}`}
                className={`w-full px-3 py-1.5 rounded border ${
                  isLight ? 'bg-white border-slate-300' : 'bg-[#0F1115] border-[#3B414D]'
                } focus:outline-none focus:border-purple-500 font-mono text-xs`}
              />
            </div>

            {/* Cardinality */}
            <div>
              <label className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'} block mb-1`}>
                Cardinality
              </label>
              <select
                value={cardinality}
                onChange={(e) => setCardinality(e.target.value as '1:N' | '1:1')}
                className={`w-full px-3 py-1.5 rounded border ${
                  isLight ? 'bg-white border-slate-300' : 'bg-[#0F1115] border-[#3B414D]'
                } focus:outline-none focus:border-purple-500 text-xs`}
              >
                <option value="1:N">1 : N (One-to-Many / Standard FK)</option>
                <option value="1:1">1 : 1 (One-to-One / Unique FK)</option>
              </select>
            </div>

            {/* ON DELETE Action */}
            <div>
              <label className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'} block mb-1`}>
                ON DELETE Action
              </label>
              <select
                value={onDelete}
                onChange={(e) => setOnDelete(e.target.value as any)}
                className={`w-full px-3 py-1.5 rounded border ${
                  isLight ? 'bg-white border-slate-300' : 'bg-[#0F1115] border-[#3B414D]'
                } focus:outline-none focus:border-purple-500 text-xs`}
              >
                <option value="CASCADE">CASCADE (Delete child rows)</option>
                <option value="SET NULL">SET NULL (Set child FK to null)</option>
                <option value="RESTRICT">RESTRICT (Block parent deletion)</option>
                <option value="NO ACTION">NO ACTION (Standard integrity check)</option>
              </select>
            </div>

            {/* ON UPDATE Action */}
            <div>
              <label className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'} block mb-1`}>
                ON UPDATE Action
              </label>
              <select
                value={onUpdate}
                onChange={(e) => setOnUpdate(e.target.value as any)}
                className={`w-full px-3 py-1.5 rounded border ${
                  isLight ? 'bg-white border-slate-300' : 'bg-[#0F1115] border-[#3B414D]'
                } focus:outline-none focus:border-purple-500 text-xs`}
              >
                <option value="CASCADE">CASCADE (Propagate key updates)</option>
                <option value="RESTRICT">RESTRICT (Block parent key update)</option>
                <option value="NO ACTION">NO ACTION (Standard check)</option>
              </select>
            </div>
          </div>

          {/* DDL SQL Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-600' : 'text-[#94A3B8]'}`}>
                Generated SQL DDL
              </label>
              <button
                type="button"
                onClick={handleCopySql}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center space-x-1 cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre
              className={`p-3 rounded-lg border font-mono text-[11px] overflow-x-auto ${
                isLight ? 'bg-slate-900 text-emerald-300 border-slate-800' : 'bg-[#0F1115] text-emerald-400 border-[#2D3139]'
              }`}
            >
              {generatedSql}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3 border-t ${
            isLight ? 'bg-slate-50 border-slate-200' : isSteel ? 'bg-[#334155] border-slate-700' : 'bg-[#1E232A] border-[#2D3139]'
          } flex items-center justify-between`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-3.5 py-1.5 rounded-lg border font-medium text-xs transition-colors cursor-pointer ${
              isLight
                ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                : 'bg-[#2D3139] border-[#3B414D] hover:bg-[#3B414D] text-[#E2E8F0]'
            }`}
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            {onExecuteSql && (
              <button
                type="button"
                onClick={() => {
                  onExecuteSql(generatedSql);
                  handleSave();
                }}
                className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-purple-300 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Execute SQL in DB engine and update ERD schema"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>Execute & Save</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!sourceTable || !sourceColumn || !targetTable || !targetColumn}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-purple-900/30 flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Relationship</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
