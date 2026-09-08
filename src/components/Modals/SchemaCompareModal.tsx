import React, { useMemo, useState } from 'react';
import { X, GitCompare, CheckCircle2, XCircle, ArrowRightLeft, MinusCircle } from 'lucide-react';
import { SchemaObject } from '../../types/database';

interface SchemaCompareModalProps {
  isOpen: boolean;
  schemas: SchemaObject[];
  /** Preselected left (base) schema name, e.g. the schema the compare was launched from. */
  initialLeft?: string;
  onClose: () => void;
}

interface ColumnDelta {
  column: string;
  status: 'same' | 'changed' | 'left-only' | 'right-only';
  leftType?: string;
  rightType?: string;
}

interface TableDelta {
  name: string;
  kind: 'table' | 'view';
  status: 'same' | 'changed' | 'left-only' | 'right-only';
  columns: ColumnDelta[];
}

const STATUS_META: Record<TableDelta['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  same: { label: 'identical', cls: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
  changed: { label: 'changed', cls: 'text-amber-400', icon: <ArrowRightLeft className="w-3 h-3" /> },
  'left-only': { label: 'left only', cls: 'text-rose-400', icon: <XCircle className="w-3 h-3" /> },
  'right-only': { label: 'right only', cls: 'text-cyan-400', icon: <PlusIcon /> },
};

function PlusIcon() {
  return <MinusCircle className="w-3 h-3 rotate-180" />;
}

function colSignature(c: { type: string; isNullable?: boolean; isPrimaryKey?: boolean; isForeignKey?: boolean }): string {
  return [c.type, c.isNullable ? 'null' : 'notnull', c.isPrimaryKey ? 'pk' : '', c.isForeignKey ? 'fk' : ''].join('|');
}

