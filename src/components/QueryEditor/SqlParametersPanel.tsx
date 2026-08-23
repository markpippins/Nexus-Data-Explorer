import React, { useState } from 'react';
import {
  Variable,
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Play,
  HelpCircle,
  Code2,
  Calendar,
  Clock,
  CheckSquare,
  Hash,
  Type,
  FileCode,
  AlertCircle,
  Sliders,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
} from 'lucide-react';
import { QueryParameter, SqlParamType } from '../../types/database';
import {
  PARAMETER_PRESETS,
  ParameterPreset,
  createCustomParameter,
  formatParamValue,
  substituteParameters,
  inferDefaultValue,
} from '../../services/sqlParameters';

interface SqlParametersPanelProps {
  query: string;
  parameters: QueryParameter[];
  onChangeParameters: (params: QueryParameter[]) => void;
  onApplyPreset: (preset: ParameterPreset) => void;
  onInsertPlaceholderIntoEditor: (placeholder: string) => void;
  onRunCompiledQuery: (compiledSql: string) => void;
  onClose: () => void;
  autoSubstituteOnRun: boolean;
  onToggleAutoSubstitute: (enabled: boolean) => void;
}

const TYPE_CONFIG: Record<
  SqlParamType,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }
> = {
  string: { label: 'String', icon: Type, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
  integer: { label: 'Integer', icon: Hash, color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-800/40' },
  decimal: { label: 'Decimal', icon: Hash, color: 'text-cyan-400', bg: 'bg-cyan-950/40 border-cyan-800/40' },
  boolean: { label: 'Boolean', icon: CheckSquare, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/40' },
  date: { label: 'Date', icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/40' },
  timestamp: { label: 'Timestamp', icon: Clock, color: 'text-pink-400', bg: 'bg-pink-950/40 border-pink-800/40' },
  null: { label: 'NULL', icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-900 border-slate-700' },
  json: { label: 'JSON', icon: FileCode, color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800/40' },
  raw_sql: { label: 'Raw SQL', icon: Code2, color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-800/40' },
};

export const SqlParametersPanel: React.FC<SqlParametersPanelProps> = ({
  query,
  parameters,
  onChangeParameters,
  onApplyPreset,
  onInsertPlaceholderIntoEditor,
  onRunCompiledQuery,
  onClose,
  autoSubstituteOnRun,
  onToggleAutoSubstitute,
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [newParamName, setNewParamName] = useState('');
  const [showAddInline, setShowAddInline] = useState(false);

  // Compute live compiled SQL
  const { compiledSql, missingParams, substitutedCount } = substituteParameters(query, parameters);

  // Handle single param update
  const handleUpdateParam = (id: string, updates: Partial<QueryParameter>) => {
    const updated = parameters.map((p) => {
      if (p.id === id) {
        const next = { ...p, ...updates };
        if (updates.name && !updates.rawPlaceholder) {
          const clean = updates.name.replace(/^[:$]|[{}]/g, '');
          next.rawPlaceholder = `:${clean}`;
        }
        return next;
      }
      return p;
    });
    onChangeParameters(updated);
  };

  // Handle type change with auto default conversion
  const handleChangeType = (id: string, newType: SqlParamType) => {
    const target = parameters.find((p) => p.id === id);
    if (!target) return;
    const newVal = inferDefaultValue(target.name, newType);
    handleUpdateParam(id, { type: newType, value: newVal });
  };

  // Handle add custom parameter
  const handleAddCustomParam = () => {
    const name = newParamName.trim() || `param_${parameters.length + 1}`;
    const newP = createCustomParameter(name, 'string');
    onChangeParameters([...parameters, newP]);
    setNewParamName('');
    setShowAddInline(false);
  };

  // Delete parameter
  const handleDeleteParam = (id: string) => {
    onChangeParameters(parameters.filter((p) => p.id !== id));
  };

  // Autofill realistic sample values
  const handleAutofillSamples = () => {
    const updated = parameters.map((p) => ({
      ...p,
      value: inferDefaultValue(p.name, p.type),
    }));
    onChangeParameters(updated);
  };

  // Clear all values
  const handleClearAll = () => {
    const updated = parameters.map((p) => ({
      ...p,
      value: p.type === 'boolean' ? false : p.type === 'integer' || p.type === 'decimal' ? 0 : '',
    }));
    onChangeParameters(updated);
  };

  // Copy compiled SQL
  const handleCopyCompiledSql = () => {
    navigator.clipboard.writeText(compiledSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="bg-[#12151B] border-b border-[#2D3139] flex flex-col text-xs font-sans select-none shrink-0 shadow-lg">
      {/* Top Header Toolbar */}
      <div className="px-3 py-2 bg-[#181A21] border-b border-[#262A33] flex flex-wrap items-center justify-between gap-2">
        {/* Left Title & Status */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 font-bold text-white">
            <Variable className="w-4 h-4 text-purple-400" />
            <span className="text-sm">Query Parameters</span>
          </div>

          <span
            className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border flex items-center space-x-1 ${
              parameters.length > 0
                ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                : 'bg-[#252B37] text-slate-400 border-slate-700'
            }`}
          >
            <span>
              {parameters.length} {parameters.length === 1 ? 'Variable' : 'Variables'}
            </span>
            {substitutedCount > 0 && (
              <span className="text-emerald-400 ml-1">({substitutedCount} bound in SQL)</span>
            )}
          </span>

          {missingParams.length > 0 && (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/60 flex items-center space-x-1">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>{missingParams.length} missing in query</span>
            </span>
          )}
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center space-x-2">
          {/* Auto-substitute Toggle */}
          <label
            className="flex items-center space-x-1.5 text-[11px] text-slate-300 hover:text-white cursor-pointer px-2 py-1 bg-[#1F232B] rounded border border-[#2D3139]"
            title="Automatically substitute parameters into the SQL query before execution"
          >
            <input
              type="checkbox"
              checked={autoSubstituteOnRun}
              onChange={(e) => onToggleAutoSubstitute(e.target.checked)}
              className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Auto-Substitute on Run</span>
          </label>

          {/* Presets Selector Popover */}
          <div className="relative">
            <button
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="px-2 py-1 bg-[#1F232B] hover:bg-[#2A303C] text-slate-200 hover:text-white border border-[#3B414D] rounded flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Load parameterized SQL sample queries"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sample Presets</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showPresetsMenu && (
              <div className="absolute right-0 mt-1.5 w-80 bg-[#181A21] border border-[#3B414D] rounded-lg shadow-2xl p-2 z-50 text-xs">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#2D3139]">
                  <span className="font-bold text-white flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Parameterized Query Presets</span>
                  </span>
                  <button
                    onClick={() => setShowPresetsMenu(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 custom-scrollbar">
                  {PARAMETER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onApplyPreset(preset);
                        setShowPresetsMenu(false);
                      }}
                      className="w-full text-left p-2 rounded hover:bg-[#252B37] transition-colors border border-transparent hover:border-blue-900/60 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 group-hover:text-blue-400">
                          {preset.title}
                        </span>
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-[#0F1115] text-slate-400 font-mono">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {preset.parameters.map((p) => (
                          <span
                            key={p.name}
                            className="px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 font-mono text-[9px] border border-purple-900/50"
                          >
                            {p.rawPlaceholder}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Autofill Samples */}
          <button
            onClick={handleAutofillSamples}
            className="px-2 py-1 bg-[#1F232B] hover:bg-[#2A303C] text-slate-200 hover:text-white border border-[#3B414D] rounded flex items-center space-x-1 transition-colors cursor-pointer"
            title="Autofill realistic sample values for all parameters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Autofill Samples</span>
          </button>

          {/* Add Parameter Button */}
          <button
            onClick={() => setShowAddInline(!showAddInline)}
            className="px-2 py-1 bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/60 rounded flex items-center space-x-1 transition-colors cursor-pointer font-semibold"
            title="Manually add a new parameter variable"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variable</span>
          </button>

          {/* Live Preview Toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-2 py-1 rounded border flex items-center space-x-1 transition-colors cursor-pointer ${
              showPreview
                ? 'bg-blue-950/70 border-blue-700 text-blue-300'
                : 'bg-[#1F232B] border-[#3B414D] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Compiled SQL Preview"
          >
            {showPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">SQL Preview</span>
          </button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#252B37] rounded transition-colors cursor-pointer"
            title="Close Parameters Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Add Parameter Input Bar */}
      {showAddInline && (
        <div className="px-3 py-2 bg-[#161922] border-b border-[#2D3139] flex items-center space-x-2">
          <span className="text-slate-400 font-mono text-[11px]">Variable Name:</span>
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400 font-mono font-bold">
              :
            </span>
            <input
              type="text"
              value={newParamName}
              onChange={(e) => setNewParamName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="e.g. customer_id, status, min_price"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustomParam();
                if (e.key === 'Escape') setShowAddInline(false);
              }}
              className="w-full bg-[#0F1115] border border-purple-900/60 focus:border-purple-500 rounded pl-5 pr-2 py-1 text-xs text-white placeholder-slate-600 outline-none font-mono"
              autoFocus
            />
          </div>
          <button
            onClick={handleAddCustomParam}
            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold text-xs cursor-pointer"
          >
            Create
          </button>
          <button
            onClick={() => setShowAddInline(false)}
            className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Parameters Table / List */}
      <div className="p-3 max-h-64 overflow-y-auto custom-scrollbar">
        {parameters.length === 0 ? (
          <div className="py-6 px-4 flex flex-col items-center justify-center text-center space-y-2.5 bg-[#0F1115] rounded-lg border border-[#232731]">
            <div className="p-2.5 bg-purple-950/40 rounded-full border border-purple-800/40 text-purple-400">
              <Variable className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-200 text-sm">No Variables Detected in Query</p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                Type parameter placeholders in your SQL like{' '}
                <code className="text-purple-300 font-mono bg-[#181A21] px-1 py-0.5 rounded">:status</code>,{' '}
                <code className="text-blue-300 font-mono bg-[#181A21] px-1 py-0.5 rounded">$1</code>, or{' '}
                <code className="text-amber-300 font-mono bg-[#181A21] px-1 py-0.5 rounded">{'{{user_id}}'}</code> to dynamically bind values.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => {
                  onInsertPlaceholderIntoEditor(':customer_id');
                }}
                className="px-2.5 py-1 bg-[#1F232B] hover:bg-[#2A303C] text-purple-300 border border-purple-900/60 rounded font-mono text-[11px] cursor-pointer"
              >
                + Insert :customer_id
              </button>
              <button
                onClick={() => {
                  onInsertPlaceholderIntoEditor(':status');
                }}
                className="px-2.5 py-1 bg-[#1F232B] hover:bg-[#2A303C] text-emerald-300 border border-emerald-900/60 rounded font-mono text-[11px] cursor-pointer"
              >
                + Insert :status
              </button>
              <button
                onClick={() => onApplyPreset(PARAMETER_PRESETS[0])}
                className="px-2.5 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/60 rounded font-semibold text-xs cursor-pointer flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Load Sample Query</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {parameters.map((param) => {
              const typeInfo = TYPE_CONFIG[param.type] || TYPE_CONFIG.string;
              const TypeIcon = typeInfo.icon;
              const isDetectedInSql = (param.occurrences ?? 0) > 0;

              return (
                <div
                  key={param.id}
                  className={`p-2 rounded-lg bg-[#0F1115] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 ${
                    isDetectedInSql
                      ? 'border-[#282D38] hover:border-[#3B414D]'
                      : 'border-dashed border-slate-800 opacity-80'
                  }`}
                >
                  {/* Left Parameter Identifier */}
                  <div className="flex items-center space-x-2 min-w-[200px] shrink-0">
                    {/* Placeholder Chip */}
                    <button
                      onClick={() => onInsertPlaceholderIntoEditor(param.rawPlaceholder)}
                      className="px-2 py-1 rounded bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800/60 font-mono font-bold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Click to insert placeholder at cursor in SQL Editor"
                    >
                      <span>{param.rawPlaceholder}</span>
                    </button>

                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200 font-mono text-xs">{param.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {isDetectedInSql ? (
                          <span className="text-emerald-400">
                            {param.occurrences} {param.occurrences === 1 ? 'match' : 'matches'} in SQL
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Custom / not in query</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Middle Type Selector */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="relative">
                      <select
                        value={param.type}
                        onChange={(e) => handleChangeType(param.id, e.target.value as SqlParamType)}
                        className={`appearance-none bg-[#181A21] border rounded px-2.5 py-1 text-xs font-mono font-medium outline-none cursor-pointer pr-6 ${typeInfo.color} ${typeInfo.bg}`}
                      >
                        <option value="string">String ('val')</option>
                        <option value="integer">Integer (42)</option>
                        <option value="decimal">Decimal (99.95)</option>
                        <option value="boolean">Boolean (TRUE/FALSE)</option>
                        <option value="date">Date ('YYYY-MM-DD')</option>
                        <option value="timestamp">Timestamp</option>
                        <option value="null">NULL</option>
                        <option value="json">JSON ('{"{...}"}')</option>
                        <option value="raw_sql">Raw SQL (Identifier)</option>
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                    </div>
                  </div>

                  {/* Value Input Control */}
                  <div className="flex-1 flex items-center space-x-2 min-w-[180px]">
                    {param.type === 'boolean' ? (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleUpdateParam(param.id, { value: true })}
                          className={`px-3 py-1 rounded font-mono text-xs font-bold cursor-pointer transition-colors border ${
                            param.value === true || String(param.value).toLowerCase() === 'true'
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-[#181A21] text-slate-400 border-[#2D3139] hover:text-white'
                          }`}
                        >
                          TRUE
                        </button>
                        <button
                          onClick={() => handleUpdateParam(param.id, { value: false })}
                          className={`px-3 py-1 rounded font-mono text-xs font-bold cursor-pointer transition-colors border ${
                            param.value === false || String(param.value).toLowerCase() === 'false'
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'bg-[#181A21] text-slate-400 border-[#2D3139] hover:text-white'
                          }`}
                        >
                          FALSE
                        </button>
                      </div>
                    ) : param.type === 'null' ? (
                      <div className="px-3 py-1 bg-slate-900 text-slate-400 rounded font-mono text-xs border border-slate-700 italic">
                        NULL (Always evaluated as SQL NULL)
                      </div>
                    ) : param.type === 'date' ? (
                      <input
                        type="date"
                        value={param.value || ''}
                        onChange={(e) => handleUpdateParam(param.id, { value: e.target.value })}
                        className="w-full bg-[#181A21] border border-[#2D3139] focus:border-purple-500 rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
                      />
                    ) : param.type === 'integer' ? (
                      <input
                        type="number"
                        step="1"
                        value={param.value ?? ''}
                        onChange={(e) => handleUpdateParam(param.id, { value: e.target.value })}
                        placeholder="Integer value"
                        className="w-full bg-[#181A21] border border-[#2D3139] focus:border-blue-500 rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
                      />
                    ) : param.type === 'decimal' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={param.value ?? ''}
                        onChange={(e) => handleUpdateParam(param.id, { value: e.target.value })}
                        placeholder="Decimal value (e.g. 99.95)"
                        className="w-full bg-[#181A21] border border-[#2D3139] focus:border-cyan-500 rounded px-2.5 py-1 text-xs text-white font-mono outline-none"
                      />
                    ) : (
                      <div className="relative w-full">
                        <input
                          type="text"
                          value={param.value ?? ''}
                          onChange={(e) => handleUpdateParam(param.id, { value: e.target.value })}
                          placeholder={`Enter ${param.type} value...`}
                          className="w-full bg-[#181A21] border border-[#2D3139] focus:border-purple-500 rounded px-2.5 py-1 text-xs text-white font-mono outline-none pr-6"
                        />
                        {param.value && (
                          <button
                            onClick={() => handleUpdateParam(param.id, { value: '' })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Formatted Preview Badge */}
                    <div
                      className="px-2 py-1 rounded bg-[#181A21] border border-[#282D38] font-mono text-[11px] text-amber-300 shrink-0 select-text max-w-[140px] truncate"
                      title={`Compiled SQL literal: ${formatParamValue(param.value, param.type)}`}
                    >
                      ➔ {formatParamValue(param.value, param.type)}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => onInsertPlaceholderIntoEditor(param.rawPlaceholder)}
                      className="p-1 text-slate-400 hover:text-purple-300 hover:bg-[#181A21] rounded cursor-pointer"
                      title="Insert placeholder in SQL editor"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteParam(param.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-[#181A21] rounded cursor-pointer"
                      title="Remove parameter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Compiled SQL Preview Footer Section */}
      {showPreview && parameters.length > 0 && (
        <div className="px-3 py-2.5 bg-[#0D0F14] border-t border-[#232731] flex flex-col space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-2 text-slate-400 font-mono">
              <Code2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-200">Compiled Executable SQL:</span>
              <span className="text-slate-500">
                ({substitutedCount} of {parameters.length} variables substituted)
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyCompiledSql}
                className="px-2 py-0.5 rounded bg-[#181A21] hover:bg-[#252B37] text-slate-300 hover:text-white border border-[#2D3139] flex items-center space-x-1 transition-colors cursor-pointer text-[10px]"
                title="Copy substituted SQL query to clipboard"
              >
                {copiedSql ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedSql ? 'Copied' : 'Copy Compiled SQL'}</span>
              </button>

              <button
                onClick={() => onRunCompiledQuery(compiledSql)}
                className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center space-x-1 transition-colors cursor-pointer shadow-sm text-[11px]"
                title="Execute compiled SQL query in database engine"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run with Parameters</span>
              </button>
            </div>
          </div>

          <div className="p-2 bg-[#08090D] border border-[#1F232B] rounded-md font-mono text-[11px] text-slate-200 max-h-24 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
            {compiledSql}
          </div>
        </div>
      )}
    </div>
  );
};
