import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Database,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Wand2,
  CheckCircle2,
  Boxes,
  SlidersHorizontal,
  Lightbulb,
  ShieldAlert,
  Zap,
  HelpCircle,
  X,
  FileCheck,
  Search,
  Layers,
  Key,
  Link,
  Variable,
  FunctionSquare,
  BookOpen,
} from 'lucide-react';
import { SchemaObject, TableObject, ColumnDefinition, QueryParameter } from '../../types/database';
import {
  lintSqlQuery,
  SqlDiagnostic,
  LinterOptions,
  DEFAULT_LINTER_OPTIONS,
  formatSqlKeywordCasing,
} from '../../services/sqlLinter';
import {
  POSTGRES_FUNCTIONS,
  SQL_SNIPPETS,
  SQL_KEYWORDS_LIST,
  analyzeAutocompleteContext,
  extractReferencedTables,
  findForeignKeyJoinSuggestions,
} from '../../services/sqlAutocomplete';
import {
  extractParametersFromSql,
  substituteParameters,
  ParameterPreset,
} from '../../services/sqlParameters';
import { SqlParametersPanel } from './SqlParametersPanel';

interface SqlEditorProps {
  query: string;
  onChangeQuery: (newQuery: string) => void;
  onRunQuery: (queryToRun?: string) => void;
  onFormatQuery: () => void;
  onOpenAiAssistant: () => void;
  onSaveSnippet: () => void;
  onOpenQueryBuilder?: () => void;
  schemas: SchemaObject[];
}

export interface AutocompleteOptions {
  enablePredictive: boolean;
  enableFkJoinPrediction: boolean;
  enableTableAliases: boolean;
  enableFunctionSnippets: boolean;
  enableSchemaQualification: boolean;
}

export const DEFAULT_AUTOCOMPLETE_OPTIONS: AutocompleteOptions = {
  enablePredictive: true,
  enableFkJoinPrediction: true,
  enableTableAliases: true,
  enableFunctionSnippets: true,
  enableSchemaQualification: true,
};

