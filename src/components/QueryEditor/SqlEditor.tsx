import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import {
  Play,
  AlignLeft,
  Sparkles,
  Bookmark,
  Trash2,
  Code,
  Check,
  Copy,
  Map,
  Terminal,
  Database
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
  'IN', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL', 'DISTINCT', 'RETURNING', 'EXISTS',
  'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW', 'UNION', 'UNION ALL', 'EXCEPT',
  'INTERSECT', 'WITH', 'RECURSIVE', 'CAST', 'NULLIF', 'NOW()', 'CURRENT_TIMESTAMP'
];

let sqlCompletionRegistered = false;

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
  const [copied, setCopied] = useState(false);
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const schemasRef = useRef<SchemaObject[]>(schemas);

  useEffect(() => {
    schemasRef.current = schemas;
  }, [schemas]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Define our custom Postgres Dark theme matching #0F1115 / #181A1F
    monaco.editor.defineTheme('postgres-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: '60a5fa', fontStyle: 'bold' },
        { token: 'keyword', foreground: '60a5fa', fontStyle: 'bold' },
        { token: 'string.sql', foreground: '34d399' },
        { token: 'string', foreground: '34d399' },
        { token: 'number.sql', foreground: 'fbbf24' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'comment.sql', foreground: '64748b', fontStyle: 'italic' },
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'operator.sql', foreground: '93c5fd' },
        { token: 'operator', foreground: '93c5fd' },
        { token: 'type.sql', foreground: 'c084fc' },
        { token: 'type', foreground: 'c084fc' },
        { token: 'predefined.sql', foreground: 'f472b6' },
      ],
      colors: {
        'editor.background': '#0F1115',
        'editor.foreground': '#E2E8F0',
        'editorGutter.background': '#181A1F',
        'editorLineNumber.foreground': '#64748B',
        'editorLineNumber.activeForeground': '#E2E8F0',
        'editor.selectionBackground': '#2D3139',
        'editor.inactiveSelectionBackground': '#1F232B',
        'editorCursor.foreground': '#3B82F6',
        'editor.lineHighlightBackground': '#181A1F66',
        'editorIndentGuide.background': '#2D3139',
        'editorIndentGuide.activeBackground': '#3B414D',
        'editorSuggestWidget.background': '#1F232B',
        'editorSuggestWidget.border': '#3B414D',
        'editorSuggestWidget.foreground': '#E2E8F0',
        'editorSuggestWidget.selectedBackground': '#2563EB',
        'editorSuggestWidget.highlightForeground': '#60A5FA',
      },
    });

    // Register PostgreSQL autocomplete provider once
    if (!sqlCompletionRegistered) {
      monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const keywordSuggestions = SQL_KEYWORDS.map((kw) => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: 'PostgreSQL Keyword',
            range,
          }));

          const tableSuggestions: any[] = [];
          const columnSuggestions: any[] = [];

          schemasRef.current.forEach((schema) => {
            schema.tables.forEach((table) => {
              tableSuggestions.push({
                label: table.name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: table.name,
                detail: `Table (${table.rowCount} rows) • Schema: ${schema.name}`,
                documentation: `Columns: ${table.columns.map((c) => `${c.name} (${c.type})`).join(', ')}`,
                range,
              });

              table.columns.forEach((col) => {
                columnSuggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  detail: `${col.type} ${col.isPrimaryKey ? '(PK)' : ''} • Table: ${table.name}`,
                  documentation: `Default: ${col.defaultValue || 'None'} | Nullable: ${
                    col.isNullable ? 'Yes' : 'No'
                  }`,
                  range,
                });
              });
            });
          });

          return {
            suggestions: [...keywordSuggestions, ...tableSuggestions, ...columnSuggestions],
          };
        },
      });
      sqlCompletionRegistered = true;
    }
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track selection changes
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(selection) || '';
        setSelectedText(text);
      } else {
        setSelectedText('');
      }

      const position = editor.getPosition();
      if (position) {
        setCursorPos({ line: position.lineNumber, col: position.column });
      }
    });

    // Ctrl/Cmd + Enter -> Execute query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      let sqlToRun = '';
      if (selection && !selection.isEmpty()) {
        sqlToRun = editor.getModel()?.getValueInRange(selection) || '';
      }
      const fullSql = editor.getValue();
      onRunQuery(sqlToRun || fullSql);
    });

    // Ctrl/Cmd + Shift + F -> Format query
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        onFormatQuery();
      }
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunClick = () => {
    onRunQuery(selectedText || query);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-xs select-text overflow-hidden relative">
      {/* Editor Top Toolbar */}
      <div className="h-9 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRunClick}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow-sm flex items-center space-x-1 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{selectedText ? 'Run Selection' : 'Run Query'}</span>
          </button>

          <button
            onClick={onFormatQuery}
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
            title="Format SQL (Ctrl+Shift+F)"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Format</span>
          </button>

          <button
            onClick={onOpenAiAssistant}
            className="px-2 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded flex items-center space-x-1 transition-colors"
            title="Optimize or build SQL with Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Optimize</span>
          </button>

          <button
            onClick={onSaveSnippet}
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors"
            title="Save as snippet"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Save</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMinimapEnabled(!minimapEnabled)}
            className={`px-2 py-1 rounded border flex items-center space-x-1 transition-colors ${
              minimapEnabled
                ? 'bg-blue-900/40 border-blue-700/60 text-blue-300'
                : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#94A3B8]'
            }`}
            title="Toggle Minimap"
          >
            <Map className="w-3.5 h-3.5" />
            <span>Minimap</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-2 py-1 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139] rounded flex items-center space-x-1 transition-colors"
            title="Copy SQL to Clipboard"
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

      {/* Monaco Code Editor Body */}
      <div className="flex-1 relative overflow-hidden bg-[#0F1115]">
        <Editor
          height="100%"
          defaultLanguage="sql"
          language="sql"
          value={query}
          theme="postgres-dark"
          onChange={(val) => onChangeQuery(val || '')}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          loading={
            <div className="flex items-center justify-center h-full text-[#94A3B8] font-mono text-xs space-x-2">
              <Code className="w-4 h-4 text-blue-400 animate-pulse" />
              <span>Initializing Monaco SQL Editor...</span>
            </div>
          }
          options={{
            minimap: { enabled: minimapEnabled },
            fontSize: 13,
            fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace",
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            contextmenu: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'all',
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
          }}
        />
      </div>

      {/* Sleek Editor Status Footer */}
      <div className="h-6 bg-[#181A1F] border-t border-[#2D3139] px-3 flex items-center justify-between text-[11px] text-[#94A3B8] shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-[#E2E8F0] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Monaco SQL Engine</span>
          </div>
          <span className="text-[#3B414D]">|</span>
          <div className="flex items-center space-x-1 text-[#64748B]">
            <Database className="w-3 h-3 text-blue-400" />
            <span>PostgreSQL 16 Dialect</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[#64748B] hidden sm:inline">
            <kbd className="px-1 py-0.5 bg-[#2D3139] rounded text-[10px] text-[#E2E8F0]">Ctrl+Enter</kbd> to Run •{' '}
            <kbd className="px-1 py-0.5 bg-[#2D3139] rounded text-[10px] text-[#E2E8F0]">Ctrl+Shift+F</kbd> to Format
          </span>
          <span className="text-[#3B414D]">|</span>
          <div className="flex items-center space-x-2 font-mono text-[#E2E8F0]">
            {selectedText && (
              <span className="text-blue-400 font-semibold">{selectedText.length} chars selected • </span>
            )}
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

