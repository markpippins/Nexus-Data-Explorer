import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GitCompare,
  Play,
  ArrowLeftRight,
  Sparkles,
  Download,
  Copy,
  Check,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Table as TableIcon,
  Columns,
  Maximize2,
  Minimize2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  Eye,
  FileText,
  HelpCircle,
  RefreshCw,
  X,
  Plus,
  Minus,
  FileSpreadsheet,
  FileCode,
  Zap,
} from 'lucide-react';
import {
  QueryExecutionResult,
  ResultSetDiff,
  DiffRow,
  DiffRowStatus,
  SchemaObject,
  DBConnection,
} from '../../types/database';
import { DBEngine } from '../../services/dbEngine';
import {
  computeResultSetDiff,
  exportDiffToCsv,
  generateMarkdownDiffReport,
  DIFF_PRESETS,
  DiffPreset,
} from '../../services/resultSetDiff';

interface ResultSetDiffViewerProps {
  initialLeftResult?: QueryExecutionResult | null;
  initialRightResult?: QueryExecutionResult | null;
  history?: QueryExecutionResult[];
  activeConnectionId?: string;
  schemas?: SchemaObject[];
  onOpenQueryInEditor?: (sql: string, title?: string) => void;
  isEmbedded?: boolean;
}

export const ResultSetDiffViewer: React.FC<ResultSetDiffViewerProps> = ({
  initialLeftResult,
  initialRightResult,
  history = [],
  activeConnectionId = '',
  schemas = [],
  onOpenQueryInEditor,
  isEmbedded = false,
}) => {
  // Query strings for Left and Right
  const [leftQuery, setLeftQuery] = useState<string>(
    initialLeftResult?.query || DIFF_PRESETS[0].leftQuery
  );
  const [rightQuery, setRightQuery] = useState<string>(
    initialRightResult?.query || DIFF_PRESETS[0].rightQuery
  );

  const [leftTitle, setLeftTitle] = useState<string>(
    initialLeftResult ? 'Active Result / Selected' : DIFF_PRESETS[0].leftTitle
  );
  const [rightTitle, setRightTitle] = useState<string>(
    initialRightResult ? 'Comparison Result' : DIFF_PRESETS[0].rightTitle
  );

  // Result state
  const [leftResult, setLeftResult] = useState<QueryExecutionResult | null>(
    initialLeftResult || null
  );
  const [rightResult, setRightResult] = useState<QueryExecutionResult | null>(
    initialRightResult || null
  );

  // Selected key column override
  const [selectedKeyColumn, setSelectedKeyColumn] = useState<string>('id');

  // Viewer options
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified' | 'schema'>('side-by-side');
  const [filterStatus, setFilterStatus] = useState<DiffRowStatus | 'all' | 'diffs'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncScroll, setSyncScroll] = useState(true);
  const [showSqlEditors, setShowSqlEditors] = useState(!isEmbedded);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showLeftHistoryMenu, setShowLeftHistoryMenu] = useState(false);
  const [showRightHistoryMenu, setShowRightHistoryMenu] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [inspectModalRow, setInspectModalRow] = useState<DiffRow | null>(null);

  // Scroll sync refs
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'left' | 'right' | null>(null);

  // Run queries if initial results are missing on mount
  useEffect(() => {
    if (!leftResult && activeConnectionId) {
      handleRunLeft();
    }
    if (!rightResult && activeConnectionId) {
      handleRunRight();
    }
  }, [activeConnectionId]);

  // Execute left query
  const handleRunLeft = (customSql?: string) => {
    if (!activeConnectionId) return;
    const sql = customSql || leftQuery;
    const res = DBEngine.executeQuery(activeConnectionId, sql);
    setLeftResult(res);
  };

  // Execute right query
  const handleRunRight = (customSql?: string) => {
    if (!activeConnectionId) return;
    const sql = customSql || rightQuery;
    const res = DBEngine.executeQuery(activeConnectionId, sql);
    setRightResult(res);
  };

  // Run both
  const handleRunBoth = () => {
    handleRunLeft();
    handleRunRight();
  };

  // Swap Left and Right
  const handleSwap = () => {
    const tempQuery = leftQuery;
    const tempTitle = leftTitle;
    const tempResult = leftResult;

    setLeftQuery(rightQuery);
    setLeftTitle(rightTitle);
    setLeftResult(rightResult);

    setRightQuery(tempQuery);
    setRightTitle(tempTitle);
    setRightResult(tempResult);
  };

  // Apply Preset
  const handleApplyPreset = (preset: DiffPreset) => {
    setLeftTitle(preset.leftTitle);
    setLeftQuery(preset.leftQuery);
    setRightTitle(preset.rightTitle);
    setRightQuery(preset.rightQuery);

    if (activeConnectionId) {
      const resL = DBEngine.executeQuery(activeConnectionId, preset.leftQuery);
      const resR = DBEngine.executeQuery(activeConnectionId, preset.rightQuery);
      setLeftResult(resL);
      setRightResult(resR);
    }
    setShowPresetsMenu(false);
  };

  // Compute Diff
  const diff: ResultSetDiff | null = useMemo(() => {
    if (!leftResult || !rightResult) return null;
    return computeResultSetDiff(leftResult, rightResult, selectedKeyColumn);
  }, [leftResult, rightResult, selectedKeyColumn]);

  // Synchronize key column selection if computed diff has a key
  useEffect(() => {
    if (diff?.keyColumn && selectedKeyColumn !== diff.keyColumn && !diff.availableKeyColumns.includes(selectedKeyColumn)) {
      setSelectedKeyColumn(diff.keyColumn);
    }
  }, [diff?.keyColumn]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!diff) return [];
    return diff.rows.filter((row) => {
      // Status filter
      if (filterStatus === 'diffs' && row.status === 'unchanged') return false;
      if (filterStatus !== 'all' && filterStatus !== 'diffs' && row.status !== filterStatus) return false;

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchKey = String(row.rowKey).toLowerCase().includes(term);
        const matchLeft = row.leftRow
          ? Object.values(row.leftRow).some((v) => String(v ?? '').toLowerCase().includes(term))
          : false;
        const matchRight = row.rightRow
          ? Object.values(row.rightRow).some((v) => String(v ?? '').toLowerCase().includes(term))
          : false;
        return matchKey || matchLeft || matchRight;
      }

      return true;
    });
  }, [diff, filterStatus, searchTerm]);

  // Synchronized Scrolling Handlers
  const handleLeftScroll = () => {
    if (!syncScroll) return;
    if (isScrollingRef.current === 'right') return;
    isScrollingRef.current = 'left';
    if (rightScrollRef.current && leftScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      rightScrollRef.current.scrollLeft = leftScrollRef.current.scrollLeft;
    }
    setTimeout(() => {
      isScrollingRef.current = null;
    }, 50);
  };

  const handleRightScroll = () => {
    if (!syncScroll) return;
    if (isScrollingRef.current === 'left') return;
    isScrollingRef.current = 'right';
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      leftScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
    }
    setTimeout(() => {
      isScrollingRef.current = null;
    }, 50);
  };

  // Copy Markdown Diff Report
  const handleCopyReport = () => {
    if (!diff) return;
    const report = generateMarkdownDiffReport(diff);
    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!diff) return;
    exportDiffToCsv(diff);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0F1115] text-slate-200 font-sans select-none overflow-hidden">
      {/* Top Header / Control Toolbar */}
      <div className="bg-[#181A1F] border-b border-[#2D3139] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left: Branding & Status */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 font-bold text-white">
            <GitCompare className="w-4 h-4 text-purple-400" />
            <span className="text-sm">Result Sets Visual Diff Viewer</span>
          </div>

          {diff && (
            <div className="flex items-center space-x-1.5 font-mono text-[11px]">
              <span
                className={`px-2 py-0.5 rounded-full font-semibold border ${
                  diff.stats.similarityPercentage === 100
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                    : 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                }`}
              >
                {diff.stats.similarityPercentage}% Match
              </span>

              <span className="text-slate-400">
                ({diff.stats.modifiedCount} modified, +{diff.stats.addedCount} added, -{diff.stats.removedCount} removed)
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions Bar */}
        <div className="flex items-center space-x-2">
          {/* Sample Presets */}
          <div className="relative">
            <button
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="px-2.5 py-1 bg-[#1F232B] hover:bg-[#2A303C] text-slate-200 hover:text-white border border-[#3B414D] rounded flex items-center space-x-1.5 text-xs transition-colors cursor-pointer"
              title="Load standard side-by-side SQL comparison scenarios"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sample Diffs</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showPresetsMenu && (
              <div className="absolute right-0 mt-1.5 w-80 bg-[#181A21] border border-[#3B414D] rounded-lg shadow-2xl p-2 z-50 text-xs font-sans">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#2D3139]">
                  <span className="font-bold text-white flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Comparison Scenarios</span>
                  </span>
                  <button
                    onClick={() => setShowPresetsMenu(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 custom-scrollbar">
                  {DIFF_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full text-left p-2 rounded hover:bg-[#252B37] transition-colors border border-transparent hover:border-purple-900/60 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 group-hover:text-purple-300">
                          {preset.title}
                        </span>
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-[#0F1115] text-slate-400 font-mono">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toggle SQL Editors */}
          <button
            onClick={() => setShowSqlEditors(!showSqlEditors)}
            className={`px-2.5 py-1 rounded border flex items-center space-x-1.5 text-xs transition-colors cursor-pointer ${
              showSqlEditors
                ? 'bg-purple-950/70 border-purple-800 text-purple-300'
                : 'bg-[#1F232B] border-[#3B414D] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle SQL Query Input Editors for Left and Right result sets"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SQL Query Editors</span>
          </button>

          {/* Swap A & B */}
          <button
            onClick={handleSwap}
            className="px-2.5 py-1 bg-[#1F232B] hover:bg-[#2A303C] text-slate-200 hover:text-white border border-[#3B414D] rounded flex items-center space-x-1.5 text-xs transition-colors cursor-pointer"
            title="Swap Left (Baseline) and Right (Comparison)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Swap Sets</span>
          </button>

          {/* Re-run Both */}
          <button
            onClick={handleRunBoth}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            title="Re-execute both queries simultaneously"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run Both</span>
          </button>

          {/* Export Report */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handleExportCsv}
              className="p-1.5 bg-[#1F232B] hover:bg-[#2A303C] text-slate-300 hover:text-white border border-[#3B414D] rounded cursor-pointer transition-colors"
              title="Export Diff to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            <button
              onClick={handleCopyReport}
              className="p-1.5 bg-[#1F232B] hover:bg-[#2A303C] text-slate-300 hover:text-white border border-[#3B414D] rounded cursor-pointer transition-colors"
              title="Copy Markdown Summary Report"
            >
              {copiedReport ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible SQL Query Editors for Left & Right */}
      {showSqlEditors && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2.5 bg-[#12151B] border-b border-[#2D3139] shrink-0 font-mono text-xs">
          {/* Left Query Editor Box */}
          <div className="p-2.5 bg-[#0F1115] border border-blue-900/40 rounded-lg flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="font-bold text-blue-400 uppercase tracking-wide text-[11px]">
                  Result Set A (Baseline)
                </span>
                <input
                  type="text"
                  value={leftTitle}
                  onChange={(e) => setLeftTitle(e.target.value)}
                  className="bg-transparent border-b border-blue-900/60 focus:border-blue-400 text-slate-200 text-xs px-1 outline-none max-w-[180px]"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                {/* History selector */}
                {history.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLeftHistoryMenu(!showLeftHistoryMenu)}
                      className="px-2 py-0.5 bg-[#181A21] hover:bg-[#252B37] text-slate-300 border border-[#2D3139] rounded text-[10px] flex items-center space-x-1"
                    >
                      <span>History</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {showLeftHistoryMenu && (
                      <div className="absolute right-0 mt-1 w-72 bg-[#181A21] border border-[#3B414D] rounded-lg shadow-xl p-1 z-50 max-h-48 overflow-y-auto">
                        {history.map((h, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setLeftQuery(h.query);
                              setLeftResult(h);
                              setLeftTitle(`History Run #${i + 1}`);
                              setShowLeftHistoryMenu(false);
                            }}
                            className="w-full text-left p-1.5 rounded hover:bg-[#252B37] text-[11px] truncate block text-slate-300"
                          >
                            <span className="text-slate-500 font-mono text-[10px] block">
                              {h.timestamp} ({h.rowCount} rows)
                            </span>
                            {h.query}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleRunLeft()}
                  className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Execute A</span>
                </button>
              </div>
            </div>

            <textarea
              value={leftQuery}
              onChange={(e) => setLeftQuery(e.target.value)}
              placeholder="Enter SQL for Result Set A..."
              rows={3}
              className="w-full bg-[#08090C] border border-[#262A33] focus:border-blue-500 rounded p-2 text-[11px] text-slate-200 outline-none font-mono resize-none leading-relaxed"
            />
          </div>

          {/* Right Query Editor Box */}
          <div className="p-2.5 bg-[#0F1115] border border-purple-900/40 rounded-lg flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="font-bold text-purple-400 uppercase tracking-wide text-[11px]">
                  Result Set B (Comparison)
                </span>
                <input
                  type="text"
                  value={rightTitle}
                  onChange={(e) => setRightTitle(e.target.value)}
                  className="bg-transparent border-b border-purple-900/60 focus:border-purple-400 text-slate-200 text-xs px-1 outline-none max-w-[180px]"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                {/* History selector */}
                {history.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowRightHistoryMenu(!showRightHistoryMenu)}
                      className="px-2 py-0.5 bg-[#181A21] hover:bg-[#252B37] text-slate-300 border border-[#2D3139] rounded text-[10px] flex items-center space-x-1"
                    >
                      <span>History</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {showRightHistoryMenu && (
                      <div className="absolute right-0 mt-1 w-72 bg-[#181A21] border border-[#3B414D] rounded-lg shadow-xl p-1 z-50 max-h-48 overflow-y-auto">
                        {history.map((h, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setRightQuery(h.query);
                              setRightResult(h);
                              setRightTitle(`History Run #${i + 1}`);
                              setShowRightHistoryMenu(false);
                            }}
                            className="w-full text-left p-1.5 rounded hover:bg-[#252B37] text-[11px] truncate block text-slate-300"
                          >
                            <span className="text-slate-500 font-mono text-[10px] block">
                              {h.timestamp} ({h.rowCount} rows)
                            </span>
                            {h.query}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleRunRight()}
                  className="px-2.5 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Execute B</span>
                </button>
              </div>
            </div>

            <textarea
              value={rightQuery}
              onChange={(e) => setRightQuery(e.target.value)}
              placeholder="Enter SQL for Result Set B..."
              rows={3}
              className="w-full bg-[#08090C] border border-[#262A33] focus:border-purple-500 rounded p-2 text-[11px] text-slate-200 outline-none font-mono resize-none leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* Secondary Diff Filter & Statistics Bar */}
      <div className="px-3 py-2 bg-[#14171E] border-b border-[#262A33] flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
        {/* Left Group: Key Column + View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Key Column Selector */}
          <div className="flex items-center space-x-1.5 bg-[#0F1115] border border-[#2D3139] rounded px-2 py-1 font-mono text-[11px]">
            <span className="text-slate-400">Match Key:</span>
            <select
              value={selectedKeyColumn}
              onChange={(e) => setSelectedKeyColumn(e.target.value)}
              className="bg-transparent text-purple-300 font-bold focus:outline-none cursor-pointer"
            >
              {diff?.availableKeyColumns.map((col) => (
                <option key={col} value={col} className="bg-[#181A21] text-slate-200">
                  {col === '__index__' ? 'Row Index (Sequential #)' : `Column: ${col}`}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#0F1115] border border-[#2D3139] rounded p-0.5">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Side-by-side split comparison table"
            >
              <TableIcon className="w-3 h-3" />
              <span>Side-by-Side</span>
            </button>

            <button
              onClick={() => setViewMode('unified')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Unified consolidated diff list"
            >
              <FileText className="w-3 h-3" />
              <span>Unified Diff</span>
            </button>

            <button
              onClick={() => setViewMode('schema')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer ${
                viewMode === 'schema'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Column & Schema comparison breakdown"
            >
              <Columns className="w-3 h-3" />
              <span>Columns Matrix</span>
            </button>
          </div>

          {/* Sync Scroll Toggle */}
          {viewMode === 'side-by-side' && (
            <label
              className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer px-2 py-1 bg-[#0F1115] rounded border border-[#2D3139]"
              title="Synchronize vertical and horizontal scrolling across both tables"
            >
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
                className="rounded bg-[#181A21] border-[#3B414D] text-blue-600 focus:ring-0 w-3 h-3"
              />
              <span>Sync Scroll</span>
            </label>
          )}
        </div>

        {/* Right Group: Status Filter Buttons + Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1 bg-[#0F1115] border border-[#2D3139] rounded p-0.5 font-mono text-[11px]">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-[#252B37] text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({diff?.rows.length || 0})
            </button>

            <button
              onClick={() => setFilterStatus('diffs')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center space-x-1 ${
                filterStatus === 'diffs'
                  ? 'bg-amber-950/90 text-amber-300 font-bold border border-amber-800/60'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <span>Diffs Only</span>
              <span className="px-1 bg-amber-950 text-amber-300 rounded text-[9px]">
                {(diff?.stats.modifiedCount || 0) +
                  (diff?.stats.addedCount || 0) +
                  (diff?.stats.removedCount || 0)}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('modified')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterStatus === 'modified'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              Mod ({diff?.stats.modifiedCount || 0})
            </button>

            <button
              onClick={() => setFilterStatus('added')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterStatus === 'added'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              +{diff?.stats.addedCount || 0}
            </button>

            <button
              onClick={() => setFilterStatus('removed')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                filterStatus === 'removed'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              -{diff?.stats.removedCount || 0}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search diff rows..."
              className="bg-[#0F1115] border border-[#2D3139] focus:border-blue-500 rounded pl-7 pr-2 py-1 text-xs text-slate-200 outline-none w-36 sm:w-48 font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Diff Content Container */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {!diff ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 font-mono text-xs">
            <GitCompare className="w-10 h-10 text-[#2D3139] mb-3" />
            <p>Execute or select two queries above to calculate visual diff.</p>
          </div>
        ) : viewMode === 'side-by-side' ? (
          /* Side-by-Side Split View */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#262A33] overflow-hidden">
            {/* Left Result Set Table */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0A0C10]">
              <div className="px-3 py-1.5 bg-[#12151B] border-b border-[#262A33] flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="font-bold text-blue-300 truncate max-w-[200px]">{leftTitle}</span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    ({leftResult?.rows.length || 0} rows, {leftResult?.executionTimeMs || 0} ms)
                  </span>
                </div>
              </div>

              <div
                ref={leftScrollRef}
                onScroll={handleLeftScroll}
                className="flex-1 overflow-auto custom-scrollbar font-mono text-xs"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#161922] border-b border-[#2D3139] z-10 text-[11px] text-slate-300">
                    <tr>
                      <th className="p-2 w-10 text-center text-slate-500 border-r border-[#262A33]">#</th>
                      <th className="p-2 w-20 text-slate-400 border-r border-[#262A33]">Status</th>
                      {diff.columns.allColumns.map((col) => (
                        <th
                          key={col}
                          className={`p-2 font-semibold border-r border-[#262A33] whitespace-nowrap ${
                            col === diff.keyColumn
                              ? 'text-purple-300 bg-purple-950/40'
                              : diff.columns.leftOnlyColumns.includes(col)
                              ? 'text-blue-400 bg-blue-950/30'
                              : diff.columns.rightOnlyColumns.includes(col)
                              ? 'text-slate-600 line-through'
                              : 'text-slate-300'
                          }`}
                        >
                          {col}
                          {col === diff.keyColumn && <span className="ml-1 text-[9px] text-purple-400">🔑</span>}
                          {diff.columns.leftOnlyColumns.includes(col) && (
                            <span className="ml-1 text-[9px] text-blue-400 font-normal">[Left Only]</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D212A]">
                    {filteredRows.map((row, idx) => {
                      const isRemoved = row.status === 'removed';
                      const isModified = row.status === 'modified';
                      const isAdded = row.status === 'added';

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            isRemoved
                              ? 'bg-rose-950/30 hover:bg-rose-950/50 text-rose-200'
                              : isModified
                              ? 'bg-amber-950/20 hover:bg-amber-950/40 text-slate-200'
                              : isAdded
                              ? 'bg-[#08090C] opacity-40 italic text-slate-600'
                              : 'hover:bg-[#161922] text-slate-300'
                          }`}
                        >
                          <td className="p-2 text-center text-slate-500 border-r border-[#1D212A] text-[10px]">
                            {row.leftRowIndex !== undefined ? row.leftRowIndex + 1 : '-'}
                          </td>
                          <td className="p-2 border-r border-[#1D212A]">
                            <StatusBadge status={row.status} />
                          </td>
                          {diff.columns.allColumns.map((col) => {
                            const cell = row.cells[col];
                            const isCellChanged = cell?.isChanged;

                            if (isAdded) {
                              return (
                                <td key={col} className="p-2 border-r border-[#1D212A] text-slate-700 italic">
                                  —
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col}
                                className={`p-2 border-r border-[#1D212A] whitespace-nowrap max-w-[200px] truncate ${
                                  isCellChanged && isModified
                                    ? 'bg-amber-950/60 text-amber-200 font-medium'
                                    : ''
                                }`}
                                title={String(cell?.leftValue ?? 'NULL')}
                              >
                                {renderFormattedCellValue(cell?.leftValue)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Result Set Table */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0A0C10]">
              <div className="px-3 py-1.5 bg-[#12151B] border-b border-[#262A33] flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="font-bold text-purple-300 truncate max-w-[200px]">{rightTitle}</span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    ({rightResult?.rows.length || 0} rows, {rightResult?.executionTimeMs || 0} ms)
                  </span>
                </div>

                <span className="text-[11px] font-mono text-emerald-400 font-medium">
                  {filteredRows.length} displayed rows
                </span>
              </div>

              <div
                ref={rightScrollRef}
                onScroll={handleRightScroll}
                className="flex-1 overflow-auto custom-scrollbar font-mono text-xs"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#161922] border-b border-[#2D3139] z-10 text-[11px] text-slate-300">
                    <tr>
                      <th className="p-2 w-10 text-center text-slate-500 border-r border-[#262A33]">#</th>
                      <th className="p-2 w-20 text-slate-400 border-r border-[#262A33]">Status</th>
                      {diff.columns.allColumns.map((col) => (
                        <th
                          key={col}
                          className={`p-2 font-semibold border-r border-[#262A33] whitespace-nowrap ${
                            col === diff.keyColumn
                              ? 'text-purple-300 bg-purple-950/40'
                              : diff.columns.rightOnlyColumns.includes(col)
                              ? 'text-purple-400 bg-purple-950/30'
                              : diff.columns.leftOnlyColumns.includes(col)
                              ? 'text-slate-600 line-through'
                              : 'text-slate-300'
                          }`}
                        >
                          {col}
                          {col === diff.keyColumn && <span className="ml-1 text-[9px] text-purple-400">🔑</span>}
                          {diff.columns.rightOnlyColumns.includes(col) && (
                            <span className="ml-1 text-[9px] text-purple-400 font-normal">[Right Only]</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D212A]">
                    {filteredRows.map((row, idx) => {
                      const isRemoved = row.status === 'removed';
                      const isModified = row.status === 'modified';
                      const isAdded = row.status === 'added';

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            isAdded
                              ? 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-200'
                              : isModified
                              ? 'bg-amber-950/20 hover:bg-amber-950/40 text-slate-200'
                              : isRemoved
                              ? 'bg-[#08090C] opacity-40 italic text-slate-600'
                              : 'hover:bg-[#161922] text-slate-300'
                          }`}
                        >
                          <td className="p-2 text-center text-slate-500 border-r border-[#1D212A] text-[10px]">
                            {row.rightRowIndex !== undefined ? row.rightRowIndex + 1 : '-'}
                          </td>
                          <td className="p-2 border-r border-[#1D212A]">
                            <StatusBadge status={row.status} />
                          </td>
                          {diff.columns.allColumns.map((col) => {
                            const cell = row.cells[col];
                            const isCellChanged = cell?.isChanged;

                            if (isRemoved) {
                              return (
                                <td key={col} className="p-2 border-r border-[#1D212A] text-slate-700 italic">
                                  —
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col}
                                className={`p-2 border-r border-[#1D212A] whitespace-nowrap max-w-[200px] truncate ${
                                  isCellChanged && isModified
                                    ? 'bg-emerald-950/60 text-emerald-300 font-medium'
                                    : ''
                                }`}
                                title={String(cell?.rightValue ?? 'NULL')}
                              >
                                {renderFormattedCellValue(cell?.rightValue)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : viewMode === 'unified' ? (
          /* Unified Consolidated Diff List */
          <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-2 bg-[#0A0C10] font-mono text-xs">
            {filteredRows.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No rows match current filter.</p>
            ) : (
              filteredRows.map((row) => (
                <div
                  key={row.id}
                  className={`p-2.5 rounded-lg border flex flex-col space-y-2 ${
                    row.status === 'added'
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                      : row.status === 'removed'
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                      : row.status === 'modified'
                      ? 'bg-amber-950/20 border-amber-900/40 text-slate-200'
                      : 'bg-[#12151B] border-[#262A33] text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={row.status} />
                      <span className="font-bold text-slate-200">{row.rowKey}</span>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      {row.changedColumnCount > 0 && `${row.changedColumnCount} columns changed`}
                    </span>
                  </div>

                  {row.status === 'modified' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-[#262A33]">
                      {diff.columns.allColumns.map((col) => {
                        const cell = row.cells[col];
                        if (!cell?.isChanged) return null;
                        return (
                          <div
                            key={col}
                            className="p-1.5 rounded bg-[#08090C] border border-amber-900/40 flex flex-col space-y-0.5 text-[11px]"
                          >
                            <span className="text-slate-400 font-semibold">{col}:</span>
                            <div className="flex items-center space-x-1.5 text-xs">
                              <span className="text-rose-400 line-through bg-rose-950/60 px-1 rounded">
                                {renderFormattedCellValue(cell.leftValue)}
                              </span>
                              <span className="text-slate-500">➔</span>
                              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1 rounded">
                                {renderFormattedCellValue(cell.rightValue)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {row.status === 'added' && row.rightRow && (
                    <pre className="p-2 bg-[#08090C] rounded border border-emerald-900/40 text-[11px] text-emerald-300 overflow-x-auto">
                      {JSON.stringify(row.rightRow, null, 2)}
                    </pre>
                  )}

                  {row.status === 'removed' && row.leftRow && (
                    <pre className="p-2 bg-[#08090C] rounded border border-rose-900/40 text-[11px] text-rose-300 overflow-x-auto">
                      {JSON.stringify(row.leftRow, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Columns & Schema Breakdown Matrix */
          <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-[#0A0C10] font-sans text-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Common Columns */}
              <div className="p-3 bg-[#12151B] border border-[#2D3139] rounded-lg space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#262A33]">
                  <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Common Columns ({diff.columns.commonColumns.length})</span>
                  </span>
                </div>
                <div className="space-y-1">
                  {diff.columns.commonColumns.map((col) => (
                    <div
                      key={col}
                      className="p-1.5 bg-[#0F1115] rounded border border-[#262A33] font-mono text-xs flex items-center justify-between"
                    >
                      <span className="text-slate-300">{col}</span>
                      {col === diff.keyColumn && (
                        <span className="px-1.5 py-0.2 bg-purple-950 text-purple-300 rounded text-[10px] font-bold">
                          Primary Key
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Left Only Columns */}
              <div className="p-3 bg-[#12151B] border border-blue-900/40 rounded-lg space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#262A33]">
                  <span className="font-bold text-blue-300 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-blue-400" />
                    <span>Baseline Only Columns ({diff.columns.leftOnlyColumns.length})</span>
                  </span>
                </div>
                {diff.columns.leftOnlyColumns.length === 0 ? (
                  <p className="text-slate-500 text-xs italic">No baseline-specific columns.</p>
                ) : (
                  <div className="space-y-1">
                    {diff.columns.leftOnlyColumns.map((col) => (
                      <div
                        key={col}
                        className="p-1.5 bg-[#0F1115] rounded border border-blue-900/50 font-mono text-xs text-blue-300"
                      >
                        {col}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Only Columns */}
              <div className="p-3 bg-[#12151B] border border-purple-900/40 rounded-lg space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#262A33]">
                  <span className="font-bold text-purple-300 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-purple-400" />
                    <span>Comparison Only Columns ({diff.columns.rightOnlyColumns.length})</span>
                  </span>
                </div>
                {diff.columns.rightOnlyColumns.length === 0 ? (
                  <p className="text-slate-500 text-xs italic">No comparison-specific columns.</p>
                ) : (
                  <div className="space-y-1">
                    {diff.columns.rightOnlyColumns.map((col) => (
                      <div
                        key={col}
                        className="p-1.5 bg-[#0F1115] rounded border border-purple-900/50 font-mono text-xs text-purple-300"
                      >
                        {col}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      {diff && (
        <div className="px-3 py-1.5 bg-[#0D0F14] border-t border-[#262A33] flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
          <div className="flex items-center space-x-4">
            <span>
              Baseline: <b className="text-blue-400">{diff.stats.totalLeftRows}</b> rows
            </span>
            <span>
              Comparison: <b className="text-purple-400">{diff.stats.totalRightRows}</b> rows
            </span>
            <span>
              Delta:{' '}
              <b
                className={
                  diff.stats.rowDelta > 0
                    ? 'text-emerald-400'
                    : diff.stats.rowDelta < 0
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }
              >
                {diff.stats.rowDelta >= 0 ? `+${diff.stats.rowDelta}` : diff.stats.rowDelta}
              </b>
            </span>
            <span>
              Latency:{' '}
              <b className="text-slate-300">{diff.stats.leftLatencyMs}ms</b> vs{' '}
              <b className="text-slate-300">{diff.stats.rightLatencyMs}ms</b>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500">FluxDB Relational Diff Engine</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper badge component
const StatusBadge: React.FC<{ status: DiffRowStatus }> = ({ status }) => {
  switch (status) {
    case 'added':
      return (
        <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 uppercase">
          + Added
        </span>
      );
    case 'removed':
      return (
        <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-950 text-rose-400 border border-rose-800/60 uppercase">
          - Removed
        </span>
      );
    case 'modified':
      return (
        <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-800/60 uppercase">
          ~ Mod
        </span>
      );
    case 'unchanged':
    default:
      return (
        <span className="px-1.5 py-0.2 rounded font-mono text-[9px] text-slate-500 bg-[#161922] uppercase">
          Equal
        </span>
      );
  }
};

// Formatted cell value renderer
function renderFormattedCellValue(val: any): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-slate-600 italic">NULL</span>;
  }
  if (typeof val === 'boolean') {
    return (
      <span className={val ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
        {val ? 'TRUE' : 'FALSE'}
      </span>
    );
  }
  if (typeof val === 'number') {
    return <span className="text-cyan-400">{val}</span>;
  }
  if (typeof val === 'object') {
    return <span className="text-amber-400">{JSON.stringify(val)}</span>;
  }
  return String(val);
}
