import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Play,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Table as TableIcon,
  Filter,
  ArrowUpDown,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Link2,
  Key,
  ExternalLink,
  Code2,
  Terminal,
  FileSpreadsheet,
  Download,
  Search,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { SchemaObject, TableObject, QueryExecutionResult } from '../../types/database';
import { DBEngine } from '../../services/dbEngine';
import { formatSqlQuery } from '../../services/sqlFormatter';

export type JoinType = 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN' | 'FULL OUTER JOIN' | 'CROSS JOIN';

export interface BuilderTable {
  id: string;
  schema: string;
  table: string;
  alias: string;
}

export interface BuilderJoin {
  id: string;
  type: JoinType;
  schema: string;
  table: string;
  alias: string;
  leftTableAlias: string;
  leftColumn: string;
  operator: string;
  rightTableAlias: string;
  rightColumn: string;
}

export interface BuilderColumn {
  id: string;
  tableAlias: string;
  columnName: string;
  alias: string;
  aggregate: '' | 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'UPPER' | 'LOWER' | 'ROUND' | 'DISTINCT';
  customExpr?: string;
}

export interface BuilderFilter {
  id: string;
  tableAlias: string;
  columnName: string;
  operator:
    | '='
    | '!='
    | '>'
    | '>='
    | '<'
    | '<='
    | 'ILIKE'
    | 'NOT_ILIKE'
    | 'STARTS_WITH'
    | 'ENDS_WITH'
    | 'IN'
    | 'NOT_IN'
    | 'IS_NULL'
    | 'IS_NOT_NULL'
    | 'BETWEEN';
  value: string;
  value2?: string;
}

export interface BuilderSort {
  id: string;
  tableAlias: string;
  columnName: string;
  direction: 'ASC' | 'DESC';
  nulls: 'DEFAULT' | 'NULLS FIRST' | 'NULLS LAST';
}

interface VisualQueryBuilderProps {
  schemas: SchemaObject[];
  activeConnectionId?: string;
  initialSchema?: string;
  initialTable?: string;
  onOpenInSqlEditor: (sql: string, title?: string) => void;
  onRunQueryInEngine?: (sql: string) => void;
}

