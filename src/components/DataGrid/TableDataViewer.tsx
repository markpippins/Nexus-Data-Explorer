import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Check,
  X,
  Code,
  Download,
  Key,
  Edit2,
  GitFork,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Link2,
  Database,
  Filter,
  FilterX,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  Layers,
  Boxes,
  FileSpreadsheet,
  FileJson,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { TableObject, SchemaObject } from '../../types/database';

export type FilterOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_null'
  | 'is_not_null'
  | 'in';

export interface ColumnFilterRule {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
}

const FILTER_OPERATOR_LABELS: Record<FilterOperator, { label: string; short: string; noValue?: boolean }> = {
  contains: { label: 'contains', short: 'contains' },
  not_contains: { label: 'does not contain', short: '!contains' },
  equals: { label: '= (equals)', short: '=' },
  not_equals: { label: '!= (not equals)', short: '!=' },
  starts_with: { label: 'starts with', short: 'starts with' },
  ends_with: { label: 'ends with', short: 'ends with' },
  gt: { label: '> (greater than)', short: '>' },
  gte: { label: '>= (greater or equal)', short: '>=' },
  lt: { label: '< (less than)', short: '<' },
  lte: { label: '<= (less or equal)', short: '<=' },
  is_null: { label: 'IS NULL (empty)', short: 'IS NULL', noValue: true },
  is_not_null: { label: 'IS NOT NULL', short: 'IS NOT NULL', noValue: true },
  in: { label: 'IN (comma separated)', short: 'IN' },
};

interface TableDataViewerProps {
  schemaName: string;
  tableName: string;
  table: TableObject | undefined;
  schemas?: SchemaObject[];
  onOpenTable?: (schemaName: string, tableName: string) => void;
  onOpenQueryBuilder?: (schemaName?: string, tableName?: string) => void;
  onRefresh: () => void;
  onUpdateRow: (rowIndex: number, updatedRow: Record<string, any>) => void;
  onAddRow: (newRow: Record<string, any>) => void;
  onDeleteRow: (rowIndex: number) => void;
}

