export type DatabaseEngineType = 'postgres' | 'mysql' | 'sqlite' | 'cockroach';

export interface DBConnection {
  id: string;
  name: string;
  engine: DatabaseEngineType;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  ssl: boolean;
  color: string;
  status: 'connected' | 'disconnected' | 'error';
  isSample?: boolean;
  createdAt: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
  defaultValue?: string;
  comment?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface TableObject {
  name: string;
  schema: string;
  rowCount: number;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  data: Record<string, any>[];
  comment?: string;
}

export interface ViewObject {
  name: string;
  schema: string;
  definition: string;
  comment?: string;
}

export interface TriggerObject {
  name: string;
  schema: string;
  tableName: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  event: 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';
  functionName: string;
  definition: string;
}

export interface StoredProcedureObject {
  name: string;
  schema: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  definition: string;
  comment?: string;
}

export interface SchemaObject {
  name: string;
  category?: 'shrapnel' | 'standard' | string;
  tables: TableObject[];
  views: ViewObject[];
  triggers: TriggerObject[];
  procedures: StoredProcedureObject[];
  comment?: string;
}

export interface QueryExecutionResult {
  query: string;
  columns: string[];
  columnTypes?: Record<string, string>;
  rows: Record<string, any>[];
  rowCount: number;
  affectedRows?: number;
  executionTimeMs: number;
  status: 'success' | 'error';
  error?: string;
  message?: string;
  timestamp: string;
  plan?: ExecutionPlanNode;
}

export interface ExecutionPlanNode {
  nodeType: string;
  relationName?: string;
  alias?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  planWidth: number;
  filter?: string;
  indexName?: string;
  indexCond?: string;
  plans?: ExecutionPlanNode[];
}

export interface SavedQuery {
  id: string;
  title: string;
  query: string;
  databaseId: string;
  updatedAt: string;
}

export interface QueryTab {
  id: string;
  title: string;
  type: 'editor' | 'table-viewer' | 'erd' | 'eav-studio' | 'query-builder' | 'diff-viewer';
  query: string;
  connectionId: string;
  schema?: string;
  tableName?: string;
  activeResult?: QueryExecutionResult;
  isUnsaved?: boolean;
  diffSourceLeft?: QueryExecutionResult;
  diffSourceRight?: QueryExecutionResult;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'connection' | 'schema' | 'table' | 'view' | 'trigger' | 'procedure' | 'category';
  connectionId?: string;
  schemaName?: string;
  objectName?: string;
  objectData?: any;
}

export type SqlParamType =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'null'
  | 'json'
  | 'raw_sql';

export interface QueryParameter {
  id: string;
  name: string; // Identifier, e.g. "status", "1", "customer_id"
  rawPlaceholder: string; // The token in SQL, e.g. ":status", "$1", "{{status}}"
  type: SqlParamType;
  value: any;
  defaultValue?: any;
  description?: string;
  isCustom?: boolean; // Manually defined vs extracted from SQL
  occurrences?: number;
  isValid?: boolean;
  validationError?: string;
}

export type DiffRowStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffCell {
  leftValue: any;
  rightValue: any;
  isChanged: boolean;
  leftMissing?: boolean;
  rightMissing?: boolean;
}

export interface DiffRow {
  id: string;
  rowKey: string;
  status: DiffRowStatus;
  leftRowIndex?: number;
  rightRowIndex?: number;
  leftRow?: Record<string, any> | null;
  rightRow?: Record<string, any> | null;
  cells: Record<string, DiffCell>;
  changedColumnCount: number;
}

export interface ColumnsComparison {
  allColumns: string[];
  commonColumns: string[];
  leftOnlyColumns: string[];
  rightOnlyColumns: string[];
}

export interface DiffStatistics {
  totalLeftRows: number;
  totalRightRows: number;
  rowDelta: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  totalCellChanges: number;
  leftLatencyMs: number;
  rightLatencyMs: number;
  latencyDeltaMs: number;
  similarityPercentage: number;
}

export interface ResultSetDiff {
  leftResult: QueryExecutionResult;
  rightResult: QueryExecutionResult;
  keyColumn: string; // column name or '__index__'
  availableKeyColumns: string[];
  columns: ColumnsComparison;
  rows: DiffRow[];
  stats: DiffStatistics;
}