function diffTables(
  left: SchemaObject,
  right: SchemaObject
): { tables: TableDelta[]; summary: { same: number; changed: number; leftOnly: number; rightOnly: number; colChanges: number } } {
  const map = new Map<string, TableDelta>();
  const ensure = (name: string, kind: TableDelta['kind']): TableDelta => {
    let t = map.get(`${kind}:${name}`);
    if (!t) {
      t = { name, kind, status: 'same', columns: [] };
      map.set(`${kind}:${name}`, t);
    }
    return t;
  };

  const leftTables = new Map(left.tables.map((t) => [t.name, t]));
  const rightTables = new Map(right.tables.map((t) => [t.name, t]));
  const leftViews = new Map((left.views || []).map((v) => [v.name, v]));
  const rightViews = new Map((right.views || []).map((v) => [v.name, v]));

  // Tables + views share the object namespace per kind.
  for (const [name, lt] of leftTables) {
    const rt = rightTables.get(name);
    const entry = ensure(name, 'table');
    if (!rt) {
      entry.status = 'left-only';
      continue;
    }
    const lcols = new Map(lt.columns.map((c) => [c.name, c]));
    const rcols = new Map(rt.columns.map((c) => [c.name, c]));
    const deltas: ColumnDelta[] = [];
    for (const [cn, lc] of lcols) {
      const rc = rcols.get(cn);
      if (!rc) deltas.push({ column: cn, status: 'left-only', leftType: lc.type });
      else if (colSignature(lc) !== colSignature(rc))
        deltas.push({ column: cn, status: 'changed', leftType: lc.type, rightType: rc.type });
      else deltas.push({ column: cn, status: 'same', leftType: lc.type, rightType: rc.type });
    }
    for (const [cn, rc] of rcols) {
      if (!lcols.has(cn)) deltas.push({ column: cn, status: 'right-only', rightType: rc.type });
    }
    entry.columns = deltas;
    entry.status = deltas.some((d) => d.status !== 'same') ? 'changed' : 'same';
  }
  for (const name of rightTables.keys()) {
    if (!leftTables.has(name)) ensure(name, 'table').status = 'right-only';
  }

  for (const name of leftViews.keys()) {
    if (rightViews.has(name)) ensure(name, 'view').status = 'same';
    else ensure(name, 'view').status = 'left-only';
  }
  for (const name of rightViews.keys()) {
    if (!leftViews.has(name)) ensure(name, 'view').status = 'right-only';
  }

  const tables = [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const summary = {
    same: tables.filter((t) => t.status === 'same').length,
    changed: tables.filter((t) => t.status === 'changed').length,
    leftOnly: tables.filter((t) => t.status === 'left-only').length,
    rightOnly: tables.filter((t) => t.status === 'right-only').length,
    colChanges: tables.reduce((acc, t) => acc + t.columns.filter((c) => c.status !== 'same').length, 0),
  };
  return { tables, summary };
}

export const SchemaCompareModal: React.FC<SchemaCompareModalProps> = ({ isOpen, schemas, initialLeft, onClose }) => {
  const [leftName, setLeftName] = useState(initialLeft || schemas[0]?.name || '');
  const [rightName, setRightName] = useState(
    (schemas.find((s) => s.name !== (initialLeft || schemas[0]?.name)) || schemas[0])?.name || ''
  );

  const sortedSchemas = useMemo(() => [...schemas].sort((a, b) => a.name.localeCompare(b.name)), [schemas]);

  const { tables, summary, left, right } = useMemo(() => {
    const l = schemas.find((s) => s.name === leftName);
    const r = schemas.find((s) => s.name === rightName);
    if (!l || !r || l === r) return { tables: [], summary: null, left: l, right: r };
    const diff = diffTables(l, r);
    return { ...diff, left: l, right: r };
  }, [schemas, leftName, rightName]);

  if (!isOpen) return null;

  const schemaPicker = (value: string, onChange: (v: string) => void, id: string) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-[#0F1115] border border-[#2D3139] rounded px-2 py-1.5 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
    >
      {sortedSchemas.map((s) => (
        <option key={s.name} value={s.name} className="bg-[#181A1F]">
          {s.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#1F232B] border border-[#3B414D] rounded-xl shadow-2xl overflow-hidden font-mono text-sm">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0]">
          <div className="flex items-center space-x-2">
            <GitCompare className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-sm">Compare Schemas</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pickers */}
        <div className="px-5 py-3 border-b border-[#2D3139] flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <label htmlFor="cmp-left" className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
              Base (left)
            </label>
            {schemaPicker(leftName, setLeftName, 'cmp-left')}
          </div>
          <ArrowRightLeft className="w-4 h-4 text-[#64748B] mt-4 shrink-0" />
          <div className="flex-1 space-y-1">
            <label htmlFor="cmp-right" className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
              Compare (right)
            </label>
            {schemaPicker(rightName, setRightName, 'cmp-right')}
          </div>
        </div>

        {left && right && summary ? (
          <>
            {/* Summary strip */}
            <div className="px-5 py-2 border-b border-[#2D3139] flex items-center gap-4 text-[11px] font-mono flex-wrap">
              <span className="text-emerald-400">{summary.same} identical</span>
              <span className="text-amber-400">{summary.changed} changed</span>
              <span className="text-rose-400">{summary.leftOnly} left-only</span>
              <span className="text-cyan-400">{summary.rightOnly} right-only</span>
              <span className="text-[#94A3B8]">{summary.colChanges} column deltas</span>
              <span className="text-[#64748B] ml-auto">
                {left.name} ↔ {right.name}
              </span>
            </div>

            {/* Diff list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-3 space-y-1.5 text-xs">
              {tables.length === 0 && <p className="text-[#64748B] italic">No objects to compare.</p>}
              {tables.map((t) => (
                <div key={`${t.kind}:${t.name}`} className="border border-[#2D3139] rounded">
                  <div className="px-3 py-1.5 flex items-center gap-2 bg-[#181A1F]">
                    <span className={STATUS_META[t.status].cls}>{STATUS_META[t.status].icon}</span>
                    <span className="text-[#E2E8F0] font-semibold truncate">
                      {t.kind === 'view' ? '👁 ' : ''}
                      {t.name}
                    </span>
                    <span className={`text-[10px] uppercase ${STATUS_META[t.status].cls}`}>
                      {STATUS_META[t.status].label}
                    </span>
                  </div>
                  {t.status === 'changed' && t.columns.some((c) => c.status !== 'same') && (
                    <div className="px-4 py-1.5 space-y-0.5 border-t border-[#2D3139]/60">
                      {t.columns
                        .filter((c) => c.status !== 'same')
                        .map((c) => (
                          <div key={c.column} className="flex items-center gap-2 text-[11px] font-mono">
                            {c.status === 'changed' && (
                              <>
                                <ArrowRightLeft className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="text-[#E2E8F0]">{c.column}</span>
                                <span className="text-rose-300 line-through">{c.leftType}</span>
                                <span className="text-[#64748B]">→</span>
                                <span className="text-emerald-300">{c.rightType}</span>
                              </>
                            )}
                            {c.status === 'left-only' && (
                              <>
                                <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span className="text-[#E2E8F0]">{c.column}</span>
                                <span className="text-[#64748B]">only in</span>
                                <span className="text-rose-300">{left.name}</span>
                                <span className="text-[#94A3B8]">({c.leftType})</span>
                              </>
                            )}
                            {c.status === 'right-only' && (
                              <>
                                <MinusCircle className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span className="text-[#E2E8F0]">{c.column}</span>
                                <span className="text-[#64748B]">only in</span>
                                <span className="text-cyan-300">{right.name}</span>
                                <span className="text-[#94A3B8]">({c.rightType})</span>
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#64748B] text-xs">
            Pick two different schemas to compare.
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2D3139] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