export const TableDataViewer: React.FC<TableDataViewerProps> = ({
  schemaName,
  tableName,
  table,
  schemas = [],
  onOpenTable,
  onOpenQueryBuilder,
  onRefresh,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'data' | 'relationships'>('data');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<{ rIdx: number; col: string; val: any } | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Export Data Menu State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  const [exportFeedback, setExportFeedback] = useState<{
    message: string;
    type: 'download' | 'copy';
    format: 'csv' | 'json' | 'sql';
  } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // Column Filtering State
  const [filterRules, setFilterRules] = useState<ColumnFilterRule[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<'AND' | 'OR'>('AND');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [inlineColumnFilters, setInlineColumnFilters] = useState<Record<string, string>>({});
  const [showInlineFilters, setShowInlineFilters] = useState(false);
  const [copiedWhereSql, setCopiedWhereSql] = useState(false);

  const isNumericType = (colType: string = ''): boolean => {
    const t = colType.toUpperCase();
    return (
      t.includes('INT') ||
      t.includes('SERIAL') ||
      t.includes('NUMERIC') ||
      t.includes('DECIMAL') ||
      t.includes('FLOAT') ||
      t.includes('REAL') ||
      t.includes('DOUBLE') ||
      t.includes('MONEY')
    );
  };

  // Compute Outgoing (this table -> referenced table) and Incoming (referencing table -> this table) FK relationships
  const outgoingRelationships = useMemo(() => {
    if (!table) return [];
    const results: Array<{
      columnName: string;
      refSchema: string;
      refTable: string;
      refColumn: string;
      isPk: boolean;
      type: string;
    }> = [];

    table.columns.forEach((col) => {
      if (col.isForeignKey && col.referencesTable) {
        // Search across schemas to find target schema if specified or default
        let targetSchemaName = schemaName;
        for (const s of schemas) {
          if (s.tables.some((t) => t.name === col.referencesTable)) {
            targetSchemaName = s.name;
            break;
          }
        }
        results.push({
          columnName: col.name,
          refSchema: targetSchemaName,
          refTable: col.referencesTable,
          refColumn: col.referencesColumn || 'id',
          isPk: !!col.isPrimaryKey,
          type: col.type,
        });
      }
    });

    return results;
  }, [table, schemaName, schemas]);

  const incomingRelationships = useMemo(() => {
    if (!table) return [];
    const results: Array<{
      fromSchema: string;
      fromTable: string;
      fromColumn: string;
      fromColumnType: string;
      targetColumn: string;
    }> = [];

    schemas.forEach((sch) => {
      sch.tables.forEach((otherTable) => {
        otherTable.columns.forEach((col) => {
          if (col.isForeignKey && col.referencesTable === tableName) {
            results.push({
              fromSchema: sch.name,
              fromTable: otherTable.name,
              fromColumn: col.name,
              fromColumnType: col.type,
              targetColumn: col.referencesColumn || 'id',
            });
          }
        });
      });
    });

    return results;
  }, [table, tableName, schemas]);

  const activeFilterCount = useMemo(() => {
    const inlineCount = Object.values(inlineColumnFilters).filter(
      (v) => typeof v === 'string' && v.trim() !== ''
    ).length;
    return filterRules.length + inlineCount;
  }, [filterRules, inlineColumnFilters]);

  // Evaluated Filtered Data
  const filteredData = useMemo(() => {
    if (!table) return [];

    return table.data.filter((row) => {
      // 1. Global Search Term Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesGlobal = Object.values(row).some((val) =>
          String(val ?? '').toLowerCase().includes(term)
        );
        if (!matchesGlobal) return false;
      }

      // 2. Inline Column Filter Row
      for (const [colName, qVal] of Object.entries(inlineColumnFilters)) {
        if (typeof qVal === 'string' && qVal.trim() !== '') {
          const cellVal = String(row[colName] ?? '').toLowerCase();
          if (!cellVal.includes(qVal.trim().toLowerCase())) {
            return false;
          }
        }
      }

      // 3. Structured Column Filter Rules
      if (filterRules.length > 0) {
        const ruleResults = filterRules.map((rule) => {
          const colVal = row[rule.column];
          const isRowNull = colVal === null || colVal === undefined;

          if (rule.operator === 'is_null') {
            return isRowNull || String(colVal).trim() === '';
          }
          if (rule.operator === 'is_not_null') {
            return !isRowNull && String(colVal).trim() !== '';
          }

          if (isRowNull) return false;

          const strRow = String(colVal).toLowerCase();
          const strRuleVal = (rule.value || '').toLowerCase();
          const numRow = Number(colVal);
          const numRuleVal = Number(rule.value);
          const bothNumeric =
            !isNaN(numRow) &&
            !isNaN(numRuleVal) &&
            String(colVal).trim() !== '' &&
            (rule.value || '').trim() !== '';

          switch (rule.operator) {
            case 'contains':
              return strRow.includes(strRuleVal);
            case 'not_contains':
              return !strRow.includes(strRuleVal);
            case 'equals':
              if (bothNumeric) return numRow === numRuleVal;
              return strRow === strRuleVal;
            case 'not_equals':
              if (bothNumeric) return numRow !== numRuleVal;
              return strRow !== strRuleVal;
            case 'starts_with':
              return strRow.startsWith(strRuleVal);
            case 'ends_with':
              return strRow.endsWith(strRuleVal);
            case 'gt':
              return bothNumeric ? numRow > numRuleVal : strRow > strRuleVal;
            case 'gte':
              return bothNumeric ? numRow >= numRuleVal : strRow >= strRuleVal;
            case 'lt':
              return bothNumeric ? numRow < numRuleVal : strRow < strRuleVal;
            case 'lte':
              return bothNumeric ? numRow <= numRuleVal : strRow <= strRuleVal;
            case 'in': {
              const items = (rule.value || '')
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              return items.includes(strRow);
            }
            default:
              return true;
          }
        });

        if (filterMatchMode === 'AND') {
          if (!ruleResults.every(Boolean)) return false;
        } else {
          if (!ruleResults.some(Boolean)) return false;
        }
      }

      return true;
    });
  }, [table, searchTerm, inlineColumnFilters, filterRules, filterMatchMode]);

  // Equivalent SQL WHERE preview
  const generatedWhereClause = useMemo(() => {
    if (!table) return '';
    const parts: string[] = [];

    filterRules.forEach((rule) => {
      const colName = `"${rule.column}"`;
      const val = rule.value || '';
      const colDef = table.columns.find((c) => c.name === rule.column);
      const isNum = colDef ? isNumericType(colDef.type) : !isNaN(Number(val));
      const formattedVal =
        isNum && val.trim() !== '' && !isNaN(Number(val))
          ? val.trim()
          : `'${val.replace(/'/g, "''")}'`;

      switch (rule.operator) {
        case 'contains':
          parts.push(`${colName} ILIKE '%${val.replace(/'/g, "''")}%'`);
          break;
        case 'not_contains':
          parts.push(`${colName} NOT ILIKE '%${val.replace(/'/g, "''")}%'`);
          break;
        case 'equals':
          parts.push(`${colName} = ${formattedVal}`);
          break;
        case 'not_equals':
          parts.push(`${colName} <> ${formattedVal}`);
          break;
        case 'starts_with':
          parts.push(`${colName} ILIKE '${val.replace(/'/g, "''")}%'`);
          break;
        case 'ends_with':
          parts.push(`${colName} ILIKE '%${val.replace(/'/g, "''")}'`);
          break;
        case 'gt':
          parts.push(`${colName} > ${formattedVal}`);
          break;
        case 'gte':
          parts.push(`${colName} >= ${formattedVal}`);
          break;
        case 'lt':
          parts.push(`${colName} < ${formattedVal}`);
          break;
        case 'lte':
          parts.push(`${colName} <= ${formattedVal}`);
          break;
        case 'is_null':
          parts.push(`${colName} IS NULL`);
          break;
        case 'is_not_null':
          parts.push(`${colName} IS NOT NULL`);
          break;
        case 'in': {
          const inItems = val
            .split(',')
            .map((s) => `'${s.trim().replace(/'/g, "''")}'`)
            .join(', ');
          parts.push(`${colName} IN (${inItems})`);
          break;
        }
      }
    });

    Object.entries(inlineColumnFilters).forEach(([col, val]) => {
      if (typeof val === 'string' && val.trim() !== '') {
        parts.push(`"${col}" ILIKE '%${val.trim().replace(/'/g, "''")}%'`);
      }
    });

    if (parts.length === 0) return '';
    return `WHERE ` + parts.join(`\n  ${filterMatchMode} `);
  }, [filterRules, inlineColumnFilters, filterMatchMode, table]);

  const handleAddFilterRule = (initialCol?: string) => {
    const defaultCol = initialCol || (table?.columns[0]?.name || '');
    const newRule: ColumnFilterRule = {
      id: 'flt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      column: defaultCol,
      operator: 'contains',
      value: '',
    };
    setFilterRules((prev) => [...prev, newRule]);
    setShowFilterPanel(true);
  };

  const handleUpdateFilterRule = (id: string, partial: Partial<ColumnFilterRule>) => {
    setFilterRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...partial } : r))
    );
  };

  const handleRemoveFilterRule = (id: string) => {
    setFilterRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllFilters = () => {
    setFilterRules([]);
    setInlineColumnFilters({});
    setSearchTerm('');
  };

  const handleCopyWhereClause = async () => {
    if (!generatedWhereClause) return;
    try {
      await navigator.clipboard.writeText(generatedWhereClause);
      setCopiedWhereSql(true);
      setTimeout(() => setCopiedWhereSql(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL WHERE clause:', err);
    }
  };

  if (!table) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#64748B] font-mono text-xs">
        <p>Table "{schemaName}.{tableName}" not found or dropped.</p>
      </div>
    );
  }

  const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExportDataRows = (): Record<string, any>[] => {
    return exportScope === 'all' ? (table?.data || []) : filteredData;
  };

  const generateCsv = (rows: Record<string, any>[]): string => {
    if (!table || rows.length === 0) return '';
    const headers = table.columns.map((c) => c.name);
    const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
    const rowLines = rows.map((row) =>
      headers
        .map((colName) => {
          const val = row[colName];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') {
            return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          }
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );
    return [headerLine, ...rowLines].join('\n');
  };

  const generateJson = (rows: Record<string, any>[]): string => {
    return JSON.stringify(rows, null, 2);
  };

  const generateSqlInserts = (rows: Record<string, any>[]): string => {
    if (!table || rows.length === 0) return '';
    const cols = table.columns.map((c) => `"${c.name}"`).join(', ');
    const insertStatements = rows.map((row) => {
      const values = table.columns
        .map((col) => {
          const val = row[col.name];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'object') {
            const jsonStr = JSON.stringify(val).replace(/'/g, "''");
            return `'${jsonStr}'`;
          }
          const strVal = String(val).replace(/'/g, "''");
          return `'${strVal}'`;
        })
        .join(', ');
      return `INSERT INTO "${schemaName}"."${tableName}" (${cols}) VALUES (${values});`;
    });

    const headerComment = `-- Exported ${rows.length} row(s) from ${schemaName}.${tableName} at ${new Date().toISOString()}\n`;
    return headerComment + insertStatements.join('\n');
  };

  const showFeedback = (message: string, type: 'download' | 'copy', format: 'csv' | 'json' | 'sql') => {
    setExportFeedback({ message, type, format });
    setTimeout(() => {
      setExportFeedback(null);
    }, 2800);
  };

  const handleExportCsv = (mode: 'download' | 'copy') => {
    const rows = getExportDataRows();
    if (rows.length === 0) return;
    const csvContent = generateCsv(rows);
    if (mode === 'download') {
      triggerFileDownload(csvContent, `${tableName}_${exportScope}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
      showFeedback(`Downloaded ${rows.length} rows as CSV`, 'download', 'csv');
    } else {
      navigator.clipboard.writeText(csvContent).then(() => {
        showFeedback(`Copied ${rows.length} rows as CSV to clipboard`, 'copy', 'csv');
      });
    }
  };

  const handleExportJson = (mode: 'download' | 'copy') => {
    const rows = getExportDataRows();
    if (rows.length === 0) return;
    const jsonContent = generateJson(rows);
    if (mode === 'download') {
      triggerFileDownload(jsonContent, `${tableName}_${exportScope}_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      showFeedback(`Downloaded ${rows.length} rows as JSON`, 'download', 'json');
    } else {
      navigator.clipboard.writeText(jsonContent).then(() => {
        showFeedback(`Copied ${rows.length} rows as JSON to clipboard`, 'copy', 'json');
      });
    }
  };

  const handleExportSqlStatement = (mode: 'download' | 'copy') => {
    const rows = getExportDataRows();
    if (rows.length === 0) return;
    const sqlContent = generateSqlInserts(rows);
    if (mode === 'download') {
      triggerFileDownload(sqlContent, `${tableName}_insert_${exportScope}_${new Date().toISOString().slice(0, 10)}.sql`, 'text/plain');
      showFeedback(`Downloaded ${rows.length} SQL INSERT statements`, 'download', 'sql');
    } else {
      navigator.clipboard.writeText(sqlContent).then(() => {
        showFeedback(`Copied ${rows.length} SQL INSERTs to clipboard`, 'copy', 'sql');
      });
    }
  };

  const handleSaveCell = () => {
    if (!editingCell) return;
    const originalRow = table.data[editingCell.rIdx];
    const updatedRow = { ...originalRow, [editingCell.col]: editingCell.val };
    onUpdateRow(editingCell.rIdx, updatedRow);
    setEditingCell(null);
  };

  const handleCreateNewRow = () => {
    onAddRow(newRowData);
    setIsAddingRow(false);
    setNewRowData({});
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F1115] font-mono text-xs select-text overflow-hidden">
      {/* Sub-Tab Navigation Header */}
      <div className="h-9 bg-[#14171D] border-b border-[#2D3139] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSubTab('data')}
            className={`px-3 py-1.5 font-bold text-xs flex items-center space-x-1.5 transition-colors border-b-2 cursor-pointer ${
              activeSubTab === 'data'
                ? 'border-blue-500 text-blue-400 bg-[#181A1F]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#181A1F]/50'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table Data</span>
            <span className="text-[10px] bg-[#2D3139] text-[#94A3B8] px-1.5 py-0.2 rounded-full font-normal">
              {table.data.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('relationships')}
            className={`px-3 py-1.5 font-bold text-xs flex items-center space-x-1.5 transition-colors border-b-2 cursor-pointer ${
              activeSubTab === 'relationships'
                ? 'border-cyan-500 text-cyan-400 bg-[#181A1F]'
                : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#181A1F]/50'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Relationships</span>
            <span className="text-[10px] bg-[#2D3139] text-[#94A3B8] px-1.5 py-0.2 rounded-full font-normal">
              {outgoingRelationships.length + incomingRelationships.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-[#64748B] flex items-center space-x-1 font-mono">
          <Database className="w-3 h-3 text-[#64748B]" />
          <span>{schemaName}.{tableName}</span>
        </div>
      </div>

      {activeSubTab === 'data' ? (
        <>
          {/* Table Viewer Header Toolbar */}
          <div className="h-10 bg-[#181A1F] border-b border-[#2D3139] px-4 flex items-center justify-between text-[#E2E8F0] shrink-0">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 font-bold text-[#E2E8F0] text-sm">
                <TableIcon className="w-4 h-4 text-blue-400" />
                <span>{schemaName}.{tableName}</span>
                <span className="text-xs text-[#64748B] font-normal ml-1">
                  {filteredData.length !== table.rowCount ? (
                    <span className="text-amber-400 font-medium">
                      ({filteredData.length} of {table.rowCount} records)
                    </span>
                  ) : (
                    <span>({table.rowCount} total records)</span>
                  )}
                </span>
              </div>

              {/* Global Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#64748B] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Quick search all columns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#0F1115] border border-[#2D3139] rounded pl-8 pr-6 py-1 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500 placeholder:text-[#64748B] w-48 sm:w-56"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1.5 text-[#64748B] hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Column Filter Toggle Button */}
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all border cursor-pointer ${
                  showFilterPanel || filterRules.length > 0
                    ? 'bg-blue-950/80 border-blue-600 text-blue-300 shadow-sm'
                    : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#E2E8F0]'
                }`}
                title="Open column-based filter builder"
              >
                <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-bold">
                    {activeFilterCount}
                  </span>
                )}
                {showFilterPanel ? (
                  <ChevronUp className="w-3 h-3 text-[#94A3B8]" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
                )}
              </button>

              {/* Inline Column Filter Header Row Toggle */}
              <button
                onClick={() => setShowInlineFilters(!showInlineFilters)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1.5 transition-all border cursor-pointer ${
                  showInlineFilters
                    ? 'bg-cyan-950/80 border-cyan-600 text-cyan-300'
                    : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
                title="Toggle per-column quick filter row under table headers"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="hidden md:inline">Column Inputs</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {onOpenQueryBuilder && (
                <button
                  onClick={() => onOpenQueryBuilder(schemaName, tableName)}
                  title="Open this table in the Visual Query Builder"
                  className="px-2.5 py-1 bg-blue-950/80 hover:bg-blue-900 border border-blue-700/60 text-blue-200 font-semibold text-xs rounded flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Boxes className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="hidden lg:inline">Visual Query Builder</span>
                </button>
              )}

              {/* Dedicated Export Data Menu */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={filteredData.length === 0 && table.data.length === 0}
                  title="Export table dataset as CSV, JSON, or SQL INSERT statements"
                  className={`px-2.5 py-1 rounded font-semibold text-xs flex items-center space-x-1.5 transition-all border cursor-pointer ${
                    showExportMenu
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-[#2D3139] hover:bg-[#3B414D] border-[#3B414D] text-[#E2E8F0] disabled:opacity-50'
                  }`}
                >
                  <Download className={`w-3.5 h-3.5 ${showExportMenu ? 'text-white' : 'text-blue-400'} shrink-0`} />
                  <span>Export Data</span>
                  <ChevronDown className={`w-3 h-3 text-[#94A3B8] transition-transform ${showExportMenu ? 'rotate-180 text-white' : ''}`} />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-84 bg-[#181A1F] border border-[#3B414D] rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#2D3139] mb-3">
                      <div className="flex items-center space-x-2">
                        <Download className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-[#F1F5F9] text-xs">Export Dataset</span>
                      </div>
                      <span className="text-[11px] text-[#94A3B8] font-mono px-2 py-0.5 bg-[#0F1115] border border-[#2D3139] rounded">
                        {getExportDataRows().length} row(s)
                      </span>
                    </div>

                    {/* Scope Selector */}
                    <div className="mb-3">
                      <label className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block mb-1.5">
                        Target Rows Scope
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0F1115] rounded-lg border border-[#2D3139]">
                        <button
                          onClick={() => setExportScope('filtered')}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                            exportScope === 'filtered'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E232B]'
                          }`}
                        >
                          <span>Filtered Rows</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            exportScope === 'filtered' ? 'bg-blue-800 text-blue-100' : 'bg-[#2D3139] text-[#94A3B8]'
                          }`}>
                            {filteredData.length}
                          </span>
                        </button>

                        <button
                          onClick={() => setExportScope('all')}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                            exportScope === 'all'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E232B]'
                          }`}
                        >
                          <span>All Table Rows</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            exportScope === 'all' ? 'bg-blue-800 text-blue-100' : 'bg-[#2D3139] text-[#94A3B8]'
                          }`}>
                            {table.data.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Export Formats List */}
                    <div className="space-y-2 mb-2">
                      {/* CSV Format Card */}
                      <div className="p-2.5 bg-[#0F1115] hover:bg-[#13161C] border border-[#2D3139] rounded-lg transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-400">
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-[#E2E8F0] text-xs">CSV (Spreadsheet)</div>
                              <div className="text-[10px] text-[#64748B]">Comma-delimited with headers</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleExportCsv('download')}
                            disabled={getExportDataRows().length === 0}
                            className="flex-1 py-1 px-2.5 bg-[#2D3139] hover:bg-emerald-900/60 hover:border-emerald-600 hover:text-emerald-200 text-[#E2E8F0] border border-[#3B414D] rounded font-medium text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Download className="w-3 h-3 text-emerald-400" />
                            <span>Download .csv</span>
                          </button>
                          <button
                            onClick={() => handleExportCsv('copy')}
                            disabled={getExportDataRows().length === 0}
                            title="Copy CSV to clipboard"
                            className="py-1 px-2 bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#3B414D] rounded font-medium text-[11px] flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      {/* JSON Format Card */}
                      <div className="p-2.5 bg-[#0F1115] hover:bg-[#13161C] border border-[#2D3139] rounded-lg transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 rounded bg-amber-950/80 border border-amber-700/60 text-amber-400">
                              <FileJson className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-[#E2E8F0] text-xs">JSON (Web / API)</div>
                              <div className="text-[10px] text-[#64748B]">Structured objects array</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleExportJson('download')}
                            disabled={getExportDataRows().length === 0}
                            className="flex-1 py-1 px-2.5 bg-[#2D3139] hover:bg-amber-900/60 hover:border-amber-600 hover:text-amber-200 text-[#E2E8F0] border border-[#3B414D] rounded font-medium text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Download className="w-3 h-3 text-amber-400" />
                            <span>Download .json</span>
                          </button>
                          <button
                            onClick={() => handleExportJson('copy')}
                            disabled={getExportDataRows().length === 0}
                            title="Copy JSON to clipboard"
                            className="py-1 px-2 bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#3B414D] rounded font-medium text-[11px] flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      {/* SQL INSERTs Card */}
                      <div className="p-2.5 bg-[#0F1115] hover:bg-[#13161C] border border-[#2D3139] rounded-lg transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 rounded bg-blue-950/80 border border-blue-700/60 text-blue-400">
                              <Database className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-[#E2E8F0] text-xs">SQL INSERTs (Database)</div>
                              <div className="text-[10px] text-[#64748B]">PostgreSQL compatible statements</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleExportSqlStatement('download')}
                            disabled={getExportDataRows().length === 0}
                            className="flex-1 py-1 px-2.5 bg-[#2D3139] hover:bg-blue-900/60 hover:border-blue-600 hover:text-blue-200 text-[#E2E8F0] border border-[#3B414D] rounded font-medium text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Download className="w-3 h-3 text-blue-400" />
                            <span>Download .sql</span>
                          </button>
                          <button
                            onClick={() => handleExportSqlStatement('copy')}
                            disabled={getExportDataRows().length === 0}
                            title="Copy SQL INSERTs to clipboard"
                            className="py-1 px-2 bg-[#2D3139] hover:bg-[#3B414D] text-[#94A3B8] hover:text-[#E2E8F0] border border-[#3B414D] rounded font-medium text-[11px] flex items-center space-x-1 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Feedback Alert Toast */}
                    {exportFeedback && (
                      <div className="mt-2 p-2 bg-emerald-950/90 border border-emerald-700/80 text-emerald-300 rounded-md text-[11px] flex items-center space-x-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{exportFeedback.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setIsAddingRow(true);
                  const init: Record<string, any> = {};
                  table.columns.forEach((c) => {
                    if (!c.isPrimaryKey) init[c.name] = '';
                  });
                  setNewRowData(init);
                }}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>

              {selectedRowIdx !== null && (
                <button
                  onClick={() => {
                    onDeleteRow(selectedRowIdx);
                    setSelectedRowIdx(null);
                  }}
                  className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded font-medium flex items-center space-x-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
              )}

              <button
                onClick={onRefresh}
                title="Reload table records"
                className="p-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded border border-[#3B414D] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Column Filter Builder Panel */}
          {showFilterPanel && (
            <div className="border-b border-[#2D3139] bg-[#14171D] p-3 space-y-3 shrink-0 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-[#E2E8F0]">
                    <Filter className="w-3.5 h-3.5 text-blue-400" />
                    <span>Column Filters</span>
                  </div>

                  {/* AND / OR Conjunction Switch */}
                  <div className="flex items-center space-x-1 bg-[#0F1115] border border-[#2D3139] p-0.5 rounded text-[11px]">
                    <span className="px-1.5 text-[#64748B] font-semibold">Match:</span>
                    <button
                      onClick={() => setFilterMatchMode('AND')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        filterMatchMode === 'AND'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      ALL (AND)
                    </button>
                    <button
                      onClick={() => setFilterMatchMode('OR')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        filterMatchMode === 'OR'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      ANY (OR)
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAddFilterRule()}
                    className="px-2.5 py-1 bg-blue-600/90 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Condition</span>
                  </button>

                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearAllFilters}
                      className="px-2.5 py-1 bg-[#2D3139] hover:bg-rose-950/80 hover:border-rose-700/80 text-[#94A3B8] hover:text-rose-200 border border-[#3B414D] rounded text-xs font-medium flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <FilterX className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowFilterPanel(false)}
                    className="p-1 text-[#94A3B8] hover:text-white rounded hover:bg-[#2D3139]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter Rules List */}
              {filterRules.length === 0 ? (
                <div className="p-4 rounded border border-dashed border-[#2D3139] bg-[#0F1115]/50 flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>No column filter rules added yet. Narrow down your table rows without SQL WHERE queries.</span>
                  <button
                    onClick={() => handleAddFilterRule()}
                    className="px-2 py-1 bg-[#2D3139] hover:bg-blue-600 text-[#E2E8F0] hover:text-white rounded text-[11px] font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create First Filter</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {filterRules.map((rule, index) => {
                    const isNoValue = FILTER_OPERATOR_LABELS[rule.operator]?.noValue;
                    const colObj = table.columns.find((c) => c.name === rule.column);

                    return (
                      <div
                        key={rule.id}
                        className="flex items-center space-x-2 bg-[#0F1115] border border-[#2D3139] rounded p-1.5"
                      >
                        {/* Conjunction label indicator */}
                        <div className="w-12 text-[10px] font-bold text-center text-[#64748B]">
                          {index === 0 ? 'WHERE' : filterMatchMode}
                        </div>

                        {/* Column Selector */}
                        <select
                          value={rule.column}
                          onChange={(e) => handleUpdateFilterRule(rule.id, { column: e.target.value })}
                          className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500 font-mono"
                        >
                          {table.columns.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.name} ({col.type}) {col.isPrimaryKey ? '🔑' : ''} {col.isForeignKey ? '🔗' : ''}
                            </option>
                          ))}
                        </select>

                        {/* Operator Selector */}
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            handleUpdateFilterRule(rule.id, { operator: e.target.value as FilterOperator })
                          }
                          className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-blue-400 focus:outline-none focus:border-blue-500 font-mono"
                        >
                          {Object.entries(FILTER_OPERATOR_LABELS).map(([opKey, opInfo]) => (
                            <option key={opKey} value={opKey}>
                              {opInfo.label}
                            </option>
                          ))}
                        </select>

                        {/* Filter Value Input */}
                        {!isNoValue ? (
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              placeholder={
                                rule.operator === 'in'
                                  ? 'value1, value2, value3...'
                                  : `Enter filter value for ${rule.column}...`
                              }
                              value={rule.value}
                              onChange={(e) => handleUpdateFilterRule(rule.id, { value: e.target.value })}
                              className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2.5 py-1 text-xs text-[#E2E8F0] focus:outline-none focus:border-blue-500 placeholder:text-[#64748B]"
                            />
                            {rule.value && (
                              <button
                                onClick={() => handleUpdateFilterRule(rule.id, { value: '' })}
                                className="absolute right-2 top-1.5 text-[#64748B] hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 px-2.5 py-1 text-xs text-[#64748B] italic bg-[#181A1F] border border-[#2D3139] rounded">
                            No input required for {rule.operator.replace('_', ' ').toUpperCase()}
                          </div>
                        )}

                        {/* Remove Rule Button */}
                        <button
                          onClick={() => handleRemoveFilterRule(rule.id)}
                          className="p-1 text-[#64748B] hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                          title="Remove condition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SQL Equivalent WHERE Preview */}
              {generatedWhereClause && (
                <div className="mt-2 pt-2 border-t border-[#2D3139]/80 flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <div className="flex items-center space-x-2 truncate font-mono">
                    <span className="text-[#64748B] uppercase font-semibold shrink-0">Equivalent SQL:</span>
                    <code className="px-2 py-0.5 rounded bg-[#0F1115] border border-[#2D3139] text-amber-300 truncate max-w-xl">
                      {generatedWhereClause.replace(/\n\s+/g, ' ')}
                    </code>
                  </div>

                  <button
                    onClick={handleCopyWhereClause}
                    className="shrink-0 ml-3 px-2 py-0.5 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors"
                    title="Copy generated SQL WHERE clause to clipboard"
                  >
                    {copiedWhereSql ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-blue-400" />
                        <span>Copy WHERE</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Chips Bar (When filter panel is collapsed) */}
          {!showFilterPanel && (filterRules.length > 0 || Object.values(inlineColumnFilters).some((v) => v)) && (
            <div className="bg-[#14171D] border-b border-[#2D3139] px-4 py-1.5 flex items-center justify-between text-xs shrink-0 overflow-x-auto custom-scrollbar">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[11px] text-[#64748B] font-semibold uppercase flex items-center space-x-1 mr-1">
                  <Filter className="w-3 h-3 text-blue-400" />
                  <span>Active Filters:</span>
                </span>

                {/* Filter Rule Chips */}
                {filterRules.map((rule) => {
                  const op = FILTER_OPERATOR_LABELS[rule.operator]?.short || rule.operator;
                  const isNoVal = FILTER_OPERATOR_LABELS[rule.operator]?.noValue;
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-950/70 border border-blue-800/80 text-blue-300 text-[11px] font-mono"
                    >
                      <span className="font-bold text-blue-200">{rule.column}</span>
                      <span className="text-blue-400">{op}</span>
                      {!isNoVal && <span className="font-semibold text-white">"{rule.value}"</span>}
                      <button
                        onClick={() => handleRemoveFilterRule(rule.id)}
                        className="text-blue-400 hover:text-white ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Inline Search Chips */}
                {Object.entries(inlineColumnFilters).map(([col, val]) => {
                  if (!val || typeof val !== 'string' || val.trim() === '') return null;
                  return (
                    <div
                      key={col}
                      className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/80 text-cyan-300 text-[11px] font-mono"
                    >
                      <span className="font-bold text-cyan-200">{col}</span>
                      <span className="text-cyan-400">contains</span>
                      <span className="font-semibold text-white">"{val}"</span>
                      <button
                        onClick={() => {
                          const next = { ...inlineColumnFilters };
                          delete next[col];
                          setInlineColumnFilters(next);
                        }}
                        className="text-cyan-400 hover:text-white ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={() => setShowFilterPanel(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer ml-1"
                >
                  Edit Filters
                </button>
              </div>

              <button
                onClick={handleClearAllFilters}
                className="text-[11px] text-[#94A3B8] hover:text-rose-300 hover:underline cursor-pointer ml-4 shrink-0"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Grid Table */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse border-[#2D3139]">
              <thead className="sticky top-0 bg-[#181A1F] z-10 shadow-sm">
                {/* Column Headers */}
                <tr>
                  <th className="w-10 px-2 py-2 border-b border-r border-[#2D3139] text-[10px] text-[#64748B] text-center">
                    #
                  </th>
                  {table.columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-3 py-2 border-b border-r border-[#2D3139] text-[#E2E8F0] font-semibold text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                          {col.isForeignKey && <Link2 className="w-3 h-3 text-cyan-400 shrink-0" />}
                          <span>{col.name}</span>
                          <span className="text-[9px] text-[#64748B] font-normal">({col.type})</span>
                        </div>

                        {/* Quick filter icon on column header to add rule for this column */}
                        <button
                          onClick={() => handleAddFilterRule(col.name)}
                          title={`Add filter condition for ${col.name}`}
                          className="text-[#64748B] hover:text-blue-400 opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 transition-opacity"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Inline Per-Column Filter Row */}
                {showInlineFilters && (
                  <tr className="bg-[#14171D] border-b border-[#2D3139]">
                    <td className="px-1 py-1 border-r border-[#2D3139] text-center">
                      <Search className="w-3 h-3 text-[#64748B] mx-auto" />
                    </td>
                    {table.columns.map((col) => {
                      const currentVal = inlineColumnFilters[col.name] || '';
                      return (
                        <td key={col.name} className="px-1.5 py-1 border-r border-[#2D3139]">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={`Filter ${col.name}...`}
                              value={currentVal}
                              onChange={(e) =>
                                setInlineColumnFilters({
                                  ...inlineColumnFilters,
                                  [col.name]: e.target.value,
                                })
                              }
                              className={`w-full bg-[#0F1115] border rounded px-1.5 py-0.5 text-[11px] text-[#E2E8F0] font-mono outline-none ${
                                currentVal ? 'border-cyan-500 bg-cyan-950/20' : 'border-[#2D3139] focus:border-cyan-500'
                              }`}
                            />
                            {currentVal && (
                              <button
                                onClick={() => {
                                  const next = { ...inlineColumnFilters };
                                  delete next[col.name];
                                  setInlineColumnFilters(next);
                                }}
                                className="absolute right-1 top-1 text-[#64748B] hover:text-white"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={table.columns.length + 1}
                      className="px-6 py-12 text-center text-[#64748B] font-mono"
                    >
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <FilterX className="w-8 h-8 text-[#64748B]" />
                        <div>
                          <p className="text-sm font-semibold text-[#94A3B8]">No matching records found</p>
                          <p className="text-xs text-[#64748B] mt-1">
                            No rows matched the specified search and column filter criteria.
                          </p>
                        </div>
                        <button
                          onClick={handleClearAllFilters}
                          className="px-3 py-1.5 bg-[#2D3139] hover:bg-blue-600 text-[#E2E8F0] hover:text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, rIdx) => {
                    const isSelected = selectedRowIdx === rIdx;
                    return (
                      <tr
                        key={rIdx}
                        onClick={() => setSelectedRowIdx(rIdx)}
                        className={`border-b border-[#1F232B] transition-colors ${
                          isSelected ? 'bg-blue-950/40 border-blue-800/50' : 'hover:bg-[#2D3139]/50'
                        }`}
                      >
                        <td className="px-2 py-1.5 border-r border-[#2D3139]/80 text-[10px] text-[#64748B] text-center font-mono">
                          {rIdx + 1}
                        </td>
                        {table.columns.map((col) => {
                          const val = row[col.name];
                          const isEditing = editingCell?.rIdx === rIdx && editingCell?.col === col.name;

                          return (
                            <td
                              key={col.name}
                              onDoubleClick={() => setEditingCell({ rIdx, col: col.name, val })}
                              className="px-3 py-1.5 border-r border-[#2D3139]/80 text-[#E2E8F0] truncate max-w-xs font-mono text-xs cursor-pointer hover:bg-[#2D3139]"
                            >
                              {isEditing ? (
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    value={editingCell.val}
                                    onChange={(e) => setEditingCell({ ...editingCell, val: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveCell();
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    autoFocus
                                    className="w-full bg-[#0F1115] border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                                  />
                                  <button onClick={handleSaveCell} className="p-0.5 text-emerald-400">
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingCell(null)} className="p-0.5 text-[#94A3B8]">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : val === null || val === undefined ? (
                                <span className="text-[#64748B] italic">NULL</span>
                              ) : (
                                <span>{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Relationships Tab View */
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-8 bg-[#0F1115]">
          {/* Summary Banner */}
          <div className="p-4 rounded-lg bg-[#181A1F] border border-[#2D3139] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
                <GitFork className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#E2E8F0]">
                  Foreign Key Relationships for <span className="text-cyan-400">{schemaName}.{tableName}</span>
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Overview of referenced parent tables (outgoing FKs) and referencing child tables (incoming FKs).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="px-3 py-1.5 rounded bg-blue-950/40 border border-blue-800/50 text-blue-300 font-semibold">
                Outgoing: {outgoingRelationships.length}
              </div>
              <div className="px-3 py-1.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 font-semibold">
                Incoming: {incomingRelationships.length}
              </div>
            </div>
          </div>

          {/* Section 1: Outgoing Foreign Keys (This Table references parent tables) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#E2E8F0]">
                  Outgoing Foreign Keys (Parent References)
                </h4>
              </div>
              <span className="text-xs text-[#64748B]">
                Columns in <span className="text-blue-300">{tableName}</span> referencing primary keys in other tables
              </span>
            </div>

            {outgoingRelationships.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#14171D] border border-[#2D3139] text-center text-[#64748B]">
                No outgoing foreign keys defined for this table.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {outgoingRelationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#181A1F] border border-[#2D3139] hover:border-blue-500/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-4">
                      {/* Source Column */}
                      <div className="p-2.5 rounded bg-[#0F1115] border border-[#2D3139] min-w-[180px]">
                        <div className="text-[10px] text-[#64748B] font-semibold uppercase">Local FK Column</div>
                        <div className="font-bold text-blue-400 text-xs mt-0.5 flex items-center space-x-1">
                          <Key className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>{rel.columnName}</span>
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">Type: {rel.type}</div>
                      </div>

                      {/* Direction Arrow */}
                      <div className="flex flex-col items-center px-2">
                        <span className="text-[10px] text-blue-400 font-semibold mb-1">REFERENCES</span>
                        <div className="p-1.5 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-400">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Referenced Target Table and Column */}
                      <div className="p-2.5 rounded bg-[#0F1115] border border-[#2D3139] min-w-[200px]">
                        <div className="text-[10px] text-[#64748B] font-semibold uppercase">Referenced Table & PK</div>
                        <div className="font-bold text-[#E2E8F0] text-xs mt-0.5 flex items-center space-x-1">
                          <TableIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{rel.refSchema}.<span className="text-amber-300">{rel.refTable}</span></span>
                        </div>
                        <div className="text-[10px] text-amber-400/90 font-mono mt-0.5 flex items-center space-x-1">
                          <Key className="w-2.5 h-2.5 shrink-0" />
                          <span>Target Col: {rel.refColumn}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action button to open target table */}
                    {onOpenTable && (
                      <button
                        onClick={() => onOpenTable(rel.refSchema, rel.refTable)}
                        className="px-3 py-1.5 bg-[#2D3139] hover:bg-blue-600 text-[#E2E8F0] hover:text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-all opacity-90 group-hover:opacity-100 cursor-pointer"
                      >
                        <span>Open {rel.refTable}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Incoming Foreign Keys (Other tables referencing this table) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#E2E8F0]">
                  Incoming Foreign Keys (Child Dependents)
                </h4>
              </div>
              <span className="text-xs text-[#64748B]">
                Other tables in database pointing to <span className="text-emerald-300">{tableName}</span>
              </span>
            </div>

            {incomingRelationships.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#14171D] border border-[#2D3139] text-center text-[#64748B]">
                No other tables currently reference {tableName} as a foreign key.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {incomingRelationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#181A1F] border border-[#2D3139] hover:border-emerald-500/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-4">
                      {/* Referencing Child Table */}
                      <div className="p-2.5 rounded bg-[#0F1115] border border-[#2D3139] min-w-[200px]">
                        <div className="text-[10px] text-[#64748B] font-semibold uppercase">Referencing Table</div>
                        <div className="font-bold text-[#E2E8F0] text-xs mt-0.5 flex items-center space-x-1">
                          <TableIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{rel.fromSchema}.<span className="text-emerald-300">{rel.fromTable}</span></span>
                        </div>
                        <div className="text-[10px] text-cyan-300 font-mono mt-0.5 flex items-center space-x-1">
                          <Key className="w-2.5 h-2.5 shrink-0" />
                          <span>FK Col: {rel.fromColumn} ({rel.fromColumnType})</span>
                        </div>
                      </div>

                      {/* Direction Arrow */}
                      <div className="flex flex-col items-center px-2">
                        <span className="text-[10px] text-emerald-400 font-semibold mb-1">POINTS TO</span>
                        <div className="p-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Target Column in current table */}
                      <div className="p-2.5 rounded bg-[#0F1115] border border-[#2D3139] min-w-[180px]">
                        <div className="text-[10px] text-[#64748B] font-semibold uppercase">This Table Key</div>
                        <div className="font-bold text-amber-300 text-xs mt-0.5 flex items-center space-x-1">
                          <Key className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{tableName}.{rel.targetColumn}</span>
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">Primary/Unique Key</div>
                      </div>
                    </div>

                    {/* Action button to open referencing table */}
                    {onOpenTable && (
                      <button
                        onClick={() => onOpenTable(rel.fromSchema, rel.fromTable)}
                        className="px-3 py-1.5 bg-[#2D3139] hover:bg-emerald-600 text-[#E2E8F0] hover:text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-all opacity-90 group-hover:opacity-100 cursor-pointer"
                      >
                        <span>Open {rel.fromTable}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {isAddingRow && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1F232B] border border-[#3B414D] rounded-lg shadow-2xl p-4 font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D3139] pb-2">
              <span className="font-bold text-blue-400 text-sm">Add New Row to {tableName}</span>
              <button onClick={() => setIsAddingRow(false)} className="text-[#94A3B8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {table.columns.map((col) => (
                <div key={col.name} className="space-y-1">
                  <label className="text-[11px] text-[#94A3B8] font-bold flex justify-between">
                    <span>{col.name}</span>
                    <span className="text-[#64748B] font-normal">({col.type})</span>
                  </label>
                  <input
                    type="text"
                    disabled={col.isPrimaryKey && (col.type === 'SERIAL' || col.type === 'BIGSERIAL')}
                    placeholder={col.isPrimaryKey ? 'Auto Serial ID' : `Enter ${col.name}...`}
                    value={newRowData[col.name] || ''}
                    onChange={(e) => setNewRowData({ ...newRowData, [col.name]: e.target.value })}
                    className="w-full bg-[#0F1115] border border-[#2D3139] rounded px-2.5 py-1 text-[#E2E8F0] focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 border-t border-[#2D3139] pt-3">
              <button
                onClick={() => setIsAddingRow(false)}
                className="px-3 py-1 bg-[#2D3139] hover:bg-[#3B414D] text-[#E2E8F0] rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewRow}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
              >
                Insert Row
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
