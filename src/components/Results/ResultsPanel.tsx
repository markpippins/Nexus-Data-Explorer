import React, { useState } from 'react';
import {
  Table as TableIcon,
  MessageSquare,
  Network,
  History,
  AlertTriangle,
  CheckCircle2,
  Play,
  Copy,
  Clock,
  Layers,
  GitCompare,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { QueryExecutionResult, ExecutionPlanNode, SchemaObject } from '../../types/database';
import { DataGridTable } from './DataGridTable';
import { ResultSetDiffViewer } from '../DiffViewer/ResultSetDiffViewer';

interface ResultsPanelProps {
  activeResult: QueryExecutionResult | null;
  history: QueryExecutionResult[];
  onReRunQuery: (queryStr: string) => void;
  onOpenDiffTab?: (left?: QueryExecutionResult, right?: QueryExecutionResult) => void;
  activeConnectionId?: string;
  schemas?: SchemaObject[];
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  activeResult,
  history,
  onReRunQuery,
  onOpenDiffTab,
  activeConnectionId,
  schemas,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'grid' | 'messages' | 'plan' | 'history' | 'diff'>('grid');
  const [selectedHistoryForDiff, setSelectedHistoryForDiff] = useState<number[]>([]);
  const [diffLeftResult, setDiffLeftResult] = useState<QueryExecutionResult | null>(null);
  const [diffRightResult, setDiffRightResult] = useState<QueryExecutionResult | null>(null);

  const handleToggleHistorySelection = (idx: number) => {
    if (selectedHistoryForDiff.includes(idx)) {
      setSelectedHistoryForDiff(selectedHistoryForDiff.filter((i) => i !== idx));
    } else {
      if (selectedHistoryForDiff.length >= 2) {
        setSelectedHistoryForDiff([selectedHistoryForDiff[1], idx]);
      } else {
        setSelectedHistoryForDiff([...selectedHistoryForDiff, idx]);
      }
    }
  };

  const handleCompareSelectedHistory = () => {
    if (selectedHistoryForDiff.length === 2) {
      const left = history[selectedHistoryForDiff[0]];
      const right = history[selectedHistoryForDiff[1]];
      setDiffLeftResult(left);
      setDiffRightResult(right);
      setActiveSubTab('diff');
    }
  };

  const handleCompareWithActive = (historyItem: QueryExecutionResult) => {
    if (activeResult) {
      setDiffLeftResult(historyItem);
      setDiffRightResult(activeResult);
      setActiveSubTab('diff');
    }
  };

  return (
    <div className="h-72 bg-[#0F1115] border-t border-[#2D3139] flex flex-col font-mono text-xs select-none shrink-0 overflow-hidden">
      {/* Results Header Sub-tabs */}
      <div className="h-8 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSubTab('grid')}
            className={`px-3 py-1 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'grid'
                ? 'bg-[#2D3139] text-blue-400 font-medium'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Results Grid</span>
            {activeResult && activeResult.rows.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-950 text-blue-400 rounded text-[10px] font-bold">
                {activeResult.rows.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('diff')}
            className={`px-3 py-1 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'diff'
                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60 font-semibold'
                : 'text-[#94A3B8] hover:text-purple-300'
            }`}
            title="Side-by-side visual diff comparison between two result sets"
          >
            <GitCompare className="w-3.5 h-3.5 text-purple-400" />
            <span>Diff Viewer</span>
          </button>

          <button
            onClick={() => setActiveSubTab('messages')}
            className={`px-3 py-1 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'messages'
                ? 'bg-[#2D3139] text-blue-400 font-medium'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Messages & Logs</span>
            {activeResult?.status === 'error' && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('plan')}
            className={`px-3 py-1 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'plan'
                ? 'bg-[#2D3139] text-blue-400 font-medium'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-purple-400" />
            <span>Execution Plan</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1 rounded text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-[#2D3139] text-blue-400 font-medium'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>History ({history.length})</span>
          </button>
        </div>

        {/* Right Header Status or Full-Tab Button */}
        <div className="flex items-center space-x-3 text-[11px]">
          {activeSubTab === 'diff' && onOpenDiffTab && (
            <button
              onClick={() => onOpenDiffTab(diffLeftResult || undefined, diffRightResult || activeResult || undefined)}
              className="px-2 py-0.5 bg-[#2D3139] hover:bg-[#3B414D] text-purple-300 rounded flex items-center space-x-1 transition-colors cursor-pointer"
              title="Open Diff Viewer as dedicated full workspace tab"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Full Tab</span>
            </button>
          )}

          {/* Execution Summary Status Pill */}
          {activeResult && activeSubTab !== 'diff' && (
            <>
              <span className="text-[#64748B]">{activeResult.timestamp}</span>
              <div
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeResult.status === 'success'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                }`}
              >
                {activeResult.status === 'success' ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                )}
                <span>{activeResult.status === 'success' ? 'SUCCESS' : 'ERROR'}</span>
              </div>
              <span className="text-[#94A3B8]">
                <Clock className="w-3 h-3 inline mr-1 text-[#64748B]" />
                {activeResult.executionTimeMs} ms
              </span>
            </>
          )}
        </div>
      </div>

      {/* SubTab Content Body */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0F1115]">
        {activeSubTab === 'grid' && (
          activeResult ? (
            <DataGridTable result={activeResult} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#64748B] font-mono text-xs">
              <Play className="w-8 h-8 text-[#2D3139] mb-2" />
              <p>Execute a SQL query to view results here.</p>
              <p className="text-[11px] text-[#4B5563] mt-1">Press Ctrl+Enter or click 'Execute'</p>
            </div>
          )
        )}

        {activeSubTab === 'diff' && (
          <ResultSetDiffViewer
            initialLeftResult={diffLeftResult || history[1] || activeResult}
            initialRightResult={diffRightResult || activeResult || history[0]}
            history={history}
            activeConnectionId={activeConnectionId}
            schemas={schemas}
            isEmbedded={true}
          />
        )}

        {activeSubTab === 'messages' && (
          <div className="flex-1 p-4 overflow-auto custom-scrollbar font-mono text-xs space-y-3">
            {activeResult ? (
              <div className="space-y-2">
                <div className="p-3 bg-[#181A1F] rounded border border-[#2D3139]">
                  <p className="text-[#94A3B8] font-bold mb-1">Executed Statement:</p>
                  <pre className="text-blue-300 whitespace-pre-wrap">{activeResult.query}</pre>
                </div>

                {activeResult.status === 'error' ? (
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300">
                    <p className="font-bold flex items-center space-x-1 mb-1">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>PostgreSQL Execution Error:</span>
                    </p>
                    <p className="font-mono text-rose-200">{activeResult.error}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded text-emerald-300 space-y-1">
                    <p className="font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Statement Completed Successfully</span>
                    </p>
                    {activeResult.message && <p>{activeResult.message}</p>}
                    <p className="text-[#94A3B8] text-[11px]">
                      Rows fetched/affected: {activeResult.rowCount} | Latency: {activeResult.executionTimeMs} ms
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[#64748B]">No query execution logs recorded yet.</p>
            )}
          </div>
        )}

        {activeSubTab === 'plan' && (
          <div className="flex-1 p-4 overflow-auto custom-scrollbar font-mono text-xs">
            {activeResult?.plan ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#2D3139] text-[#94A3B8] text-[11px]">
                  <span>Query Execution Tree & Cost Estimates</span>
                  <span className="text-purple-400 font-bold">PostgreSQL EXPLAIN ANALYZE</span>
                </div>
                <PlanNodeVisualizer node={activeResult.plan} />
              </div>
            ) : (
              <p className="text-[#64748B] p-4">No execution plan available for this statement.</p>
            )}
          </div>
        )}

        {activeSubTab === 'history' && (
          <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-2 font-mono text-xs">
            {/* History selection actions banner */}
            {history.length > 1 && (
              <div className="p-2 bg-[#14171E] border border-purple-900/40 rounded flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[11px] text-slate-300">
                  <GitCompare className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    Select any 2 queries ({selectedHistoryForDiff.length}/2 selected) to compare in Diff Viewer:
                  </span>
                </div>
                <button
                  disabled={selectedHistoryForDiff.length !== 2}
                  onClick={handleCompareSelectedHistory}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    selectedHistoryForDiff.length === 2
                      ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-sm'
                      : 'bg-[#2D3139] text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Compare Selected (2)</span>
                </button>
              </div>
            )}

            {history.length === 0 ? (
              <p className="text-[#64748B] p-4 text-center">No query execution history yet.</p>
            ) : (
              history.map((item, idx) => {
                const isSelected = selectedHistoryForDiff.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded border flex items-center justify-between transition-colors group ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-800/80 text-purple-200'
                        : 'bg-[#181A1F] hover:bg-[#2D3139] border-[#2D3139]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 flex-1 min-w-0 mr-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleHistorySelection(idx)}
                        className="rounded bg-[#0F1115] border-[#3B414D] text-purple-600 focus:ring-0 cursor-pointer"
                        title="Select for Diff comparison"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 text-[10px] text-[#64748B] mb-0.5">
                          <span>{item.timestamp}</span>
                          <span className={item.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                            {item.status.toUpperCase()} ({item.executionTimeMs} ms, {item.rowCount} rows)
                          </span>
                        </div>
                        <p className="text-[#E2E8F0] truncate font-mono text-[11px]">{item.query}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {activeResult && activeResult !== item && (
                        <button
                          onClick={() => handleCompareWithActive(item)}
                          className="px-2 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 rounded text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                          title="Compare this history run with active result"
                        >
                          <GitCompare className="w-3 h-3" />
                          <span className="hidden sm:inline">Diff vs Active</span>
                        </button>
                      )}

                      <button
                        onClick={() => onReRunQuery(item.query)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Re-run</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Execution Plan Tree Render Helper
const PlanNodeVisualizer: React.FC<{ node: ExecutionPlanNode }> = ({ node }) => {
  return (
    <div className="p-3 bg-slate-900 border border-slate-800 rounded space-y-2">
      <div className="flex items-center justify-between text-slate-200">
        <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
          <Layers className="w-4 h-4 text-purple-400" />
          <span>{node.nodeType}</span>
          {node.relationName && <span className="text-amber-400">on {node.relationName}</span>}
        </span>
        <span className="text-[11px] text-slate-400">
          Cost: {node.startupCost}..{node.totalCost} | Rows: {node.planRows}
        </span>
      </div>

      {node.filter && (
        <p className="text-[11px] text-slate-400 font-mono">Filter: {node.filter}</p>
      )}

      {node.plans && node.plans.length > 0 && (
        <div className="ml-4 pl-3 border-l-2 border-purple-500/40 space-y-2 mt-2">
          {node.plans.map((subNode, idx) => (
            <PlanNodeVisualizer key={idx} node={subNode} />
          ))}
        </div>
      )}
    </div>
  );
};
