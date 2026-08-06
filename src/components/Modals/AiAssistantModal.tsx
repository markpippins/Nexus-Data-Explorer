import React, { useState } from 'react';
import { Sparkles, X, Send, ArrowRight, Code, AlertTriangle, Check } from 'lucide-react';
import { SchemaObject } from '../../types/database';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySql: (sql: string) => void;
  schemas: SchemaObject[];
  currentQuery: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplySql,
  schemas,
  currentQuery,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ reply: string; sql: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async (taskType = 'generate') => {
    if (!prompt.trim() && taskType === 'generate') return;
    setLoading(true);
    setError(null);

    const schemaSummary = schemas.map((s) => ({
      schema: s.name,
      tables: s.tables.map((t) => ({ name: t.name, cols: t.columns.map((c) => `${c.name} (${c.type})`) })),
    }));

    try {
      const res = await fetch('/api/ai/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt || (taskType === 'explain' ? 'Explain this query' : 'Fix or optimize this query'),
          task: taskType,
          schemaInfo: schemaSummary,
          currentQuery,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI generation failed.');
      }
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Error communicating with Gemini AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#1F232B] border border-[#3B414D] rounded-xl shadow-2xl overflow-hidden font-mono text-sm flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#181A1F] border-b border-[#2D3139] flex items-center justify-between text-[#E2E8F0] shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-[#E2E8F0]">
              Gemini AI SQL Architect
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#2D3139] rounded text-[#94A3B8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          <div className="p-3 bg-purple-950/40 border border-purple-800/50 rounded-lg text-purple-200 text-[11px] space-y-1">
            <p className="font-bold text-purple-300">Natural Language to PostgreSQL Transformer</p>
            <p className="text-[#94A3B8]">
              Ask Gemini to write queries, join tables across schemas, optimize performance, or explain complex logic.
            </p>
          </div>

          {/* Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#94A3B8] font-bold">Your Prompt / Requirements</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Find top 5 customers by total order spend in 2026, including their loyalty tier..."
              className="w-full h-24 bg-[#0F1115] border border-[#2D3139] rounded-lg p-3 text-[#E2E8F0] outline-none focus:border-purple-500 font-mono leading-relaxed placeholder:text-[#64748B]"
            />
          </div>

          {/* Quick Action Chips */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSend('generate')}
              disabled={loading || !prompt.trim()}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded shadow flex items-center space-x-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Generate SQL</span>
            </button>

            {currentQuery && (
              <>
                <button
                  onClick={() => handleSend('explain')}
                  disabled={loading}
                  className="px-2.5 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded font-medium border border-[#3B414D] transition-colors"
                >
                  Explain Current Query
                </button>
                <button
                  onClick={() => handleSend('optimize')}
                  disabled={loading}
                  className="px-2.5 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded font-medium border border-[#3B414D] transition-colors"
                >
                  Optimize Current Query
                </button>
              </>
            )}
          </div>

          {loading && (
            <div className="p-4 bg-[#0F1115] rounded border border-[#2D3139] text-center text-[#94A3B8] space-y-2">
              <Sparkles className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
              <p>Analyzing schema & synthesizing PostgreSQL query...</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {response && (
            <div className="space-y-3 p-4 bg-[#0F1115] border border-[#2D3139] rounded-lg">
              <p className="text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">{response.reply}</p>

              {response.sql && (
                <div className="pt-2 border-t border-[#2D3139] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                      <Code className="w-3.5 h-3.5" />
                      <span>Extracted SQL Query</span>
                    </span>
                    <button
                      onClick={() => {
                        onApplySql(response.sql!);
                        onClose();
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded flex items-center space-x-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Insert into Editor</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-[#181A1F] border border-[#2D3139] rounded text-blue-300 overflow-x-auto whitespace-pre-wrap">
                    {response.sql}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
