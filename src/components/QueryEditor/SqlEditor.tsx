import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  AlignLeft,
  Sparkles,
  Bookmark,
  Trash2,
  Code,
  Zap,
  Check,
  Copy
} from 'lucide-react';
import { SchemaObject } from '../../types/database';

interface SqlEditorProps {
  query: string;
  onChangeQuery: (newQuery: string) => void;
  onRunQuery: (queryToRun?: string) => void;
  onFormatQuery: () => void;
  onOpenAiAssistant: () => void;
  onSaveSnippet: () => void;
  schemas: SchemaObject[];
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN',
  'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'ADD COLUMN',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT', 'COUNT', 'SUM', 'AVG',
  'MAX', 'MIN', 'COALESCE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'AND', 'OR', 'NOT',
  'IN', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL', 'DISTINCT', 'RETURNING', 'EXISTS'
];

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onChangeQuery,
  onRunQuery,
  onFormatQuery,
  onOpenAiAssistant,
  onSaveSnippet,
  schemas,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ label: string; type: 'keyword' | 'table' | 'column' }[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lines = query.split('\n');

  // Sync scrolling between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to Run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRunQuery(selectedText || query);
      return;
    }

    // Ctrl+Shift+F or Cmd+Shift+F to Format
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      onFormatQuery();
      return;
    }

    // Handle suggestion menu navigation
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[activeSuggestionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
  };

  const handleTextSelect = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        setSelectedText(query.substring(start, end));
      } else {
        setSelectedText('');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChangeQuery(val);

    // Compute autocomplete suggestions
    const cursorIndex = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorIndex);
    const words = textBeforeCursor.split(/[\s,();]+/);
    const currentWord = words[words.length - 1] || '';

    if (currentWord.length >= 2) {
      const lower = currentWord.toLowerCase();
      const matchedKeywords = SQL_KEYWORDS.filter((k) => k.toLowerCase().startsWith(lower)).map((k) => ({
        label: k,
        type: 'keyword' as const,
      }));

      const matchedTables: { label: string; type: 'table' }[] = [];
      const matchedColumns: { label: string; type: 'column' }[] = [];

      schemas.forEach((s) => {
        s.tables.forEach((t) => {
          if (t.name.toLowerCase().startsWith(lower)) {
            matchedTables.push({ label: t.name, type: 'table' });
          }
          t.columns.forEach((c) => {
            if (c.name.toLowerCase().startsWith(lower)) {
              matchedColumns.push({ label: `${c.name} (${t.name})`, type: 'column' });
            }
          });
        });
      });

      const combined = [...matchedKeywords.slice(0, 5), ...matchedTables.slice(0, 5), ...matchedColumns.slice(0, 5)];

      if (combined.length > 0) {
        setSuggestions(combined);
        setShowSuggestions(true);
        setActiveSuggestionIdx(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (suggestion?: { label: string; type: string }) => {
    if (!suggestion || !textareaRef.current) return;
    const val = query;
    const cursorIndex = textareaRef.current.selectionStart;
    const textBefore = val.substring(0, cursorIndex);
    const textAfter = val.substring(cursorIndex);

    const words = textBefore.split(/([\s,();]+)/);
    // replace last word
    let inserted = suggestion.label;
    if (suggestion.type === 'column') {
      inserted = suggestion.label.split(' ')[0];
    }

    words[words.length - 1] = inserted;
    const newText = words.join('') + textAfter;

    onChangeQuery(newText);
    setShowSuggestions(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-xs select-text overflow-hidden relative">
      {/* Editor Top Toolbar */}
      <div className="h-9 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRunQuery(selectedText || query)}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow-sm flex items-center space-x-1 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{selectedText ? 'Run Selection' : 'Run Query'}</span>
          </button>

          <button
            onClick={onFormatQuery}
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Format</span>
          </button>

          <button
            onClick={onOpenAiAssistant}
            className="px-2 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded flex items-center space-x-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>AI Optimize</span>
          </button>

          <button
            onClick={onSaveSnippet}
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Save</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139] rounded flex items-center space-x-1 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => onChangeQuery('')}
            title="Clear Editor"
            className="p-1 text-[#94A3B8] hover:text-rose-400 hover:bg-[#2D3139] rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="flex-1 flex relative overflow-hidden bg-[#0F1115]">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="w-12 bg-[#181A1F] text-[#64748B] border-r border-[#2D3139] py-3 text-right pr-3 select-none overflow-hidden shrink-0 font-mono text-xs leading-5"
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area Input */}
        <div className="flex-1 relative overflow-hidden">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSelect={handleTextSelect}
            onScroll={handleScroll}
            spellCheck={false}
            placeholder="-- Write PostgreSQL query here (e.g. SELECT * FROM public.customers;)"
            className="w-full h-full bg-transparent text-[#E2E8F0] p-3 outline-none resize-none font-mono text-xs leading-5 caret-blue-500 tab-size-2 leading-relaxed"
          />

          {/* Autocomplete Popup */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-12 left-6 z-50 w-64 bg-[#1F232B] border border-[#3B414D] rounded shadow-2xl py-1 text-xs font-mono">
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-[#94A3B8] border-b border-[#2D3139] flex justify-between">
                <span>Autocomplete Suggestions</span>
                <span>(Tab / Enter)</span>
              </div>
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => applySuggestion(item)}
                  className={`px-3 py-1.5 cursor-pointer flex items-center justify-between ${
                    idx === activeSuggestionIdx ? 'bg-blue-600 text-white' : 'hover:bg-[#2D3139] text-[#E2E8F0]'
                  }`}
                >
                  <span className="font-medium truncate">{item.label}</span>
                  <span
                    className={`text-[9px] px-1 rounded uppercase font-bold ${
                      item.type === 'keyword'
                        ? 'bg-blue-900/80 text-blue-300'
                        : item.type === 'table'
                        ? 'bg-emerald-900/80 text-emerald-300'
                        : 'bg-purple-900/80 text-purple-300'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