let sqlCompletionRegistered = false;

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onChangeQuery,
  onRunQuery,
  onFormatQuery,
  onOpenAiAssistant,
  onSaveSnippet,
  onOpenQueryBuilder,
  schemas,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showLinterPanel, setShowLinterPanel] = useState(true);
  const [showParametersPanel, setShowParametersPanel] = useState(false);
  const [autoSubstituteOnRun, setAutoSubstituteOnRun] = useState(true);
  const [parameters, setParameters] = useState<QueryParameter[]>(() => extractParametersFromSql(query));
  const [activeFilter, setActiveFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [expandedExplanationIdx, setExpandedExplanationIdx] = useState<number | null>(null);
  const [showRulesMenu, setShowRulesMenu] = useState(false);
  const [showAutocompleteMenu, setShowAutocompleteMenu] = useState(false);
  const [showSchemaCatalogModal, setShowSchemaCatalogModal] = useState(false);
  const [schemaCatalogSearch, setSchemaCatalogSearch] = useState('');
  const [linterOptions, setLinterOptions] = useState<LinterOptions>(DEFAULT_LINTER_OPTIONS);
  const [autocompleteOptions, setAutocompleteOptions] = useState<AutocompleteOptions>(DEFAULT_AUTOCOMPLETE_OPTIONS);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const schemasRef = useRef<SchemaObject[]>(schemas);
  const autocompleteOptionsRef = useRef<AutocompleteOptions>(autocompleteOptions);
  const parametersRef = useRef<QueryParameter[]>(parameters);
  const executeWithParametersRef = useRef<(rawSql: string) => void>(() => {});
  const rulesMenuRef = useRef<HTMLDivElement>(null);
  const autocompleteMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    schemasRef.current = schemas;
  }, [schemas]);

  useEffect(() => {
    autocompleteOptionsRef.current = autocompleteOptions;
  }, [autocompleteOptions]);

  useEffect(() => {
    parametersRef.current = parameters;
  }, [parameters]);

  // Synchronize detected query parameters when query text changes
  useEffect(() => {
    setParameters((prev) => extractParametersFromSql(query, prev));
  }, [query]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rulesMenuRef.current && !rulesMenuRef.current.contains(e.target as Node)) {
        setShowRulesMenu(false);
      }
      if (autocompleteMenuRef.current && !autocompleteMenuRef.current.contains(e.target as Node)) {
        setShowAutocompleteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute stats for active schemas
  const schemaStats = useMemo(() => {
    let totalTables = 0;
    let totalColumns = 0;
    let totalViews = 0;
    schemas.forEach((s) => {
      totalTables += s.tables.length;
      totalViews += (s.views || []).length;
      s.tables.forEach((t) => {
        totalColumns += t.columns.length;
      });
    });
    return {
      schemasCount: schemas.length,
      tablesCount: totalTables,
      columnsCount: totalColumns,
      viewsCount: totalViews,
    };
  }, [schemas]);

  // Compute real-time diagnostics whenever query, schemas, or linter options change
  const diagnostics: SqlDiagnostic[] = useMemo(() => {
    return lintSqlQuery(query, schemas, linterOptions);
  }, [query, schemas, linterOptions]);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

  const filteredDiagnostics = useMemo(() => {
    if (activeFilter === 'all') return diagnostics;
    return diagnostics.filter((d) => d.severity === activeFilter);
  }, [diagnostics, activeFilter]);

  // Sync linter diagnostics to Monaco Editor as Markers
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();

    if (!model) return;

    const markers = diagnostics.map((diag) => {
      let severity = monaco.MarkerSeverity.Info;
      if (diag.severity === 'error') severity = monaco.MarkerSeverity.Error;
      else if (diag.severity === 'warning') severity = monaco.MarkerSeverity.Warning;

      return {
        startLineNumber: diag.line,
        startColumn: diag.startCol,
        endLineNumber: diag.line,
        endColumn: Math.max(diag.startCol + 1, diag.endCol),
        message: `${diag.message}${diag.suggestion ? `\n💡 Quick Fix: ${diag.suggestion}` : ''}${
          diag.ruleExplanation ? `\n\nℹ️ ${diag.ruleExplanation}` : ''
        }`,
        severity,
        source: 'PostgreSQL Linter',
      };
    });

    monaco.editor.setModelMarkers(model, 'sql-linter', markers);
  }, [diagnostics]);

  const handleBeforeMount: BeforeMount = (monaco) => {
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

    if (!sqlCompletionRegistered) {
      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' ', '(', ',', '\n', ':', '$', '{'],
        provideCompletionItems: (model, position) => {
          const currentSchemas = schemasRef.current;
          const options = autocompleteOptionsRef.current;
          const currentParams = parametersRef.current;

          if (!options.enablePredictive) {
            return { suggestions: [] };
          }

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const fullSql = model.getValue();
          const lineContent = model.getLineContent(position.lineNumber);
          const lineUntilPosition = lineContent.substring(0, position.column - 1);
          const textBeforePosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          // Analyze AST Context
          const context = analyzeAutocompleteContext(textBeforePosition, fullSql, currentSchemas);
          const suggestions: any[] = [];

          // Map for fast schema table lookups
          const tableMap = new Map<string, { table: TableObject; schema: SchemaObject }>();
          currentSchemas.forEach((schema) => {
            schema.tables.forEach((table) => {
              tableMap.set(table.name.toLowerCase(), { table, schema });
              tableMap.set(`${schema.name.toLowerCase()}.${table.name.toLowerCase()}`, { table, schema });
            });
          });

          // =========================================================================
          // 1. DOT TRIGGER (e.g. "users." or "u." or "public.")
          // =========================================================================
          if (context.triggerType === 'dot' && context.dotTarget) {
            const target = context.dotTarget.toLowerCase();
            // Resolve alias to real table name
            const resolvedTableName = context.referencedTables.get(target) || target;
            const tableEntry = tableMap.get(resolvedTableName.toLowerCase());

            if (tableEntry) {
              const { table, schema } = tableEntry;

              // Suggest '*' expansion for table
              suggestions.push({
                label: '*',
                kind: monaco.languages.CompletionItemKind.Value,
                insertText: '*',
                detail: `All columns from ${table.name} (${table.columns.length} columns)`,
                documentation: {
                  value: `**Select all columns from \`${table.name}\`:**\n\n\`${table.columns.map((c) => c.name).join(', ')}\``,
                },
                sortText: '00_00_star',
                range,
              });

              // Suggest each column for this specific table
              table.columns.forEach((col, idx) => {
                const isPk = !!col.isPrimaryKey;
                const isFk = !!col.isForeignKey || !!col.referencesTable;
                const prefixWeight = isPk ? '00_' : isFk ? '01_' : '02_';

                suggestions.push({
                  label: col.name,
                  kind: isPk ? monaco.languages.CompletionItemKind.Field : monaco.languages.CompletionItemKind.Property,
                  insertText: col.name,
                  detail: `${col.type} ${isPk ? '🔑 [PK]' : ''}${isFk ? ` 🔗 [FK ➔ ${col.referencesTable}.${col.referencesColumn}]` : ''}`,
                  documentation: {
                    value: `### 📋 Column: \`${col.name}\`\n\n- **Table:** \`${table.name}\` (Schema: \`${schema.name}\`)\n- **Type:** \`${col.type}\`\n- **Nullable:** \`${col.isNullable !== false ? 'YES' : 'NO (NOT NULL)'}\`\n- **Default:** \`${col.defaultValue || 'None'}\`${col.referencesTable ? `\n- **Foreign Key:** References \`${col.referencesTable}.${col.referencesColumn}\`` : ''}${col.comment ? `\n- **Comment:** ${col.comment}` : ''}`,
                  },
                  sortText: `${prefixWeight}${String(idx).padStart(2, '0')}_${col.name}`,
                  range,
                });
              });

              return { suggestions };
            }
          }

          // =========================================================================
          // 2. SCHEMA DOT TRIGGER (e.g. "public.")
          // =========================================================================
          if (context.triggerType === 'schema_dot' && context.dotTarget) {
            const schemaName = context.dotTarget.toLowerCase();
            const matchedSchema = currentSchemas.find((s) => s.name.toLowerCase() === schemaName);

            if (matchedSchema) {
              // Suggest tables in this schema
              matchedSchema.tables.forEach((table) => {
                suggestions.push({
                  label: table.name,
                  kind: monaco.languages.CompletionItemKind.Class,
                  insertText: table.name,
                  detail: `Table (${table.rowCount} rows) • Schema: ${matchedSchema.name}`,
                  documentation: {
                    value: `### 🗄️ Table: \`${matchedSchema.name}.${table.name}\`\n\n**Rows:** ${table.rowCount.toLocaleString()} | **Columns (${table.columns.length}):**\n${table.columns.map((c) => `- \`${c.name}\` (${c.type})${c.isPrimaryKey ? ' 🔑 PK' : ''}`).join('\n')}${table.comment ? `\n\n*${table.comment}*` : ''}`,
                  },
                  sortText: `00_${table.name}`,
                  range,
                });
              });

              // Suggest views in this schema
              (matchedSchema.views || []).forEach((view) => {
                suggestions.push({
                  label: view.name,
                  kind: monaco.languages.CompletionItemKind.Interface,
                  insertText: view.name,
                  detail: `View • Schema: ${matchedSchema.name}`,
                  documentation: {
                    value: `### 👁️ View: \`${matchedSchema.name}.${view.name}\`\n\n\`\`\`sql\n${view.definition || '-- No definition'}\n\`\`\``,
                  },
                  sortText: `01_${view.name}`,
                  range,
                });
              });

              return { suggestions };
            }
          }

          // =========================================================================
          // 3. JOIN "ON" CLAUSE PREDICTION (Predict Foreign Keys)
          // =========================================================================
          if (context.triggerType === 'on_clause' && options.enableFkJoinPrediction) {
            // Find all tables referenced so far
            const refTableNames = Array.from(new Set(context.referencedTables.values()));

            if (refTableNames.length >= 2) {
              const lastTable = refTableNames[refTableNames.length - 1];
              const otherTables = refTableNames.slice(0, -1);

              otherTables.forEach((prevTable) => {
                const joinConditions = findForeignKeyJoinSuggestions(prevTable, lastTable, currentSchemas);
                joinConditions.forEach((jc, jIdx) => {
                  suggestions.push({
                    label: jc.condition,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: jc.condition,
                    detail: `⚡ Auto-Join (${jc.detail})`,
                    documentation: {
                      value: `### 🔗 Predictive Foreign Key Join\n\n\`\`\`sql\nON ${jc.condition}\n\`\`\`\n\nMatches relational key constraints between \`${prevTable}\` and \`${lastTable}\`.`,
                    },
                    sortText: `00_${String(jIdx).padStart(2, '0')}`,
                    range,
                  });
                });
              });
            }
          }

          // =========================================================================
          // 4. FROM / JOIN CONTEXT (Prioritize Tables)
          // =========================================================================
          if (context.triggerType === 'from_join') {
            currentSchemas.forEach((schema) => {
              schema.tables.forEach((table) => {
                // 1. Direct Table Name
                suggestions.push({
                  label: table.name,
                  kind: monaco.languages.CompletionItemKind.Class,
                  insertText: table.name,
                  detail: `Table (${table.rowCount} rows) • Schema: ${schema.name}`,
                  documentation: {
                    value: `### 🗄️ Table: \`${schema.name}.${table.name}\`\n\n**Rows:** ${table.rowCount.toLocaleString()} | **Columns (${table.columns.length}):**\n${table.columns.map((c) => `- \`${c.name}\` (${c.type})${c.isPrimaryKey ? ' 🔑 PK' : ''}`).join('\n')}${table.comment ? `\n\n*${table.comment}*` : ''}`,
                  },
                  sortText: `00_${table.name}`,
                  range,
                });

                // 2. Schema-qualified table name
                if (options.enableSchemaQualification) {
                  suggestions.push({
                    label: `${schema.name}.${table.name}`,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: `${schema.name}.${table.name}`,
                    detail: `Qualified Table • ${schema.name}`,
                    sortText: `01_${schema.name}_${table.name}`,
                    range,
                  });
                }

                // 3. Table with Alias Snippet (e.g. "customers c")
                if (options.enableTableAliases) {
                  const alias = table.name.charAt(0).toLowerCase();
                  suggestions.push({
                    label: `${table.name} ${alias}`,
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: `${table.name} ${alias}`,
                    detail: `Table with alias "${alias}"`,
                    sortText: `02_${table.name}`,
                    range,
                  });
                }
              });

              // Views in schema
              (schema.views || []).forEach((view) => {
                suggestions.push({
                  label: view.name,
                  kind: monaco.languages.CompletionItemKind.Interface,
                  insertText: view.name,
                  detail: `View • Schema: ${schema.name}`,
                  sortText: `03_${view.name}`,
                  range,
                });
              });
            });
          }

          // =========================================================================
          // 5. SELECT / WHERE / GROUP BY / ORDER BY CONTEXT (Prioritize Referenced Columns)
          // =========================================================================
          if (context.triggerType === 'select' || context.triggerType === 'general') {
            const activeTableNames = new Set(Array.from(context.referencedTables.values()).map((t) => t.toLowerCase()));

            // Boost columns belonging to tables referenced in active query
            currentSchemas.forEach((schema) => {
              schema.tables.forEach((table) => {
                const isTableReferenced = activeTableNames.has(table.name.toLowerCase());
                const sortPrefix = isTableReferenced ? '00_' : '04_';

                table.columns.forEach((col) => {
                  const isPk = !!col.isPrimaryKey;
                  const isFk = !!col.isForeignKey || !!col.referencesTable;

                  suggestions.push({
                    label: col.name,
                    kind: isPk ? monaco.languages.CompletionItemKind.Field : monaco.languages.CompletionItemKind.Property,
                    insertText: col.name,
                    detail: `${col.type} • Table: ${table.name}${isPk ? ' 🔑 PK' : ''}${isFk ? ' 🔗 FK' : ''}`,
                    documentation: {
                      value: `### 📋 Column: \`${col.name}\`\n\n- **Table:** \`${table.name}\` (${schema.name})\n- **Type:** \`${col.type}\`\n- **Nullable:** \`${col.isNullable !== false ? 'YES' : 'NO'}\`\n- **Default:** \`${col.defaultValue || 'None'}\`${col.referencesTable ? `\n- **FK References:** \`${col.referencesTable}.${col.referencesColumn}\`` : ''}`,
                    },
                    sortText: `${sortPrefix}${isPk ? '0_' : '1_'}${col.name}`,
                    range,
                  });
                });
              });
            });

            // PostgreSQL Built-in Functions
            if (options.enableFunctionSnippets) {
              POSTGRES_FUNCTIONS.forEach((fn) => {
                suggestions.push({
                  label: fn.name,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: fn.snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  detail: `${fn.signature} ➔ ${fn.returnType}`,
                  documentation: {
                    value: `### ⚡ Function: \`${fn.name}\` (${fn.category})\n\n**Signature:** \`${fn.signature}\`\n**Returns:** \`${fn.returnType}\`\n\n${fn.description}`,
                  },
                  sortText: `02_${fn.name}`,
                  range,
                });
              });
            }
          }

          // =========================================================================
          // 6. SQL KEYWORDS & BOILERPLATE SNIPPETS
          // =========================================================================
          SQL_KEYWORDS_LIST.forEach((kw) => {
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              detail: 'PostgreSQL Keyword',
              sortText: `05_${kw}`,
              range,
            });
          });

          SQL_SNIPPETS.forEach((snip) => {
            suggestions.push({
              label: snip.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: snip.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: snip.detail,
              documentation: {
                value: `### 📄 SQL Template: ${snip.label}\n\n${snip.documentation}\n\n\`\`\`sql\n${snip.insertText.replace(/\$\{\d+:([^}]+)\}/g, '$1')}\n\`\`\``,
              },
              sortText: `06_${snip.label}`,
              range,
            });
          });

          // Schemas names themselves
          currentSchemas.forEach((schema) => {
            suggestions.push({
              label: schema.name,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: schema.name,
              detail: `Schema (${schema.tables.length} tables)`,
              sortText: `07_${schema.name}`,
              range,
            });
          });

          // Query Parameters & Variables (:param, $1, {{var}})
          if (currentParams && currentParams.length > 0) {
            currentParams.forEach((param) => {
              suggestions.push({
                label: param.rawPlaceholder,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: param.rawPlaceholder,
                detail: `Parameter [${param.type}] = ${param.value !== undefined ? String(param.value) : 'unset'}`,
                documentation: {
                  value: `### 📌 Query Parameter: \`${param.rawPlaceholder}\`\n\n- **Name:** \`${param.name}\`\n- **Type:** \`${param.type}\`\n- **Current Value:** \`${param.value}\`\n${param.description ? `\n- **Description:** ${param.description}` : ''}`,
                },
                sortText: `00_${param.name}`,
                range,
              });
            });
          }

          return { suggestions };
        },
      });
      sqlCompletionRegistered = true;
    }
  };

  // Execution with parameters substitution
  const executeWithParameters = (rawSql: string) => {
    if (!rawSql) return;
    if (autoSubstituteOnRun && parameters.length > 0) {
      const { compiledSql, missingParams } = substituteParameters(rawSql, parameters);
      if (missingParams.length > 0) {
        setShowParametersPanel(true);
      }
      onRunQuery(compiledSql);
    } else {
      onRunQuery(rawSql);
    }
  };

  useEffect(() => {
    executeWithParametersRef.current = executeWithParameters;
  });

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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

    // Ctrl/Cmd + Enter -> Execute query with parameter substitution
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      let sqlToRun = '';
      if (selection && !selection.isEmpty()) {
        sqlToRun = editor.getModel()?.getValueInRange(selection) || '';
      }
      const fullSql = editor.getValue();
      const targetSql = sqlToRun || fullSql;
      executeWithParametersRef.current(targetSql);
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
    executeWithParameters(selectedText || query);
  };

  const handleApplyPreset = (preset: ParameterPreset) => {
    onChangeQuery(preset.query);
    const extracted = extractParametersFromSql(preset.query, preset.parameters as QueryParameter[]);
    setParameters(extracted);
    setShowParametersPanel(true);
    showFixNotification(`Loaded preset: "${preset.title}"`);
  };

  // Insert token into editor at current cursor
  const handleInsertToken = (token: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const position = editor.getPosition();
    if (position) {
      editor.executeEdits('schemaCatalog', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: token,
        },
      ]);
      editor.focus();
    }
  };

  // Jump to error in editor and highlight range
  const handleJumpToDiagnostic = (diag: SqlDiagnostic) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    editor.revealLineInCenter(diag.line);
    editor.setPosition({ lineNumber: diag.line, column: diag.startCol });
    editor.setSelection({
      startLineNumber: diag.line,
      startColumn: diag.startCol,
      endLineNumber: diag.line,
      endColumn: Math.max(diag.startCol + 1, diag.endCol),
    });
    editor.focus();
  };

  // Apply single diagnostic quick fix
  const handleApplySingleFix = (diag: SqlDiagnostic, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const lineContent = model.getLineContent(diag.line);

    if (diag.code === 'NULL_COMPARISON' && diag.replacementText) {
      const updatedLine = lineContent.replace(/(=|!=|<>)\s*NULL/gi, diag.replacementText.includes('NOT') ? 'IS NOT NULL' : 'IS NULL');
      model.pushEditOperations(
        [],
        [
          {
            range: {
              startLineNumber: diag.line,
              startColumn: 1,
              endLineNumber: diag.line,
              endColumn: lineContent.length + 1,
            },
            text: updatedLine,
          },
        ],
        () => null
      );
      showFixNotification(`Applied fix: "${diag.replacementText}"`);
    } else if (diag.code === 'TRAILING_COMMA') {
      const updatedLine = lineContent.replace(/,\s*(\bFROM\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|\))/gi, ' $1');
      model.pushEditOperations(
        [],
        [
          {
            range: {
              startLineNumber: diag.line,
              startColumn: 1,
              endLineNumber: diag.line,
              endColumn: lineContent.length + 1,
            },
            text: updatedLine,
          },
        ],
        () => null
      );
      showFixNotification('Removed trailing comma');
    } else if ((diag.code === 'KEYWORD_TYPO' || diag.code === 'UNKNOWN_TABLE') && diag.replacementText) {
      const exactTokenRange = {
        startLineNumber: diag.line,
        startColumn: diag.startCol,
        endLineNumber: diag.line,
        endColumn: diag.endCol,
      };
      model.pushEditOperations(
        [],
        [
          {
            range: exactTokenRange,
            text: diag.replacementText,
          },
        ],
        () => null
      );
      showFixNotification(`Replaced with "${diag.replacementText}"`);
    }
  };

  // Apply all available quick fixes in one operation
  const handleFixAll = () => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    let currentVal = model.getValue();
    let fixCount = 0;

    // 1. Fix NULL comparisons
    if (currentVal.match(/(=|!=|<>)\s*NULL/gi)) {
      currentVal = currentVal.replace(/=\s*NULL/gi, 'IS NULL').replace(/(!=|<>)\s*NULL/gi, 'IS NOT NULL');
      fixCount++;
    }

    // 2. Fix trailing commas
    if (currentVal.match(/,\s*(\bFROM\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|\))/gi)) {
      currentVal = currentVal.replace(/,\s*(\bFROM\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bLIMIT\b|\))/gi, ' $1');
      fixCount++;
    }

    // 3. Fix keyword typos
    diagnostics.forEach((d) => {
      if (d.code === 'KEYWORD_TYPO' && d.replacementText) {
        const rawToken = currentVal.substring(
          model.getOffsetAt({ lineNumber: d.line, column: d.startCol }),
          model.getOffsetAt({ lineNumber: d.line, column: d.endCol })
        );
        if (rawToken) {
          currentVal = currentVal.replace(new RegExp(`\\b${rawToken}\\b`, 'g'), d.replacementText);
          fixCount++;
        }
      }
    });

    model.setValue(currentVal);
    showFixNotification(`Resolved ${fixCount} issue${fixCount > 1 ? 's' : ''}`);
  };

  const showFixNotification = (msg: string) => {
    setFixSuccessMessage(msg);
    setTimeout(() => setFixSuccessMessage(null), 3000);
  };

  const fixableDiagnosticsCount = diagnostics.filter(
    (d) => d.code === 'NULL_COMPARISON' || d.code === 'TRAILING_COMMA' || d.code === 'KEYWORD_TYPO'
  ).length;

  // Filtered schema objects for Catalog Browser Modal
  const filteredCatalogTables = useMemo(() => {
    const term = schemaCatalogSearch.toLowerCase().trim();
    const result: { schema: string; table: TableObject; matchedCols: ColumnDefinition[] }[] = [];

    schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        const tableMatches = table.name.toLowerCase().includes(term) || schema.name.toLowerCase().includes(term);
        const matchingColumns = table.columns.filter((c) =>
          c.name.toLowerCase().includes(term) || c.type.toLowerCase().includes(term)
        );

        if (!term || tableMatches || matchingColumns.length > 0) {
          result.push({
            schema: schema.name,
            table,
            matchedCols: term ? matchingColumns : table.columns,
          });
        }
      });
    });

    return result;
  }, [schemas, schemaCatalogSearch]);

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-xs select-text overflow-hidden relative">
      {/* Editor Top Toolbar */}
      <div className="h-9 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between text-[#E2E8F0] shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRunClick}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow-sm flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{selectedText ? 'Run Selection' : 'Run Query'}</span>
          </button>

          <button
            onClick={onFormatQuery}
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors cursor-pointer"
            title="Format SQL (Ctrl+Shift+F)"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Format</span>
          </button>

          <button
            onClick={onOpenAiAssistant}
            className="px-2 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded flex items-center space-x-1 transition-colors cursor-pointer"
            title="Optimize or build SQL with Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Optimize</span>
          </button>

          {onOpenQueryBuilder && (
            <button
              onClick={onOpenQueryBuilder}
              className="px-2 py-1 bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-700/60 rounded flex items-center space-x-1 transition-colors cursor-pointer"
              title="Open Visual Query Builder"
            >
              <Boxes className="w-3.5 h-3.5 text-blue-400" />
              <span>Visual Builder</span>
            </button>
          )}

          <button
            onClick={onSaveSnippet}
            className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] flex items-center space-x-1 transition-colors cursor-pointer"
            title="Save as snippet"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Save</span>
          </button>

          <button
            onClick={() => setShowParametersPanel(!showParametersPanel)}
            className={`px-2.5 py-1 rounded border flex items-center space-x-1.5 transition-colors cursor-pointer ${
              showParametersPanel
                ? 'bg-purple-900/60 border-purple-500 text-purple-200 shadow-sm'
                : parameters.length > 0
                ? 'bg-purple-950/70 hover:bg-purple-900 border-purple-800/60 text-purple-300'
                : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#94A3B8]'
            }`}
            title="Define and test query parameters and variables (:param, $1, {{var}})"
          >
            <Variable className={`w-3.5 h-3.5 ${parameters.length > 0 ? 'text-purple-400' : 'text-slate-400'}`} />
            <span>Parameters</span>
            {parameters.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-900/90 text-purple-200 font-mono font-bold">
                {parameters.length}
              </span>
            )}
          </button>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center space-x-2">
          {/* Real-time Predictive Autocomplete Popover */}
          <div className="relative" ref={autocompleteMenuRef}>
            <button
              onClick={() => setShowAutocompleteMenu(!showAutocompleteMenu)}
              className={`px-2 py-1 rounded border flex items-center space-x-1.5 transition-colors cursor-pointer ${
                showAutocompleteMenu
                  ? 'bg-blue-900/40 border-blue-500 text-blue-300'
                  : autocompleteOptions.enablePredictive
                  ? 'bg-[#1C2028] hover:bg-[#252B37] border-blue-800/40 text-[#93C5FD]'
                  : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#94A3B8]'
              }`}
              title="Predictive Autocomplete & Schema Completion Settings"
            >
              <Zap className={`w-3.5 h-3.5 ${autocompleteOptions.enablePredictive ? 'text-amber-400 fill-amber-400/30' : 'text-slate-500'}`} />
              <span className="hidden md:inline font-semibold">
                Predictive Autocomplete ({schemaStats.tablesCount} Tables)
              </span>
              <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
            </button>

            {showAutocompleteMenu && (
              <div className="absolute right-0 mt-1.5 w-80 bg-[#181A1F] border border-[#3B414D] rounded-lg shadow-2xl p-3 z-50 text-xs font-sans">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2D3139]">
                  <span className="font-bold text-white flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Schema Predictive Autocomplete</span>
                  </span>
                  <button
                    onClick={() => setShowAutocompleteMenu(false)}
                    className="text-[#94A3B8] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-2 mb-3 bg-[#0F1115] rounded border border-[#2D3139] space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>Active Schemas:</span>
                    <span className="text-white font-semibold">{schemaStats.schemasCount} ({schemas.map((s) => s.name).join(', ')})</span>
                  </div>
                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>Indexed Database Tables:</span>
                    <span className="text-blue-400 font-semibold">{schemaStats.tablesCount} tables</span>
                  </div>
                  <div className="flex items-center justify-between text-[#94A3B8]">
                    <span>Indexed Schema Columns:</span>
                    <span className="text-emerald-400 font-semibold">{schemaStats.columnsCount} columns</span>
                  </div>
                </div>

                <div className="space-y-2 font-mono text-[11px]">
                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={autocompleteOptions.enablePredictive}
                      onChange={(e) =>
                        setAutocompleteOptions({
                          ...autocompleteOptions,
                          enablePredictive: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Real-Time Suggestions As You Type</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={autocompleteOptions.enableFkJoinPrediction}
                      onChange={(e) =>
                        setAutocompleteOptions({
                          ...autocompleteOptions,
                          enableFkJoinPrediction: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Foreign Key JOIN ON Predictions</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={autocompleteOptions.enableTableAliases}
                      onChange={(e) =>
                        setAutocompleteOptions({
                          ...autocompleteOptions,
                          enableTableAliases: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Auto Table Aliasing (e.g. customers c)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={autocompleteOptions.enableFunctionSnippets}
                      onChange={(e) =>
                        setAutocompleteOptions({
                          ...autocompleteOptions,
                          enableFunctionSnippets: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Function Snippets & Signatures</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={autocompleteOptions.enableSchemaQualification}
                      onChange={(e) =>
                        setAutocompleteOptions({
                          ...autocompleteOptions,
                          enableSchemaQualification: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Schema Qualification (public.table)</span>
                  </label>
                </div>

                <div className="mt-3 pt-2 border-t border-[#2D3139] flex items-center justify-between">
                  <button
                    onClick={() => {
                      setShowAutocompleteMenu(false);
                      setShowSchemaCatalogModal(true);
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Browse Schema Catalog</span>
                  </button>

                  <button
                    onClick={() => setAutocompleteOptions(DEFAULT_AUTOCOMPLETE_OPTIONS)}
                    className="text-[10px] text-[#94A3B8] hover:underline cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Linter Rules Settings Popover */}
          <div className="relative" ref={rulesMenuRef}>
            <button
              onClick={() => setShowRulesMenu(!showRulesMenu)}
              className={`px-2 py-1 rounded border flex items-center space-x-1 transition-colors cursor-pointer ${
                showRulesMenu
                  ? 'bg-blue-900/40 border-blue-500 text-blue-300'
                  : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#94A3B8]'
              }`}
              title="Configure SQL Linter Rules"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Linter Rules</span>
            </button>

            {showRulesMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-[#181A1F] border border-[#3B414D] rounded-lg shadow-2xl p-3 z-50 text-xs font-sans">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2D3139]">
                  <span className="font-bold text-white flex items-center space-x-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Real-Time Linter Rules</span>
                  </span>
                  <button
                    onClick={() => setShowRulesMenu(false)}
                    className="text-[#94A3B8] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 font-mono text-[11px]">
                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkSyntax}
                      onChange={(e) =>
                        setLinterOptions({ ...linterOptions, checkSyntax: e.target.checked })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Syntax & Brackets Validation</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkKeywordTypos}
                      onChange={(e) =>
                        setLinterOptions({ ...linterOptions, checkKeywordTypos: e.target.checked })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Keyword Typos Detection</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkSchema}
                      onChange={(e) =>
                        setLinterOptions({ ...linterOptions, checkSchema: e.target.checked })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Schema Table Verification</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkNullComparison}
                      onChange={(e) =>
                        setLinterOptions({
                          ...linterOptions,
                          checkNullComparison: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>= NULL Antipattern Warning</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkMissingWhere}
                      onChange={(e) =>
                        setLinterOptions({
                          ...linterOptions,
                          checkMissingWhere: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Dangerous UPDATE/DELETE Guard</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkSelectStar}
                      onChange={(e) =>
                        setLinterOptions({ ...linterOptions, checkSelectStar: e.target.checked })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>SELECT * Best Practice Tip</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkLeadingWildcard}
                      onChange={(e) =>
                        setLinterOptions({
                          ...linterOptions,
                          checkLeadingWildcard: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Index Scan (Leading Wildcard)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-[#E2E8F0]">
                    <input
                      type="checkbox"
                      checked={linterOptions.checkCartesianProduct}
                      onChange={(e) =>
                        setLinterOptions({
                          ...linterOptions,
                          checkCartesianProduct: e.target.checked,
                        })
                      }
                      className="rounded bg-[#0F1115] border-[#3B414D] text-blue-600 focus:ring-0"
                    />
                    <span>Cartesian Product Comma Guard</span>
                  </label>
                </div>

                <div className="mt-3 pt-2 border-t border-[#2D3139] flex justify-end">
                  <button
                    onClick={() => setLinterOptions(DEFAULT_LINTER_OPTIONS)}
                    className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setMinimapEnabled(!minimapEnabled)}
            className={`px-2 py-1 rounded border flex items-center space-x-1 transition-colors cursor-pointer ${
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
            className="px-2 py-1 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139] rounded flex items-center space-x-1 transition-colors cursor-pointer"
            title="Copy SQL to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => onChangeQuery('')}
            title="Clear Editor"
            className="p-1 text-[#94A3B8] hover:text-rose-400 hover:bg-[#2D3139] rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Parameter Variables Testing & Binding Panel */}
      {showParametersPanel && (
        <SqlParametersPanel
          query={query}
          parameters={parameters}
          onChangeParameters={setParameters}
          onApplyPreset={handleApplyPreset}
          onInsertPlaceholderIntoEditor={handleInsertToken}
          onRunCompiledQuery={(compiledSql) => onRunQuery(compiledSql)}
          onClose={() => setShowParametersPanel(false)}
          autoSubstituteOnRun={autoSubstituteOnRun}
          onToggleAutoSubstitute={setAutoSubstituteOnRun}
        />
      )}

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
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggest: {
              snippetsPreventQuickSuggestions: false,
              showWords: false,
              showClasses: true,
              showFields: true,
              showProperties: true,
              showFunctions: true,
              showKeywords: true,
              showSnippets: true,
            },
          }}
        />
      </div>

      {/* Real-time SQL Linter Drawer & Problems Bar */}
      <div className="border-t border-[#2D3139] bg-[#14171D] shrink-0 select-none">
        {/* Linter Bar Header */}
        <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-mono bg-[#181A1F]/90 border-b border-[#2D3139]/60">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowLinterPanel(!showLinterPanel)}
              className="flex items-center space-x-1.5 font-bold text-[#E2E8F0] hover:text-blue-400 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Real-Time SQL Linter</span>
              {showLinterPanel ? <ChevronDown className="w-3 h-3 text-[#94A3B8]" /> : <ChevronUp className="w-3 h-3 text-[#94A3B8]" />}
            </button>

            {diagnostics.length === 0 ? (
              <span className="flex items-center space-x-1 text-emerald-400 font-medium text-[10px] bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>Valid SQL Syntax (No Issues)</span>
              </span>
            ) : (
              <div className="flex items-center space-x-1.5 text-[10px]">
                {/* Filter Tabs */}
                <button
                  onClick={() => {
                    setActiveFilter('all');
                    setShowLinterPanel(true);
                  }}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-[#2D3139] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  All ({diagnostics.length})
                </button>

                {errorCount > 0 && (
                  <button
                    onClick={() => {
                      setActiveFilter('error');
                      setShowLinterPanel(true);
                    }}
                    className={`px-1.5 py-0.5 rounded border cursor-pointer flex items-center space-x-1 transition-colors ${
                      activeFilter === 'error'
                        ? 'bg-rose-600 text-white border-rose-400 font-bold'
                        : 'bg-rose-950/80 text-rose-300 border-rose-800/60 font-semibold'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span>{errorCount} {errorCount === 1 ? 'Error' : 'Errors'}</span>
                  </button>
                )}

                {warningCount > 0 && (
                  <button
                    onClick={() => {
                      setActiveFilter('warning');
                      setShowLinterPanel(true);
                    }}
                    className={`px-1.5 py-0.5 rounded border cursor-pointer flex items-center space-x-1 transition-colors ${
                      activeFilter === 'warning'
                        ? 'bg-amber-600 text-white border-amber-400 font-bold'
                        : 'bg-amber-950/80 text-amber-300 border-amber-800/60 font-semibold'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>{warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}</span>
                  </button>
                )}

                {infoCount > 0 && (
                  <button
                    onClick={() => {
                      setActiveFilter('info');
                      setShowLinterPanel(true);
                    }}
                    className={`px-1.5 py-0.5 rounded border cursor-pointer flex items-center space-x-1 transition-colors ${
                      activeFilter === 'info'
                        ? 'bg-sky-600 text-white border-sky-400 font-bold'
                        : 'bg-sky-950/80 text-sky-300 border-sky-800/60 font-semibold'
                    }`}
                  >
                    <Info className="w-3 h-3 text-sky-400" />
                    <span>{infoCount} Best Practices</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-2">
            {fixSuccessMessage && (
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1 font-semibold animate-pulse">
                <CheckCircle2 className="w-3 h-3" />
                <span>{fixSuccessMessage}</span>
              </span>
            )}

            {fixableDiagnosticsCount > 0 && (
              <button
                onClick={handleFixAll}
                className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-semibold text-[10px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                title="Automatically apply all suggested quick fixes"
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Fix All Fixable ({fixableDiagnosticsCount})</span>
              </button>
            )}

            <button
              onClick={() => setShowLinterPanel(!showLinterPanel)}
              className="text-[#94A3B8] hover:text-[#E2E8F0] p-0.5 rounded cursor-pointer"
            >
              {showLinterPanel ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Diagnostics List Drawer */}
        {showLinterPanel && (
          <div className="max-h-44 overflow-y-auto custom-scrollbar divide-y divide-[#2D3139]/50 bg-[#0F1115]">
            {filteredDiagnostics.length === 0 ? (
              <div className="py-4 px-3 flex flex-col items-center justify-center text-[#94A3B8] text-center space-y-1">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-semibold text-[#E2E8F0]">No issues matching active filter</span>
                <p className="text-[10px] text-[#64748B]">Your SQL statement follows PostgreSQL syntax and best practice standards.</p>
              </div>
            ) : (
              filteredDiagnostics.map((diag, idx) => {
                const isError = diag.severity === 'error';
                const isWarning = diag.severity === 'warning';
                const isExpanded = expandedExplanationIdx === idx;

                return (
                  <div
                    key={idx}
                    onClick={() => handleJumpToDiagnostic(diag)}
                    className="px-3 py-2 flex flex-col hover:bg-[#181A1F] transition-colors cursor-pointer group text-xs font-mono"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2.5 flex-1 pr-3">
                        <div className="mt-0.5 shrink-0">
                          {isError ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Lightbulb className="w-3.5 h-3.5 text-sky-400" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-blue-400 text-[11px]">
                              Ln {diag.line}, Col {diag.startCol}
                            </span>
                            <span
                              className={`text-[9px] uppercase px-1 rounded font-bold ${
                                isError
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : isWarning
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-sky-950 text-sky-300 border border-sky-800'
                              }`}
                            >
                              {diag.severity}
                            </span>

                            {diag.category && (
                              <span className="text-[9px] uppercase px-1 rounded bg-[#2D3139] text-[#94A3B8]">
                                {diag.category}
                              </span>
                            )}
                          </div>

                          <p className="text-[#E2E8F0] text-xs mt-1 leading-snug">{diag.message}</p>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {diag.suggestion && (
                          <button
                            onClick={(e) => handleApplySingleFix(diag, e)}
                            className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/60 rounded text-[10px] font-semibold flex items-center space-x-1 transition-all opacity-90 group-hover:opacity-100 cursor-pointer shadow-sm"
                            title="Apply quick fix to code"
                          >
                            <Wand2 className="w-3 h-3 text-cyan-300" />
                            <span>Fix: "{diag.suggestion}"</span>
                          </button>
                        )}

                        {diag.ruleExplanation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedExplanationIdx(isExpanded ? null : idx);
                            }}
                            className={`p-1 rounded text-[10px] border transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-blue-950 border-blue-500 text-blue-300'
                                : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#94A3B8]'
                            }`}
                            title="View PostgreSQL explanation & best practice reasoning"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Explanations Expander */}
                    {isExpanded && diag.ruleExplanation && (
                      <div className="mt-2 p-2.5 rounded bg-[#13151B] border border-blue-900/50 text-[11px] font-sans text-[#CBD5E1] space-y-1">
                        <div className="flex items-center space-x-1.5 text-blue-400 font-bold font-mono text-[10px] uppercase">
                          <Info className="w-3 h-3" />
                          <span>PostgreSQL Engine & Optimization Rationale:</span>
                        </div>
                        <p className="leading-relaxed">{diag.ruleExplanation}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Sleek Editor Status Footer */}
      <div className="h-6 bg-[#181A1F] border-t border-[#2D3139] px-3 flex items-center justify-between text-[11px] text-[#94A3B8] shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-[#E2E8F0] font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                diagnostics.some((d) => d.severity === 'error')
                  ? 'bg-rose-500'
                  : diagnostics.some((d) => d.severity === 'warning')
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span>Monaco SQL Engine</span>
          </div>

          <span className="text-[#3B414D]">|</span>

          {/* Autocomplete active status pill */}
          <button
            onClick={() => setShowAutocompleteMenu(true)}
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
            title="Active Schema Predictive Autocomplete"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Schema Autocomplete: {schemaStats.tablesCount} Tables ({schemaStats.columnsCount} Columns)</span>
          </button>

          <span className="text-[#3B414D]">|</span>

          <div className="flex items-center space-x-1 text-[#64748B]">
            <Database className="w-3 h-3 text-blue-400" />
            <span>PostgreSQL 16 Dialect</span>
          </div>

          <span className="text-[#3B414D]">|</span>

          {/* Parameters active indicator */}
          <button
            onClick={() => setShowParametersPanel(!showParametersPanel)}
            className={`flex items-center space-x-1 cursor-pointer font-medium transition-colors ${
              parameters.length > 0
                ? 'text-purple-400 hover:text-purple-300'
                : 'text-slate-500 hover:text-slate-400'
            }`}
            title="Toggle Query Parameters Panel"
          >
            <Variable className="w-3 h-3 text-purple-400" />
            <span>
              {parameters.length} Parameter{parameters.length === 1 ? '' : 's'}
              {parameters.length > 0 ? ' (Active)' : ''}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[#64748B] hidden sm:inline">
            <kbd className="px-1 py-0.5 bg-[#2D3139] rounded text-[10px] text-[#E2E8F0]">Ctrl+Space</kbd> or type <kbd className="px-1 py-0.5 bg-[#2D3139] rounded text-[10px] text-[#E2E8F0]">.</kbd> for suggestions •{' '}
            <kbd className="px-1 py-0.5 bg-[#2D3139] rounded text-[10px] text-[#E2E8F0]">Ctrl+Enter</kbd> to Run
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

      {/* Schema Autocomplete Catalog Modal */}
      {showSchemaCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181A1F] border border-[#3B414D] rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col font-sans overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-[#2D3139] flex items-center justify-between bg-[#14171D]">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Schema Autocomplete Catalog</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Click any table or column name to insert it directly into your query.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSchemaCatalogModal(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#2D3139] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 border-b border-[#2D3139] bg-[#0F1115]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={schemaCatalogSearch}
                  onChange={(e) => setSchemaCatalogSearch(e.target.value)}
                  placeholder="Search tables, columns, or data types across all active schemas..."
                  className="w-full bg-[#181A1F] border border-[#3B414D] focus:border-blue-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#64748B] outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Table Catalog List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-[#0F1115]">
              {filteredCatalogTables.length === 0 ? (
                <div className="py-12 text-center text-[#94A3B8] text-xs">
                  No tables or columns match "{schemaCatalogSearch}".
                </div>
              ) : (
                filteredCatalogTables.map(({ schema, table, matchedCols }) => (
                  <div
                    key={`${schema}.${table.name}`}
                    className="p-3 rounded-lg bg-[#181A1F] border border-[#2D3139] space-y-2.5 font-mono text-xs"
                  >
                    {/* Table Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Database className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400 text-[11px]">{schema}.</span>
                        <button
                          onClick={() => {
                            handleInsertToken(`${schema}.${table.name}`);
                            setShowSchemaCatalogModal(false);
                          }}
                          className="font-bold text-white hover:text-blue-400 text-sm hover:underline cursor-pointer flex items-center space-x-1"
                        >
                          <span>{table.name}</span>
                        </button>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D3139] text-[#94A3B8]">
                          {table.rowCount.toLocaleString()} rows
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          handleInsertToken(`SELECT * FROM ${schema}.${table.name} LIMIT 50;`);
                          setShowSchemaCatalogModal(false);
                        }}
                        className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/60 rounded text-[11px] font-sans font-semibold cursor-pointer transition-colors"
                      >
                        Insert SELECT *
                      </button>
                    </div>

                    {table.comment && (
                      <p className="text-[11px] text-[#94A3B8] font-sans italic">{table.comment}</p>
                    )}

                    {/* Columns Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pt-1">
                      {matchedCols.map((col) => {
                        const isPk = !!col.isPrimaryKey;
                        const isFk = !!col.isForeignKey || !!col.referencesTable;

                        return (
                          <button
                            key={col.name}
                            onClick={() => {
                              handleInsertToken(col.name);
                              setShowSchemaCatalogModal(false);
                            }}
                            className="p-1.5 rounded bg-[#13151B] hover:bg-[#252B37] border border-[#2D3139] hover:border-blue-500 text-left flex items-center justify-between cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center space-x-1.5 overflow-hidden">
                              {isPk ? (
                                <Key className="w-3 h-3 text-amber-400 shrink-0" />
                              ) : isFk ? (
                                <Link className="w-3 h-3 text-emerald-400 shrink-0" />
                              ) : (
                                <Variable className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-200 group-hover:text-white truncate text-[11px]">
                                {col.name}
                              </span>
                            </div>

                            <span className="text-[10px] text-slate-400 group-hover:text-blue-300 shrink-0 ml-1">
                              {col.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-[#14171D] border-t border-[#2D3139] flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Tip: Typing in the SQL editor provides instant auto-suggestions with keyboard navigation.</span>
              <button
                onClick={() => setShowSchemaCatalogModal(false)}
                className="px-3 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-white rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