export const VisualQueryBuilder: React.FC<VisualQueryBuilderProps> = ({
  schemas,
  activeConnectionId,
  initialSchema,
  initialTable,
  onOpenInSqlEditor,
}) => {
  // Find default initial schema and table
  const defaultSchema = initialSchema || (schemas[0]?.name ?? 'public');
  const defaultTable =
    initialTable ||
    (schemas.find((s) => s.name === defaultSchema)?.tables[0]?.name ?? 'customers');

  // Builder State
  const [primaryTable, setPrimaryTable] = useState<BuilderTable>({
    id: 'tbl_base',
    schema: defaultSchema,
    table: defaultTable,
    alias: defaultTable.charAt(0).toLowerCase() || 't1',
  });

  const [joins, setJoins] = useState<BuilderJoin[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<BuilderColumn[]>([]);
  const [filters, setFilters] = useState<BuilderFilter[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<'AND' | 'OR'>('AND');
  const [sorts, setSorts] = useState<BuilderSort[]>([]);
  const [limit, setLimit] = useState<number | null>(50);
  const [offset, setOffset] = useState<number | null>(null);
  const [isDistinct, setIsDistinct] = useState(false);
  const [groupByEnabled, setGroupByEnabled] = useState(false);
  const [groupByColumns, setGroupByColumns] = useState<string[]>([]);

  // UI Panels / Tabs
  const [activeBuilderTab, setActiveBuilderTab] = useState<'columns' | 'joins' | 'filters' | 'sorts' | 'grouping'>('columns');
  const [copiedSql, setCopiedSql] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultFilterTerm, setResultFilterTerm] = useState('');

  // Find all current active tables in the builder
  const allActiveTables = useMemo<BuilderTable[]>(() => {
    const list: BuilderTable[] = [primaryTable];
    joins.forEach((j) => {
      list.push({
        id: j.id,
        schema: j.schema,
        table: j.table,
        alias: j.alias,
      });
    });
    return list;
  }, [primaryTable, joins]);

  // Helper to get TableObject by schema & tableName
  const getTableMeta = (schemaName: string, tableName: string): TableObject | undefined => {
    const s = schemas.find((item) => item.name === schemaName);
    return s?.tables.find((t) => t.name === tableName);
  };

  // When primary table changes, populate initial default columns if none selected
  useEffect(() => {
    const meta = getTableMeta(primaryTable.schema, primaryTable.table);
    if (meta && selectedColumns.length === 0) {
      const initialCols: BuilderColumn[] = meta.columns.slice(0, 6).map((c, i) => ({
        id: `col_init_${i}`,
        tableAlias: primaryTable.alias,
        columnName: c.name,
        alias: '',
        aggregate: '',
      }));
      setSelectedColumns(initialCols);
    }
  }, [primaryTable]);

  // Suggest FK joins when a user wants to join a table
  const detectedFkSuggestions = useMemo(() => {
    const suggestions: {
      schema: string;
      table: string;
      leftAlias: string;
      leftCol: string;
      rightAlias: string;
      rightCol: string;
      relationshipName: string;
    }[] = [];

    allActiveTables.forEach((srcTable) => {
      const srcMeta = getTableMeta(srcTable.schema, srcTable.table);
      if (!srcMeta) return;

      // 1. Outgoing FKs from this table
      srcMeta.columns.forEach((col) => {
        if (col.isForeignKey && col.referencesTable) {
          const targetTableName = col.referencesTable;
          const targetColName = col.referencesColumn || 'id';
          const targetAlias = targetTableName.charAt(0).toLowerCase();

          // Avoid duplicate join
          const alreadyJoined = allActiveTables.some(
            (t) => t.table === targetTableName && t.schema === srcTable.schema
          );

          if (!alreadyJoined) {
            suggestions.push({
              schema: srcTable.schema,
              table: targetTableName,
              leftAlias: srcTable.alias,
              leftCol: col.name,
              rightAlias: targetAlias,
              rightCol: targetColName,
              relationshipName: `${srcTable.table}.${col.name} ➔ ${targetTableName}.${targetColName}`,
            });
          }
        }
      });

      // 2. Incoming FKs pointing to this table
      schemas.forEach((s) => {
        s.tables.forEach((candidateTable) => {
          if (candidateTable.name === srcTable.table && s.name === srcTable.schema) return;
          candidateTable.columns.forEach((c) => {
            if (c.isForeignKey && c.referencesTable === srcTable.table) {
              const alreadyJoined = allActiveTables.some(
                (t) => t.table === candidateTable.name && t.schema === s.name
              );
              if (!alreadyJoined) {
                const targetAlias = candidateTable.name.charAt(0).toLowerCase();
                suggestions.push({
                  schema: s.name,
                  table: candidateTable.name,
                  leftAlias: srcTable.alias,
                  leftCol: c.referencesColumn || 'id',
                  rightAlias: targetAlias,
                  rightCol: c.name,
                  relationshipName: `${candidateTable.name}.${c.name} ➔ ${srcTable.table}.${c.referencesColumn || 'id'}`,
                });
              }
            }
          });
        });
      });
    });

    return suggestions;
  }, [allActiveTables, schemas]);

  // Primary Table Change Handler
  const handlePrimaryTableChange = (schemaName: string, tableName: string) => {
    const alias = tableName.charAt(0).toLowerCase() || 't1';
    setPrimaryTable({
      id: 'tbl_base',
      schema: schemaName,
      table: tableName,
      alias,
    });
    setJoins([]);
    const meta = getTableMeta(schemaName, tableName);
    if (meta) {
      setSelectedColumns(
        meta.columns.slice(0, 6).map((c, i) => ({
          id: `col_${Date.now()}_${i}`,
          tableAlias: alias,
          columnName: c.name,
          alias: '',
          aggregate: '',
        }))
      );
    } else {
      setSelectedColumns([]);
    }
    setFilters([]);
    setSorts([]);
  };

  // Add Join Handler
  const handleAddJoin = (
    joinType: JoinType = 'INNER JOIN',
    schema?: string,
    tableName?: string,
    leftAlias?: string,
    leftCol?: string,
    rightCol?: string
  ) => {
    const targetSchema = schema || primaryTable.schema;
    const targetTable = tableName || (schemas.find((s) => s.name === targetSchema)?.tables[1]?.name || 'orders');
    const existingCount = joins.length + 2;
    const targetAlias = targetTable.charAt(0).toLowerCase() + (existingCount > 2 ? existingCount : '');

    const leftTable = leftAlias ? allActiveTables.find((t) => t.alias === leftAlias) : primaryTable;
    const leftMeta = leftTable ? getTableMeta(leftTable.schema, leftTable.table) : null;
    const targetMeta = getTableMeta(targetSchema, targetTable);

    const leftColumnName = leftCol || (leftMeta?.columns[0]?.name ?? 'id');
    const rightColumnName = rightCol || (targetMeta?.columns.find((c) => c.isForeignKey)?.name ?? targetMeta?.columns[0]?.name ?? 'id');

    const newJoin: BuilderJoin = {
      id: `join_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: joinType,
      schema: targetSchema,
      table: targetTable,
      alias: targetAlias,
      leftTableAlias: leftTable?.alias || primaryTable.alias,
      leftColumn: leftColumnName,
      operator: '=',
      rightTableAlias: targetAlias,
      rightColumn: rightColumnName,
    };

    setJoins((prev) => [...prev, newJoin]);
    setActiveBuilderTab('joins');
  };

  // Apply FK Suggestion
  const handleApplyFkSuggestion = (sugg: (typeof detectedFkSuggestions)[0]) => {
    handleAddJoin('INNER JOIN', sugg.schema, sugg.table, sugg.leftAlias, sugg.leftCol, sugg.rightCol);
  };

  // Remove Join Handler
  const handleRemoveJoin = (id: string) => {
    const joinToRemove = joins.find((j) => j.id === id);
    if (!joinToRemove) return;
    setJoins((prev) => prev.filter((j) => j.id !== id));
    // Remove columns & filters belonging to removed table alias
    setSelectedColumns((prev) => prev.filter((c) => c.tableAlias !== joinToRemove.alias));
    setFilters((prev) => prev.filter((f) => f.tableAlias !== joinToRemove.alias));
    setSorts((prev) => prev.filter((s) => s.tableAlias !== joinToRemove.alias));
  };

  // Toggle Column Selection
  const handleToggleColumn = (tableAlias: string, colName: string) => {
    const exists = selectedColumns.find(
      (c) => c.tableAlias === tableAlias && c.columnName === colName && !c.customExpr
    );
    if (exists) {
      setSelectedColumns((prev) => prev.filter((c) => c.id !== exists.id));
    } else {
      setSelectedColumns((prev) => [
        ...prev,
        {
          id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tableAlias,
          columnName: colName,
          alias: '',
          aggregate: '',
        },
      ]);
    }
  };

  // Select/Deselect All Columns for a Table
  const handleSelectAllColumnsForTable = (tableAlias: string, selectAll: boolean) => {
    const tableItem = allActiveTables.find((t) => t.alias === tableAlias);
    if (!tableItem) return;
    const meta = getTableMeta(tableItem.schema, tableItem.table);
    if (!meta) return;

    if (selectAll) {
      const newCols: BuilderColumn[] = meta.columns
        .filter(
          (mc) =>
            !selectedColumns.some(
              (sc) => sc.tableAlias === tableAlias && sc.columnName === mc.name
            )
        )
        .map((mc, idx) => ({
          id: `col_bulk_${Date.now()}_${idx}`,
          tableAlias,
          columnName: mc.name,
          alias: '',
          aggregate: '',
        }));
      setSelectedColumns((prev) => [...prev, ...newCols]);
    } else {
      setSelectedColumns((prev) => prev.filter((c) => c.tableAlias !== tableAlias));
    }
  };

  // Add Custom Expression
  const handleAddCustomExpression = () => {
    setSelectedColumns((prev) => [
      ...prev,
      {
        id: `col_expr_${Date.now()}`,
        tableAlias: primaryTable.alias,
        columnName: '',
        alias: 'custom_metric',
        aggregate: '',
        customExpr: "CONCAT(first_name, ' ', last_name)",
      },
    ]);
    setActiveBuilderTab('columns');
  };

  // Add Filter Rule
  const handleAddFilter = () => {
    const defaultTable = allActiveTables[0];
    const meta = getTableMeta(defaultTable.schema, defaultTable.table);
    const newFilter: BuilderFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tableAlias: defaultTable.alias,
      columnName: meta?.columns[0]?.name || 'id',
      operator: '=',
      value: '',
    };
    setFilters((prev) => [...prev, newFilter]);
    setActiveBuilderTab('filters');
  };

  // Add Sort Rule
  const handleAddSort = () => {
    const defaultTable = allActiveTables[0];
    const meta = getTableMeta(defaultTable.schema, defaultTable.table);
    const newSort: BuilderSort = {
      id: `sort_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tableAlias: defaultTable.alias,
      columnName: meta?.columns[0]?.name || 'id',
      direction: 'ASC',
      nulls: 'DEFAULT',
    };
    setSorts((prev) => [...prev, newSort]);
    setActiveBuilderTab('sorts');
  };

  // Preset Template loader
  const handleLoadTemplate = (templateType: 'customer_orders' | 'top_spenders' | 'sales_by_category' | 'recent_activity') => {
    if (templateType === 'customer_orders') {
      setPrimaryTable({
        id: 'tbl_base',
        schema: 'public',
        table: 'customers',
        alias: 'c',
      });
      setJoins([
        {
          id: 'join_orders',
          type: 'INNER JOIN',
          schema: 'public',
          table: 'orders',
          alias: 'o',
          leftTableAlias: 'c',
          leftColumn: 'id',
          operator: '=',
          rightTableAlias: 'o',
          rightColumn: 'customer_id',
        },
      ]);
      setSelectedColumns([
        { id: 'c1', tableAlias: 'c', columnName: 'id', alias: 'customer_id', aggregate: '' },
        { id: 'c2', tableAlias: 'c', columnName: 'first_name', alias: 'first_name', aggregate: '' },
        { id: 'c3', tableAlias: 'c', columnName: 'email', alias: 'email', aggregate: '' },
        { id: 'c4', tableAlias: 'o', columnName: 'order_number', alias: 'order_number', aggregate: '' },
        { id: 'c5', tableAlias: 'o', columnName: 'total_amount', alias: 'total_amount', aggregate: '' },
        { id: 'c6', tableAlias: 'o', columnName: 'status', alias: 'status', aggregate: '' },
      ]);
      setFilters([
        { id: 'f1', tableAlias: 'o', columnName: 'total_amount', operator: '>', value: '50' },
      ]);
      setSorts([
        { id: 's1', tableAlias: 'o', columnName: 'total_amount', direction: 'DESC', nulls: 'DEFAULT' },
      ]);
      setLimit(25);
    } else if (templateType === 'top_spenders') {
      setPrimaryTable({
        id: 'tbl_base',
        schema: 'public',
        table: 'customers',
        alias: 'c',
      });
      setJoins([]);
      setSelectedColumns([
        { id: 'c1', tableAlias: 'c', columnName: 'first_name', alias: '', aggregate: '' },
        { id: 'c2', tableAlias: 'c', columnName: 'last_name', alias: '', aggregate: '' },
        { id: 'c3', tableAlias: 'c', columnName: 'email', alias: '', aggregate: '' },
        { id: 'c4', tableAlias: 'c', columnName: 'total_spent', alias: 'total_spent', aggregate: '' },
        { id: 'c5', tableAlias: 'c', columnName: 'loyalty_tier', alias: 'loyalty_tier', aggregate: '' },
      ]);
      setFilters([
        { id: 'f1', tableAlias: 'c', columnName: 'loyalty_tier', operator: '=', value: 'Platinum' },
      ]);
      setSorts([
        { id: 's1', tableAlias: 'c', columnName: 'total_spent', direction: 'DESC', nulls: 'DEFAULT' },
      ]);
      setLimit(10);
    } else if (templateType === 'sales_by_category') {
      setPrimaryTable({
        id: 'tbl_base',
        schema: 'public',
        table: 'products',
        alias: 'p',
      });
      setJoins([]);
      setSelectedColumns([
        { id: 'c1', tableAlias: 'p', columnName: 'category', alias: 'category', aggregate: '' },
        { id: 'c2', tableAlias: 'p', columnName: 'id', alias: 'product_count', aggregate: 'COUNT' },
        { id: 'c3', tableAlias: 'p', columnName: 'price', alias: 'avg_price', aggregate: 'AVG' },
        { id: 'c4', tableAlias: 'p', columnName: 'stock_quantity', alias: 'total_stock', aggregate: 'SUM' },
      ]);
      setGroupByEnabled(true);
      setGroupByColumns(['p.category']);
      setFilters([]);
      setSorts([
        { id: 's1', tableAlias: 'p', columnName: 'price', direction: 'DESC', nulls: 'DEFAULT' },
      ]);
      setLimit(20);
    }
  };

  // Reset Builder to defaults
  const handleResetBuilder = () => {
    handlePrimaryTableChange(defaultSchema, defaultTable);
  };

  // Generated SQL Query String Generation
  const generatedSql = useMemo(() => {
    // 1. SELECT Clause
    let selectParts: string[] = [];
    if (selectedColumns.length === 0) {
      selectParts = [`${primaryTable.alias}.*`];
    } else {
      selectParts = selectedColumns.map((col) => {
        let expr = '';
        if (col.customExpr) {
          expr = col.customExpr;
        } else {
          const colRef = `${col.tableAlias}.${col.columnName}`;
          switch (col.aggregate) {
            case 'COUNT':
              expr = `COUNT(${colRef})`;
              break;
            case 'COUNT_DISTINCT':
              expr = `COUNT(DISTINCT ${colRef})`;
              break;
            case 'SUM':
              expr = `SUM(${colRef})`;
              break;
            case 'AVG':
              expr = `AVG(${colRef})`;
              break;
            case 'MIN':
              expr = `MIN(${colRef})`;
              break;
            case 'MAX':
              expr = `MAX(${colRef})`;
              break;
            case 'UPPER':
              expr = `UPPER(${colRef})`;
              break;
            case 'LOWER':
              expr = `LOWER(${colRef})`;
              break;
            case 'ROUND':
              expr = `ROUND(${colRef}::numeric, 2)`;
              break;
            case 'DISTINCT':
              expr = `DISTINCT ${colRef}`;
              break;
            default:
              expr = colRef;
          }
        }

        if (col.alias && col.alias.trim()) {
          expr += ` AS ${col.alias.trim()}`;
        }
        return expr;
      });
    }

    const distinctStr = isDistinct ? 'DISTINCT ' : '';
    let sql = `SELECT ${distinctStr}\n    ${selectParts.join(',\n    ')}\n`;

    // 2. FROM Clause
    sql += `FROM ${primaryTable.schema}.${primaryTable.table} ${primaryTable.alias}\n`;

    // 3. JOIN Clauses
    joins.forEach((j) => {
      if (j.type === 'CROSS JOIN') {
        sql += `${j.type} ${j.schema}.${j.table} ${j.alias}\n`;
      } else {
        sql += `${j.type} ${j.schema}.${j.table} ${j.alias} ON ${j.leftTableAlias}.${j.leftColumn} ${j.operator} ${j.rightTableAlias}.${j.rightColumn}\n`;
      }
    });

    // 4. WHERE Clause
    const validFilters = filters.filter((f) => {
      if (f.operator === 'IS_NULL' || f.operator === 'IS_NOT_NULL') return true;
      return f.value.trim() !== '';
    });

    if (validFilters.length > 0) {
      const filterLines = validFilters.map((f) => {
        const field = `${f.tableAlias}.${f.columnName}`;
        const val = f.value.trim();
        const isNum = !isNaN(Number(val)) && val !== '';
        const escaped = val.replace(/'/g, "''");

        switch (f.operator) {
          case '=':
            return `${field} = ${isNum ? val : `'${escaped}'`}`;
          case '!=':
            return `${field} <> ${isNum ? val : `'${escaped}'`}`;
          case '>':
            return `${field} > ${isNum ? val : `'${escaped}'`}`;
          case '>=':
            return `${field} >= ${isNum ? val : `'${escaped}'`}`;
          case '<':
            return `${field} < ${isNum ? val : `'${escaped}'`}`;
          case '<=':
            return `${field} <= ${isNum ? val : `'${escaped}'`}`;
          case 'ILIKE':
            return `${field} ILIKE '%${escaped}%'`;
          case 'NOT_ILIKE':
            return `${field} NOT ILIKE '%${escaped}%'`;
          case 'STARTS_WITH':
            return `${field} ILIKE '${escaped}%'`;
          case 'ENDS_WITH':
            return `${field} ILIKE '%${escaped}'`;
          case 'IS_NULL':
            return `${field} IS NULL`;
          case 'IS_NOT_NULL':
            return `${field} IS NOT NULL`;
          case 'IN': {
            const items = val
              .split(',')
              .map((s) => `'${s.trim().replace(/'/g, "''")}'`)
              .join(', ');
            return `${field} IN (${items})`;
          }
          case 'NOT_IN': {
            const items = val
              .split(',')
              .map((s) => `'${s.trim().replace(/'/g, "''")}'`)
              .join(', ');
            return `${field} NOT IN (${items})`;
          }
          case 'BETWEEN':
            return `${field} BETWEEN '${escaped}' AND '${(f.value2 || '').trim().replace(/'/g, "''")}'`;
          default:
            return `${field} = '${escaped}'`;
        }
      });

      sql += `WHERE\n    ${filterLines.join(`\n    ${filterMatchMode} `)}\n`;
    }

    // 5. GROUP BY Clause
    if (groupByEnabled) {
      if (groupByColumns.length > 0) {
        sql += `GROUP BY\n    ${groupByColumns.join(', ')}\n`;
      } else {
        // Auto-group by non-aggregated columns
        const nonAggCols = selectedColumns
          .filter((c) => !c.aggregate || c.aggregate === 'DISTINCT')
          .map((c) => (c.customExpr ? c.customExpr : `${c.tableAlias}.${c.columnName}`));
        if (nonAggCols.length > 0) {
          sql += `GROUP BY\n    ${nonAggCols.join(', ')}\n`;
        }
      }
    }

    // 6. ORDER BY Clause
    if (sorts.length > 0) {
      const sortLines = sorts.map((s) => {
        let line = `${s.tableAlias}.${s.columnName} ${s.direction}`;
        if (s.nulls !== 'DEFAULT') {
          line += ` ${s.nulls}`;
        }
        return line;
      });
      sql += `ORDER BY\n    ${sortLines.join(', ')}\n`;
    }

    // 7. LIMIT & OFFSET
    if (limit && limit > 0) {
      sql += `LIMIT ${limit}\n`;
    }
    if (offset && offset > 0) {
      sql += `OFFSET ${offset}\n`;
    }

    sql = sql.trim() + ';';
    return formatSqlQuery(sql, 'postgresql');
  }, [
    primaryTable,
    joins,
    selectedColumns,
    filters,
    filterMatchMode,
    groupByEnabled,
    groupByColumns,
    sorts,
    limit,
    offset,
    isDistinct,
  ]);

  // Execute Query in Engine
  const handleExecute = () => {
    setIsExecuting(true);
    try {
      const connId = activeConnectionId || 'conn-ecommerce-pg';
      const res = DBEngine.executeQuery(connId, generatedSql, primaryTable.schema);
      setQueryResult(res);
    } catch (err: any) {
      setQueryResult({
        query: generatedSql,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        status: 'error',
        error: err.message || 'Execution failed',
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Run automatically when first opening or clicking run
  useEffect(() => {
    handleExecute();
  }, [primaryTable.table]);

  // Copy SQL to clipboard
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(generatedSql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered rows for the results view
  const displayResults = useMemo(() => {
    if (!queryResult || queryResult.status !== 'success') return [];
    if (!resultFilterTerm) return queryResult.rows;
    const term = resultFilterTerm.toLowerCase();
    return queryResult.rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }, [queryResult, resultFilterTerm]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F1115] text-[#E2E8F0] font-sans overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="h-11 bg-[#181A1F] border-b border-[#2D3139] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
            <div className="p-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/40">
              <Boxes className="w-4 h-4" />
            </div>
            <span>Visual Query Builder</span>
          </div>

          <div className="h-4 w-px bg-[#2D3139]" />

          {/* Base Schema & Table Selector */}
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="text-[#64748B] text-[11px] font-semibold">FROM:</span>
            <select
              value={primaryTable.schema}
              onChange={(e) => {
                const sName = e.target.value;
                const firstTbl = schemas.find((s) => s.name === sName)?.tables[0]?.name || 'customers';
                handlePrimaryTableChange(sName, firstTbl);
              }}
              className="bg-[#0F1115] border border-[#2D3139] rounded px-2 py-1 text-xs text-blue-400 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {schemas.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <span className="text-[#64748B]">.</span>

            <select
              value={primaryTable.table}
              onChange={(e) => handlePrimaryTableChange(primaryTable.schema, e.target.value)}
              className="bg-[#0F1115] border border-[#2D3139] rounded px-2 py-1 text-xs text-[#E2E8F0] font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {schemas
                .find((s) => s.name === primaryTable.schema)
                ?.tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.rowCount} rows)
                  </option>
                ))}
            </select>

            <span className="text-[11px] text-[#64748B] ml-1">AS {primaryTable.alias}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Preset Templates */}
          <div className="relative group">
            <button className="px-2.5 py-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#94A3B8] hover:text-[#E2E8F0] text-xs font-medium rounded flex items-center space-x-1.5 transition-colors cursor-pointer">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 text-[#64748B]" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-52 bg-[#181A1F] border border-[#2D3139] rounded shadow-xl py-1 hidden group-hover:block z-50 text-xs">
              <button
                onClick={() => handleLoadTemplate('customer_orders')}
                className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] text-[#E2E8F0] flex items-center justify-between"
              >
                <span>Customers & Orders Join</span>
                <span className="text-[10px] text-[#64748B]">JOIN</span>
              </button>
              <button
                onClick={() => handleLoadTemplate('top_spenders')}
                className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] text-[#E2E8F0] flex items-center justify-between"
              >
                <span>Top Spenders Filter</span>
                <span className="text-[10px] text-[#64748B]">WHERE</span>
              </button>
              <button
                onClick={() => handleLoadTemplate('sales_by_category')}
                className="w-full px-3 py-1.5 text-left hover:bg-[#2D3139] text-[#E2E8F0] flex items-center justify-between"
              >
                <span>Product Sales Aggregation</span>
                <span className="text-[10px] text-[#64748B]">GROUP BY</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleResetBuilder}
            title="Reset Builder to Default State"
            className="p-1.5 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#94A3B8] hover:text-white rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopySql}
            className="px-2.5 py-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-[#E2E8F0] text-xs font-medium rounded flex items-center space-x-1.5 transition-colors"
          >
            {copiedSql ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>Copy SQL</span>
              </>
            )}
          </button>

          <button
            onClick={() => onOpenInSqlEditor(generatedSql, `Builder: ${primaryTable.table}`)}
            className="px-2.5 py-1 bg-[#2D3139] hover:bg-blue-950/80 hover:border-blue-600 text-blue-300 border border-[#3B414D] text-xs font-semibold rounded flex items-center space-x-1.5 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open in Editor</span>
          </button>

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
            <span>Run Query</span>
          </button>
        </div>
      </div>

      {/* Main Builder Grid Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Visual Step Builder Controls */}
        <div className="w-7/12 border-r border-[#2D3139] flex flex-col bg-[#14171D] overflow-hidden">
          {/* Builder Step Navigation Tabs */}
          <div className="h-10 bg-[#181A1F] border-b border-[#2D3139] flex items-center px-3 space-x-1 shrink-0 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveBuilderTab('columns')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeBuilderTab === 'columns'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>1. Columns ({selectedColumns.length})</span>
            </button>

            <button
              onClick={() => setActiveBuilderTab('joins')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeBuilderTab === 'joins'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>2. Joins ({joins.length})</span>
            </button>

            <button
              onClick={() => setActiveBuilderTab('filters')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeBuilderTab === 'filters'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>3. Filters ({filters.length})</span>
            </button>

            <button
              onClick={() => setActiveBuilderTab('grouping')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeBuilderTab === 'grouping'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>4. Group By</span>
            </button>

            <button
              onClick={() => setActiveBuilderTab('sorts')}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeBuilderTab === 'sorts'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#2D3139]'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>5. Order & Limit ({sorts.length})</span>
            </button>
          </div>

          {/* Builder Step Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {/* TAB 1: COLUMNS (SELECT) */}
            {activeBuilderTab === 'columns' && (
              <div className="space-y-4">
                {/* Available Tables & Column Pickers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                      <TableIcon className="w-3.5 h-3.5 text-blue-400" />
                      <span>Available Table Columns</span>
                    </h3>
                    <button
                      onClick={handleAddCustomExpression}
                      className="px-2 py-1 bg-[#2D3139] hover:bg-[#3B414D] border border-[#3B414D] text-cyan-300 text-[11px] font-semibold rounded flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Expression / Formula</span>
                    </button>
                  </div>

                  {/* Tables Column Selector Grid */}
                  <div className="space-y-3">
                    {allActiveTables.map((tbl) => {
                      const meta = getTableMeta(tbl.schema, tbl.table);
                      if (!meta) return null;

                      const selectedCount = selectedColumns.filter((c) => c.tableAlias === tbl.alias).length;

                      return (
                        <div key={tbl.id} className="bg-[#0F1115] border border-[#2D3139] rounded-lg p-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#2D3139]/80 mb-2.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-xs font-mono">
                                {tbl.schema}.{tbl.table}
                              </span>
                              <span className="px-1.5 py-0.2 bg-blue-950 text-blue-300 rounded text-[10px] font-mono">
                                AS {tbl.alias}
                              </span>
                              <span className="text-[11px] text-[#64748B]">
                                ({selectedCount} of {meta.columns.length} selected)
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => handleSelectAllColumnsForTable(tbl.alias, true)}
                                className="px-2 py-0.5 bg-[#2D3139] hover:bg-[#3B414D] text-[10px] text-[#E2E8F0] rounded"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() => handleSelectAllColumnsForTable(tbl.alias, false)}
                                className="px-2 py-0.5 bg-[#2D3139] hover:bg-[#3B414D] text-[10px] text-[#94A3B8] rounded"
                              >
                                Deselect
                              </button>
                            </div>
                          </div>

                          {/* Column Pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {meta.columns.map((col) => {
                              const isSelected = selectedColumns.some(
                                (c) => c.tableAlias === tbl.alias && c.columnName === col.name
                              );
                              return (
                                <button
                                  key={col.name}
                                  onClick={() => handleToggleColumn(tbl.alias, col.name)}
                                  className={`px-2 py-1 rounded text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'bg-blue-950/80 border-blue-600 text-blue-200 font-semibold shadow-xs'
                                      : 'bg-[#181A1F] border-[#2D3139] text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#3B414D]'
                                  }`}
                                >
                                  {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-400" />}
                                  {col.isForeignKey && <Link2 className="w-3 h-3 text-cyan-400" />}
                                  <span>{col.name}</span>
                                  <span className="text-[9px] opacity-60">({col.type})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Projections Customizer Table */}
                <div className="space-y-2 pt-2 border-t border-[#2D3139]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Selected Output Columns & Aggregations</span>
                    </h3>
                    <label className="flex items-center space-x-1.5 text-xs text-[#94A3B8] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDistinct}
                        onChange={(e) => setIsDistinct(e.target.checked)}
                        className="rounded border-[#2D3139] text-blue-600 focus:ring-0"
                      />
                      <span>DISTINCT Rows</span>
                    </label>
                  </div>

                  <div className="bg-[#0F1115] border border-[#2D3139] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#181A1F] border-b border-[#2D3139] text-[#64748B]">
                        <tr>
                          <th className="px-3 py-1.5 w-8 text-center">#</th>
                          <th className="px-3 py-1.5">Source Column / Expr</th>
                          <th className="px-3 py-1.5 w-36">Function</th>
                          <th className="px-3 py-1.5 w-44">Output Alias (AS)</th>
                          <th className="px-2 py-1.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3139]/60">
                        {selectedColumns.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-[#64748B]">
                              No columns selected. Click column pills above or use Select All.
                            </td>
                          </tr>
                        ) : (
                          selectedColumns.map((col, idx) => (
                            <tr key={col.id} className="hover:bg-[#181A1F]/60">
                              <td className="px-3 py-1.5 text-center text-[#64748B] text-[10px]">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-1.5 text-white">
                                {col.customExpr ? (
                                  <input
                                    type="text"
                                    value={col.customExpr}
                                    onChange={(e) =>
                                      setSelectedColumns((prev) =>
                                        prev.map((c) =>
                                          c.id === col.id ? { ...c, customExpr: e.target.value } : c
                                        )
                                      )
                                    }
                                    placeholder="e.g. price * quantity"
                                    className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-cyan-300 font-mono focus:border-cyan-500"
                                  />
                                ) : (
                                  <span className="font-semibold text-blue-300">
                                    {col.tableAlias}.{col.columnName}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5">
                                <select
                                  value={col.aggregate}
                                  onChange={(e) =>
                                    setSelectedColumns((prev) =>
                                      prev.map((c) =>
                                        c.id === col.id
                                          ? { ...c, aggregate: e.target.value as BuilderColumn['aggregate'] }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-[#E2E8F0] focus:border-blue-500"
                                >
                                  <option value="">None</option>
                                  <option value="COUNT">COUNT()</option>
                                  <option value="COUNT_DISTINCT">COUNT(DISTINCT)</option>
                                  <option value="SUM">SUM()</option>
                                  <option value="AVG">AVG()</option>
                                  <option value="MIN">MIN()</option>
                                  <option value="MAX">MAX()</option>
                                  <option value="DISTINCT">DISTINCT</option>
                                  <option value="UPPER">UPPER()</option>
                                  <option value="LOWER">LOWER()</option>
                                  <option value="ROUND">ROUND(::numeric, 2)</option>
                                </select>
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  placeholder={col.columnName || 'alias_name'}
                                  value={col.alias}
                                  onChange={(e) =>
                                    setSelectedColumns((prev) =>
                                      prev.map((c) => (c.id === col.id ? { ...c, alias: e.target.value } : c))
                                    )
                                  }
                                  className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-[#E2E8F0] focus:border-blue-500"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  onClick={() => setSelectedColumns((prev) => prev.filter((c) => c.id !== col.id))}
                                  className="text-[#64748B] hover:text-rose-400 p-0.5 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: JOINS */}
            {activeBuilderTab === 'joins' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                      <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Table Relationships & Joins</span>
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      Connect related tables via primary & foreign key conditions.
                    </p>
                  </div>

                  <button
                    onClick={() => handleAddJoin()}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Joined Table</span>
                  </button>
                </div>

                {/* Auto FK Suggestions */}
                {detectedFkSuggestions.length > 0 && (
                  <div className="p-3 bg-[#0F1115] border border-blue-900/60 rounded-lg space-y-2">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-blue-300">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Detected Foreign Key Relationships:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detectedFkSuggestions.map((sugg, i) => (
                        <button
                          key={i}
                          onClick={() => handleApplyFkSuggestion(sugg)}
                          className="px-2.5 py-1 bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800 rounded text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-cyan-400" />
                          <span>Join {sugg.table} ({sugg.relationshipName})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Joins List */}
                <div className="space-y-3">
                  {joins.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-[#2D3139] rounded-lg bg-[#0F1115]/50 text-xs text-[#64748B]">
                      No joined tables yet. Query is querying from {primaryTable.schema}.{primaryTable.table} only.
                    </div>
                  ) : (
                    joins.map((j, idx) => (
                      <div key={j.id} className="bg-[#0F1115] border border-[#2D3139] rounded-lg p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-blue-400">Join #{idx + 1}</span>

                            <select
                              value={j.type}
                              onChange={(e) =>
                                setJoins((prev) =>
                                  prev.map((item) =>
                                    item.id === j.id ? { ...item, type: e.target.value as JoinType } : item
                                  )
                                )
                              }
                              className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-blue-300 font-bold focus:border-blue-500"
                            >
                              <option value="INNER JOIN">INNER JOIN</option>
                              <option value="LEFT JOIN">LEFT JOIN</option>
                              <option value="RIGHT JOIN">RIGHT JOIN</option>
                              <option value="FULL OUTER JOIN">FULL OUTER JOIN</option>
                              <option value="CROSS JOIN">CROSS JOIN</option>
                            </select>

                            <select
                              value={j.table}
                              onChange={(e) => {
                                const newTable = e.target.value;
                                const newMeta = getTableMeta(j.schema, newTable);
                                const newAlias = newTable.charAt(0).toLowerCase() + (idx + 2);
                                setJoins((prev) =>
                                  prev.map((item) =>
                                    item.id === j.id
                                      ? {
                                          ...item,
                                          table: newTable,
                                          alias: newAlias,
                                          rightTableAlias: newAlias,
                                          rightColumn: newMeta?.columns[0]?.name || 'id',
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-white font-bold font-mono focus:border-blue-500"
                            >
                              {schemas
                                .find((s) => s.name === j.schema)
                                ?.tables.map((t) => (
                                  <option key={t.name} value={t.name}>
                                    {t.name}
                                  </option>
                                ))}
                            </select>

                            <span className="text-xs text-[#64748B] font-mono">AS {j.alias}</span>
                          </div>

                          <button
                            onClick={() => handleRemoveJoin(j.id)}
                            className="text-[#64748B] hover:text-rose-400 p-1 rounded"
                            title="Remove Join"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {j.type !== 'CROSS JOIN' && (
                          <div className="flex items-center space-x-2 pt-2 border-t border-[#2D3139]/80 text-xs font-mono">
                            <span className="text-[#64748B] font-bold">ON</span>

                            {/* Left Table & Column */}
                            <select
                              value={j.leftTableAlias}
                              onChange={(e) =>
                                setJoins((prev) =>
                                  prev.map((item) =>
                                    item.id === j.id ? { ...item, leftTableAlias: e.target.value } : item
                                  )
                                )
                              }
                              className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-blue-300"
                            >
                              {allActiveTables
                                .filter((t) => t.alias !== j.alias)
                                .map((t) => (
                                  <option key={t.alias} value={t.alias}>
                                    {t.table} ({t.alias})
                                  </option>
                                ))}
                            </select>

                            <span className="text-[#64748B]">.</span>

                            <select
                              value={j.leftColumn}
                              onChange={(e) =>
                                setJoins((prev) =>
                                  prev.map((item) =>
                                    item.id === j.id ? { ...item, leftColumn: e.target.value } : item
                                  )
                                )
                              }
                              className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-[#E2E8F0]"
                            >
                              {(() => {
                                const leftTbl = allActiveTables.find((t) => t.alias === j.leftTableAlias);
                                const meta = leftTbl ? getTableMeta(leftTbl.schema, leftTbl.table) : null;
                                return meta?.columns.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ));
                              })()}
                            </select>

                            <span className="text-[#64748B] font-bold">=</span>

                            {/* Right Table & Column */}
                            <span className="text-blue-300 font-semibold">{j.alias}.</span>

                            <select
                              value={j.rightColumn}
                              onChange={(e) =>
                                setJoins((prev) =>
                                  prev.map((item) =>
                                    item.id === j.id ? { ...item, rightColumn: e.target.value } : item
                                  )
                                )
                              }
                              className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-[#E2E8F0]"
                            >
                              {getTableMeta(j.schema, j.table)?.columns.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: FILTERS (WHERE) */}
            {activeBuilderTab === 'filters' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                      <Filter className="w-3.5 h-3.5 text-blue-400" />
                      <span>WHERE Filter Conditions</span>
                    </h3>

                    <div className="flex items-center space-x-1 bg-[#0F1115] border border-[#2D3139] p-0.5 rounded text-xs font-mono">
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

                  <button
                    onClick={handleAddFilter}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Condition</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {filters.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-[#2D3139] rounded-lg bg-[#0F1115]/50 text-xs text-[#64748B]">
                      No WHERE criteria configured. All rows will be retrieved.
                    </div>
                  ) : (
                    filters.map((f, index) => (
                      <div
                        key={f.id}
                        className="flex items-center space-x-2 bg-[#0F1115] border border-[#2D3139] rounded-lg p-2 font-mono text-xs"
                      >
                        <span className="w-12 text-[10px] font-bold text-center text-[#64748B]">
                          {index === 0 ? 'WHERE' : filterMatchMode}
                        </span>

                        {/* Table Selector */}
                        <select
                          value={f.tableAlias}
                          onChange={(e) => {
                            const newAlias = e.target.value;
                            const tbl = allActiveTables.find((t) => t.alias === newAlias);
                            const meta = tbl ? getTableMeta(tbl.schema, tbl.table) : null;
                            setFilters((prev) =>
                              prev.map((item) =>
                                item.id === f.id
                                  ? { ...item, tableAlias: newAlias, columnName: meta?.columns[0]?.name || 'id' }
                                  : item
                              )
                            );
                          }}
                          className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-blue-300"
                        >
                          {allActiveTables.map((t) => (
                            <option key={t.alias} value={t.alias}>
                              {t.table} ({t.alias})
                            </option>
                          ))}
                        </select>

                        <span className="text-[#64748B]">.</span>

                        {/* Column Selector */}
                        <select
                          value={f.columnName}
                          onChange={(e) =>
                            setFilters((prev) =>
                              prev.map((item) => (item.id === f.id ? { ...item, columnName: e.target.value } : item))
                            )
                          }
                          className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-white"
                        >
                          {(() => {
                            const tbl = allActiveTables.find((t) => t.alias === f.tableAlias);
                            const meta = tbl ? getTableMeta(tbl.schema, tbl.table) : null;
                            return meta?.columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({c.type})
                              </option>
                            ));
                          })()}
                        </select>

                        {/* Operator */}
                        <select
                          value={f.operator}
                          onChange={(e) =>
                            setFilters((prev) =>
                              prev.map((item) =>
                                item.id === f.id
                                  ? { ...item, operator: e.target.value as BuilderFilter['operator'] }
                                  : item
                              )
                            )
                          }
                          className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-blue-400"
                        >
                          <option value="=">= (equals)</option>
                          <option value="!=">!= (not equals)</option>
                          <option value=">">&gt; (greater than)</option>
                          <option value=">=">&gt;= (greater or equal)</option>
                          <option value="<">&lt; (less than)</option>
                          <option value="<=">&lt;= (less or equal)</option>
                          <option value="ILIKE">contains (ILIKE)</option>
                          <option value="NOT_ILIKE">does not contain</option>
                          <option value="STARTS_WITH">starts with</option>
                          <option value="ENDS_WITH">ends with</option>
                          <option value="IN">IN (comma list)</option>
                          <option value="NOT_IN">NOT IN</option>
                          <option value="IS_NULL">IS NULL</option>
                          <option value="IS_NOT_NULL">IS NOT NULL</option>
                          <option value="BETWEEN">BETWEEN</option>
                        </select>

                        {/* Value Input */}
                        {f.operator !== 'IS_NULL' && f.operator !== 'IS_NOT_NULL' && (
                          <div className="flex-1 flex items-center space-x-1">
                            <input
                              type="text"
                              placeholder={f.operator === 'IN' ? 'val1, val2, val3' : 'Filter value...'}
                              value={f.value}
                              onChange={(e) =>
                                setFilters((prev) =>
                                  prev.map((item) =>
                                    item.id === f.id ? { ...item, value: e.target.value } : item
                                  )
                                )
                              }
                              className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2.5 py-1 text-xs text-[#E2E8F0] focus:border-blue-500"
                            />

                            {f.operator === 'BETWEEN' && (
                              <>
                                <span className="text-[#64748B] text-[10px]">AND</span>
                                <input
                                  type="text"
                                  placeholder="End value"
                                  value={f.value2 || ''}
                                  onChange={(e) =>
                                    setFilters((prev) =>
                                      prev.map((item) =>
                                        item.id === f.id ? { ...item, value2: e.target.value } : item
                                      )
                                    )
                                  }
                                  className="w-full bg-[#181A1F] border border-[#2D3139] rounded px-2.5 py-1 text-xs text-[#E2E8F0] focus:border-blue-500"
                                />
                              </>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => setFilters((prev) => prev.filter((item) => item.id !== f.id))}
                          className="p-1 text-[#64748B] hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: GROUP BY */}
            {activeBuilderTab === 'grouping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>GROUP BY & Aggregate Rollups</span>
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      Group records for SUM, COUNT, AVG aggregations.
                    </p>
                  </div>

                  <label className="flex items-center space-x-2 text-xs font-bold text-[#E2E8F0] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupByEnabled}
                      onChange={(e) => setGroupByEnabled(e.target.checked)}
                      className="rounded border-[#2D3139] text-purple-600 focus:ring-0"
                    />
                    <span>Enable GROUP BY Clause</span>
                  </label>
                </div>

                {groupByEnabled ? (
                  <div className="space-y-3 bg-[#0F1115] border border-[#2D3139] rounded-lg p-3">
                    <p className="text-xs text-[#94A3B8]">
                      Select columns to group by:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allActiveTables.map((tbl) => {
                        const meta = getTableMeta(tbl.schema, tbl.table);
                        return meta?.columns.map((c) => {
                          const colKey = `${tbl.alias}.${c.name}`;
                          const isGrouped = groupByColumns.includes(colKey);
                          return (
                            <button
                              key={colKey}
                              onClick={() => {
                                setGroupByColumns((prev) =>
                                  prev.includes(colKey)
                                    ? prev.filter((k) => k !== colKey)
                                    : [...prev, colKey]
                                );
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-mono flex items-center space-x-1 border transition-all cursor-pointer ${
                                isGrouped
                                  ? 'bg-purple-950 border-purple-600 text-purple-200 font-bold'
                                  : 'bg-[#181A1F] border-[#2D3139] text-[#94A3B8] hover:text-white'
                              }`}
                            >
                              <span>{colKey}</span>
                              {isGrouped && <Check className="w-3 h-3 text-purple-400 ml-1" />}
                            </button>
                          );
                        });
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-[#2D3139] rounded-lg bg-[#0F1115]/50 text-xs text-[#64748B]">
                    GROUP BY is disabled. Check the box above to group rows by specific dimensions.
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: SORTS & LIMIT */}
            {activeBuilderTab === 'sorts' && (
              <div className="space-y-4">
                {/* SORTS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                      <span>ORDER BY (Sorting)</span>
                    </h3>
                    <button
                      onClick={handleAddSort}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Sort Column</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sorts.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-[#2D3139] rounded-lg bg-[#0F1115]/50 text-xs text-[#64748B]">
                        No explicit ORDER BY clause. Data is returned in default table order.
                      </div>
                    ) : (
                      sorts.map((s, idx) => (
                        <div
                          key={s.id}
                          className="flex items-center space-x-2 bg-[#0F1115] border border-[#2D3139] rounded-lg p-2 font-mono text-xs"
                        >
                          <span className="w-6 text-[10px] text-center text-[#64748B]">#{idx + 1}</span>

                          <select
                            value={s.tableAlias}
                            onChange={(e) => {
                              const newAlias = e.target.value;
                              const tbl = allActiveTables.find((t) => t.alias === newAlias);
                              const meta = tbl ? getTableMeta(tbl.schema, tbl.table) : null;
                              setSorts((prev) =>
                                prev.map((item) =>
                                  item.id === s.id
                                    ? { ...item, tableAlias: newAlias, columnName: meta?.columns[0]?.name || 'id' }
                                    : item
                                )
                              );
                            }}
                            className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-blue-300"
                          >
                            {allActiveTables.map((t) => (
                              <option key={t.alias} value={t.alias}>
                                {t.table} ({t.alias})
                              </option>
                            ))}
                          </select>

                          <span className="text-[#64748B]">.</span>

                          <select
                            value={s.columnName}
                            onChange={(e) =>
                              setSorts((prev) =>
                                prev.map((item) => (item.id === s.id ? { ...item, columnName: e.target.value } : item))
                              )
                            }
                            className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-white"
                          >
                            {(() => {
                              const tbl = allActiveTables.find((t) => t.alias === s.tableAlias);
                              const meta = tbl ? getTableMeta(tbl.schema, tbl.table) : null;
                              return meta?.columns.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ));
                            })()}
                          </select>

                          <select
                            value={s.direction}
                            onChange={(e) =>
                              setSorts((prev) =>
                                prev.map((item) =>
                                  item.id === s.id ? { ...item, direction: e.target.value as 'ASC' | 'DESC' } : item
                                )
                              )
                            }
                            className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-amber-400 font-bold"
                          >
                            <option value="ASC">ASC (Lowest First)</option>
                            <option value="DESC">DESC (Highest First)</option>
                          </select>

                          <select
                            value={s.nulls}
                            onChange={(e) =>
                              setSorts((prev) =>
                                prev.map((item) =>
                                  item.id === s.id
                                    ? { ...item, nulls: e.target.value as BuilderSort['nulls'] }
                                    : item
                                )
                              )
                            }
                            className="bg-[#181A1F] border border-[#2D3139] rounded px-2 py-1 text-xs text-[#94A3B8]"
                          >
                            <option value="DEFAULT">Default NULLs</option>
                            <option value="NULLS FIRST">NULLS FIRST</option>
                            <option value="NULLS LAST">NULLS LAST</option>
                          </select>

                          <button
                            onClick={() => setSorts((prev) => prev.filter((item) => item.id !== s.id))}
                            className="p-1 text-[#64748B] hover:text-rose-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* LIMIT & OFFSET */}
                <div className="space-y-3 pt-3 border-t border-[#2D3139]">
                  <h3 className="text-xs font-bold text-[#E2E8F0] uppercase tracking-wider flex items-center space-x-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pagination Limits (LIMIT & OFFSET)</span>
                  </h3>

                  <div className="flex items-center space-x-4 bg-[#0F1115] border border-[#2D3139] rounded-lg p-3 text-xs font-mono">
                    <div className="flex items-center space-x-2">
                      <span className="text-[#64748B] font-bold">LIMIT:</span>
                      <div className="flex items-center space-x-1">
                        {[10, 25, 50, 100, 500].map((num) => (
                          <button
                            key={num}
                            onClick={() => setLimit(num)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                              limit === num ? 'bg-blue-600 text-white' : 'bg-[#181A1F] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          onClick={() => setLimit(null)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                            limit === null ? 'bg-blue-600 text-white' : 'bg-[#181A1F] text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          All
                        </button>
                      </div>
                    </div>

                    <div className="h-4 w-px bg-[#2D3139]" />

                    <div className="flex items-center space-x-2">
                      <span className="text-[#64748B] font-bold">OFFSET:</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={offset ?? ''}
                        onChange={(e) => setOffset(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="w-20 bg-[#181A1F] border border-[#2D3139] rounded px-2 py-0.5 text-xs text-[#E2E8F0]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live SQL Preview & Immediate Query Results */}
        <div className="w-5/12 flex flex-col bg-[#0F1115] overflow-hidden">
          {/* SQL Live Code Preview Box */}
          <div className="h-44 border-b border-[#2D3139] flex flex-col shrink-0 bg-[#0B0D11]">
            <div className="h-7 bg-[#14171D] border-b border-[#2D3139] px-3 flex items-center justify-between text-[11px] text-[#94A3B8]">
              <div className="flex items-center space-x-1.5 text-white font-mono font-semibold">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Generated PostgreSQL Query</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Live Synced</span>
            </div>

            <div className="flex-1 p-2.5 overflow-auto custom-scrollbar font-mono text-xs text-amber-200/90 leading-relaxed select-text whitespace-pre">
              {generatedSql}
            </div>
          </div>

          {/* Execution Results Data Grid */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0F1115]">
            <div className="h-9 bg-[#181A1F] border-b border-[#2D3139] px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white font-mono flex items-center space-x-1.5">
                  <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Query Results</span>
                </span>

                {queryResult && queryResult.status === 'success' && (
                  <span className="text-[11px] text-[#64748B] font-mono">
                    ({queryResult.rowCount} rows in {queryResult.executionTimeMs}ms)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3 h-3 text-[#64748B] absolute left-2 top-1.5" />
                  <input
                    type="text"
                    placeholder="Search results..."
                    value={resultFilterTerm}
                    onChange={(e) => setResultFilterTerm(e.target.value)}
                    className="bg-[#0F1115] border border-[#2D3139] rounded pl-6 pr-2 py-0.5 text-[11px] text-[#E2E8F0] focus:border-blue-500 w-36 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Results Table Body */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              {!queryResult ? (
                <div className="h-full flex items-center justify-center p-8 text-center text-[#64748B] text-xs font-mono">
                  Click "Run Query" to execute and view data
                </div>
              ) : queryResult.status === 'error' ? (
                <div className="p-4 bg-rose-950/40 border border-rose-900 m-3 rounded-lg text-rose-300 font-mono text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SQL Execution Error</div>
                    <div className="mt-1 text-[11px] text-rose-200">{queryResult.error}</div>
                  </div>
                </div>
              ) : displayResults.length === 0 ? (
                <div className="h-full flex items-center justify-center p-8 text-center text-[#64748B] text-xs font-mono">
                  No rows returned by this query.
                </div>
              ) : (
                <table className="w-full text-left border-collapse border-[#2D3139] text-xs font-mono">
                  <thead className="bg-[#14171D] sticky top-0 border-b border-[#2D3139] z-10">
                    <tr>
                      <th className="w-8 px-2 py-1.5 border-r border-[#2D3139] text-[10px] text-[#64748B] text-center">
                        #
                      </th>
                      {queryResult.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-1.5 border-r border-[#2D3139] text-[#E2E8F0] font-semibold text-[11px] truncate max-w-xs"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F232B]">
                    {displayResults.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#181A1F] transition-colors">
                        <td className="px-2 py-1 border-r border-[#2D3139]/80 text-[10px] text-[#64748B] text-center">
                          {rIdx + 1}
                        </td>
                        {queryResult.columns.map((col) => {
                          const val = row[col];
                          return (
                            <td
                              key={col}
                              className="px-3 py-1 border-r border-[#2D3139]/80 text-[#E2E8F0] truncate max-w-xs text-xs"
                            >
                              {val === null || val === undefined ? (
                                <span className="text-[#64748B] italic">NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
