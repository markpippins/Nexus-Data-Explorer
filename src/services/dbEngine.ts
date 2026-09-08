import {
  DatabaseNode,
  DBConnection,
  SchemaObject,
  TableObject,
  QueryExecutionResult,
  ExecutionPlanNode
} from '../types/database';
import {
  INITIAL_CONNECTIONS,
  ECOMMERCE_SCHEMAS,
  FINANCIAL_SCHEMAS,
  SAAS_SCHEMAS
} from './sampleData';

const LOCAL_CONNECTIONS_KEY = 'data_workbench_connections';
const LOCAL_SCHEMAS_PREFIX = 'data_workbench_schemas_';
const LOCAL_SEEDED_KEY = 'data_workbench_seeded_defaults';
// Per-connection ACTIVE schema persistence: survives page reloads and
// sessions so the user's tree context is not re-seeded on every load.
const LOCAL_ACTIVE_SCHEMA_PREFIX = 'data_workbench_active_schema_';

// Default live connections seeded once on first run (or after a sample purge).
// Credentials are intentionally NOT baked in — the user enters the password on
// first connect and it persists only in their own localStorage.
const DEFAULT_LIVE_CONNECTIONS: DBConnection[] = [
  {
    id: 'conn-local-nexus',
    name: 'localhost (pgvector_db)',
    engine: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'nexus',
    username: 'pguser',
    ssl: false,
    color: '#3b82f6', // Blue
    status: 'disconnected',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'conn-barium-pg',
    name: 'barium (192.168.1.212)',
    engine: 'postgres',
    host: '192.168.1.212',
    port: 5432,
    database: 'nexus',
    username: 'pguser',
    ssl: false,
    color: '#10b981', // Emerald Green
    status: 'disconnected',
    createdAt: new Date().toISOString(),
  },
];

// Environment-selected mode is authoritative: live by default; the in-browser
// localStorage simulation runs only when VITE_DATA_EXPLORER_MODE=mock is set
// explicitly. In live mode the engine talks to the local server, which opens a
// real PostgreSQL connection per request using the user-entered credentials —
// nothing is hardcoded, and a failed live request surfaces an error instead of
// falling back to seeded sample rows.
export const DATA_EXPLORER_MODE: 'mock' | 'live' =
  ((import.meta as any).env?.['VITE_DATA_EXPLORER_MODE'] as string | undefined) === 'mock' ? 'mock' : 'live';

export function isLiveMode(): boolean {
  return DATA_EXPLORER_MODE === 'live';
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `${res.status} ${res.statusText}`);
  }
  return data as T;
}

export class DBEngine {
  private static connections: DBConnection[] = [];
  private static schemaStore: Record<string, SchemaObject[]> = {};
  private static liveSchemaCache: Record<string, SchemaObject[]> = {};
  private static liveDatabaseCache: Record<string, DatabaseNode[]> = {};

  public static initialize(): void {
    // Load user connections from localStorage. In live mode the app starts with
    // NO sample connections — sample rows can never be mistaken for live data.
    // Stale isSample entries persisted by pre-cutover builds are PURGED here,
    // then the two default live connections (localhost, barium) are seeded once.
    const savedConns = localStorage.getItem(LOCAL_CONNECTIONS_KEY);
    if (savedConns) {
      try {
        let parsed: DBConnection[] = JSON.parse(savedConns);
        if (isLiveMode()) {
          const purged = parsed.filter((c) => !c.isSample);
          const seeded = !!localStorage.getItem(LOCAL_SEEDED_KEY);
          let mutated = false;
          if (!seeded && purged.length !== parsed.length) {
            // First live run over stale mock-era state: purge samples, seed defaults.
            this.connections = [...DEFAULT_LIVE_CONNECTIONS, ...purged];
            localStorage.setItem(LOCAL_SEEDED_KEY, new Date().toISOString());
            mutated = true;
          } else {
            this.connections = purged;
            // One-time correction: the earliest seed used a wrong address for barium.
            const staleBarium = this.connections.find(
              (c) => c.id === 'conn-barium-pg' && c.host === '172.16.30.20'
            );
            if (staleBarium) {
              staleBarium.host = '192.168.1.212';
              staleBarium.name = 'barium (192.168.1.212)';
              mutated = true;
            }
            if (purged.length !== parsed.length) mutated = true;
          }
          if (mutated) this.saveConnections();
        } else {
          this.connections = parsed;
        }
      } catch {
        this.connections = [];
      }
    } else {
      if (isLiveMode()) {
        this.connections = [...DEFAULT_LIVE_CONNECTIONS];
        localStorage.setItem(LOCAL_SEEDED_KEY, new Date().toISOString());
      } else {
        this.connections = [...INITIAL_CONNECTIONS];
      }
      this.saveConnections();
    }

    // Mock mode only: hydrate the in-memory schema store from localStorage or
    // seed samples. Live schemas are discovered from the real database on demand.
    if (!isLiveMode()) {
      this.connections.forEach((conn) => {
        const savedSchemas = localStorage.getItem(`${LOCAL_SCHEMAS_PREFIX}${conn.id}`);
        if (savedSchemas) {
          try {
            this.schemaStore[conn.id] = JSON.parse(savedSchemas);
          } catch {
            this.assignDefaultSchema(conn);
          }
        } else {
          this.assignDefaultSchema(conn);
        }
      });
    }
  }

  private static assignDefaultSchema(conn: DBConnection): void {
    if (conn.id === 'conn-financial-ledger') {
      this.schemaStore[conn.id] = JSON.parse(JSON.stringify(FINANCIAL_SCHEMAS));
    } else if (conn.id === 'conn-saas-analytics') {
      this.schemaStore[conn.id] = JSON.parse(JSON.stringify(SAAS_SCHEMAS));
    } else {
      this.schemaStore[conn.id] = JSON.parse(JSON.stringify(ECOMMERCE_SCHEMAS));
    }
    this.saveSchema(conn.id);
  }

  public static getConnections(): DBConnection[] {
    if (this.connections.length === 0) this.initialize();
    return this.connections;
  }

  public static addConnection(connection: DBConnection): void {
    this.connections.push(connection);
    if (!isLiveMode()) this.assignDefaultSchema(connection);
    this.saveConnections();
  }

  public static updateConnection(connection: DBConnection): void {
    const idx = this.connections.findIndex((c) => c.id === connection.id);
    if (idx !== -1) {
      this.connections[idx] = connection;
      this.saveConnections();
    }
  }

  public static deleteConnection(id: string): void {
    this.connections = this.connections.filter((c) => c.id !== id);
    delete this.schemaStore[id];
    Object.keys(this.liveSchemaCache)
      .filter((key) => key === id || key.startsWith(`${id}:`))
      .forEach((key) => delete this.liveSchemaCache[key]);
    delete this.liveDatabaseCache[id];
    localStorage.removeItem(`${LOCAL_SCHEMAS_PREFIX}${id}`);
    localStorage.removeItem(`${LOCAL_ACTIVE_SCHEMA_PREFIX}${id}`);
    this.saveConnections();
  }

  private static databaseCacheKey(connectionId: string, databaseName: string): string {
    return `${connectionId}:${databaseName}`;
  }

  public static async getDatabases(
    connectionId: string,
    opts?: { bypassCache?: boolean }
  ): Promise<DatabaseNode[]> {
    const conn = this.connections.find((c) => c.id === connectionId);
    if (!conn) return [];
    if (!isLiveMode()) {
      return [{ name: conn.database, allowConnections: true, isTemplate: false }];
    }
    const cached = this.liveDatabaseCache[connectionId];
    if (!opts?.bypassCache && cached) return cached;
    const data = await api<{ databases: DatabaseNode[] }>('/api/db/databases', {
      engine: conn.engine,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: conn.password,
      ssl: conn.ssl,
    });
    const databases = data.databases || [];
    this.liveDatabaseCache[connectionId] = databases;
    return databases;
  }

  public static async getSchemas(
    connectionId: string,
    databaseName?: string,
    opts?: { bypassCache?: boolean }
  ): Promise<SchemaObject[]> {
    if (isLiveMode()) {
      const conn = this.connections.find((c) => c.id === connectionId);
      if (!conn) return [];
      const database = databaseName || conn.database;
      const cacheKey = this.databaseCacheKey(connectionId, database);
      const cached = this.liveSchemaCache[cacheKey];
      if (!opts?.bypassCache && Array.isArray(cached) && cached.length > 0) return cached;
      // Real schema discovery against the selected database.
      const data = await api<{ schemas: SchemaObject[] }>('/api/db/schemas', {
        engine: conn.engine,
        host: conn.host,
        port: conn.port,
        database,
        username: conn.username,
        password: conn.password,
        ssl: conn.ssl,
      });
      const discovered = (data.schemas || []).map((schema) => ({ ...schema, databaseName: database }));
      if (discovered.length > 0) this.liveSchemaCache[cacheKey] = discovered;
      return discovered;
    }

    if (!this.schemaStore[connectionId]) {
      const conn = this.connections.find((c) => c.id === connectionId);
      if (conn) {
        this.assignDefaultSchema(conn);
      } else {
        return [];
      }
    }
      const schemas = this.schemaStore[connectionId] || [];
      if (databaseName && databaseName !== this.connections.find((c) => c.id === connectionId)?.database) {
        return [];
      }
      return schemas.map((schema) => ({
        ...schema,
        databaseName: databaseName || this.connections.find((c) => c.id === connectionId)?.database,
      }));
  }

  public static saveConnections(): void {
    localStorage.setItem(LOCAL_CONNECTIONS_KEY, JSON.stringify(this.connections));
  }

  /**
   * Read the persisted ACTIVE schema for a connection. Returns the stored
   * name even if it no longer exists in the current discovery — the caller
   * decides how to reconcile (e.g. fall back to default/public after a
   * refresh drops the schema).
   */
  public static getActiveSchema(connectionId: string, databaseName?: string): string | null {
    try {
      const key = `${LOCAL_ACTIVE_SCHEMA_PREFIX}${connectionId}_${databaseName || 'default'}`;
      return localStorage.getItem(key) || null;
    } catch {
      return null;
    }
  }

  /** Persist the ACTIVE schema for a connection (best-effort; never throws). */
  public static setActiveSchema(connectionId: string, schemaName: string | null, databaseName?: string): void {
    try {
      const key = `${LOCAL_ACTIVE_SCHEMA_PREFIX}${connectionId}_${databaseName || 'default'}`;
      if (schemaName) {
        localStorage.setItem(key, schemaName);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // localStorage unavailable (private mode, quota) — persistence is a
      // convenience, not a contract; silently degrade to session-only state.
    }
  }

  public static saveSchema(connectionId: string): void {
    // Live mode: the real database is the source of truth; nothing to persist.
    if (isLiveMode()) return;
    if (this.schemaStore[connectionId]) {
      localStorage.setItem(
        `${LOCAL_SCHEMAS_PREFIX}${connectionId}`,
        JSON.stringify(this.schemaStore[connectionId])
      );
    }
  }

  // Persist an edited schema set (mock mode: localStorage; live mode: in-memory
  // cache only — real DDL/DML goes through executeQuery).
  public static saveSchemas(connectionId: string, schemas: SchemaObject[]): void {
    if (isLiveMode()) {
      this.liveSchemaCache[connectionId] = schemas;
      return;
    }
    this.schemaStore[connectionId] = schemas;
    this.saveSchema(connectionId);
  }

  // Generate DDL statements
  public static generateDDL(
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE' | 'DDL',
    schemaName: string,
    objectData: TableObject | { name: string; definition?: string; tableName?: string; functionName?: string; returnType?: string; parameters?: { name: string; type: string }[] }
  ): string {
    const qualifiedName = `${schemaName}.${objectData.name}`;

    if (type === 'DDL') {
      if ('columns' in objectData) {
        return this.generateDDL('CREATE_TABLE', schemaName, objectData);
      }
      const definition = 'definition' in objectData ? objectData.definition : undefined;
      if (definition) {
        const ddl = definition.trim();
        if ((objectData as any).__objectType === 'view') {
          return `CREATE OR REPLACE VIEW ${qualifiedName} AS\n${ddl};`;
        }
        return ddl.endsWith(';') ? ddl : `${ddl};`;
      }
      if ('tableName' in objectData && objectData.tableName) {
        return `-- Trigger ${qualifiedName} is missing its server definition.`;
      }
      if ('returnType' in objectData) {
        const parameters = (objectData.parameters || []).map((parameter) => `${parameter.name} ${parameter.type}`).join(', ');
        return `CREATE OR REPLACE FUNCTION ${qualifiedName}(${parameters})\nRETURNS ${objectData.returnType || 'void'}\nLANGUAGE plpgsql\nAS $$\n-- Function body was not returned by the server.\nBEGIN\n  NULL;\nEND;\n$$;`;
      }
      return `-- No DDL definition was returned for ${qualifiedName}.`;
    }

    const table = objectData as TableObject;

    switch (type) {
      case 'SELECT':
        return `SELECT \n  ${table.columns.map((c) => c.name).join(',\n  ')}\nFROM ${qualifiedName}\nLIMIT 100;`;

      case 'INSERT': {
        const nonPkCols = table.columns.filter((c) => c.type !== 'SERIAL' && c.type !== 'BIGSERIAL');
        const colNames = nonPkCols.map((c) => c.name).join(', ');
        const placeholders = nonPkCols.map((c) => `'val_${c.name}'`).join(', ');
        return `INSERT INTO ${qualifiedName} (\n  ${colNames}\n)\nVALUES (\n  ${placeholders}\n)\nRETURNING *;`;
      }

      case 'UPDATE': {
        const setClause = table.columns
          .filter((c) => !c.isPrimaryKey)
          .map((c) => `${c.name} = 'new_value'`)
          .join(',\n  ');
        const pkCol = table.columns.find((c) => c.isPrimaryKey) || table.columns[0];
        return `UPDATE ${qualifiedName}\nSET\n  ${setClause}\nWHERE ${pkCol.name} = 1\nRETURNING *;`;
      }

      case 'DELETE': {
        const pkCol = table.columns.find((c) => c.isPrimaryKey) || table.columns[0];
        return `DELETE FROM ${qualifiedName}\nWHERE ${pkCol.name} = 1;`;
      }

      case 'CREATE_TABLE': {
        const colDefs = table.columns.map((c) => {
          let line = `  ${c.name} ${c.type}`;
          if (c.isPrimaryKey) line += ' PRIMARY KEY';
          if (!c.isNullable && !c.isPrimaryKey) line += ' NOT NULL';
          if (c.defaultValue) line += ` DEFAULT ${c.defaultValue}`;
          if (c.isForeignKey && c.referencesTable) {
            line += ` REFERENCES ${c.referencesTable}(${c.referencesColumn || 'id'})`;
          }
          return line;
        });
        return `CREATE TABLE ${qualifiedName} (\n${colDefs.join(',\n')}\n);`;
      }
    }
  }

  // Execute SQL statements — real database in live mode, simulation in mock mode.
  public static async executeQuery(
    connectionId: string,
    rawQuery: string,
    defaultSchema = 'public',
    databaseName = this.connections.find((c) => c.id === connectionId)?.database,
  ): Promise<QueryExecutionResult> {
    if (isLiveMode()) {
      const conn = this.connections.find((c) => c.id === connectionId);
      const timestamp = new Date().toLocaleTimeString();
      if (!conn) {
        return {
          query: rawQuery,
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: 0,
          status: 'error',
          error: 'No active connection — add a database connection first.',
          timestamp,
        };
      }
      try {
        const result = await api<Partial<QueryExecutionResult>>('/api/db/query', {
          connection: {
            host: conn.host,
            port: conn.port,
            database: databaseName || conn.database,
            username: conn.username,
            password: conn.password,
            ssl: conn.ssl,
          },
          sql: rawQuery,
        });
        return {
          query: rawQuery,
          columns: result.columns || [],
          columnTypes: result.columnTypes,
          rows: result.rows || [],
          rowCount: result.rowCount ?? (result.rows || []).length,
          affectedRows: result.affectedRows,
          executionTimeMs: result.executionTimeMs || 0,
          status: (result.status as 'success' | 'error') || 'success',
          error: result.error,
          message: result.message,
          timestamp,
        };
      } catch (err: any) {
        // Live failure surfaces as a visible error — never seeded sample rows.
        return {
          query: rawQuery,
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: 0,
          status: 'error',
          error: err?.message || 'Query failed against the live database.',
          timestamp,
        };
      }
    }

    const startTime = performance.now();
    const timestamp = new Date().toLocaleTimeString();
    const cleanQuery = rawQuery.trim();

    if (!cleanQuery) {
      return {
        query: rawQuery,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        status: 'error',
        error: 'Empty SQL statement.',
        timestamp,
      };
    }

    const schemas = this.schemaStore[connectionId] || [];
    const upperQuery = cleanQuery.toUpperCase();

    try {
      // 1. SELECT Query
      if (upperQuery.startsWith('SELECT')) {
        return this.handleSelectQuery(cleanQuery, schemas, defaultSchema, startTime, timestamp);
      }

      // 2. INSERT INTO
      if (upperQuery.startsWith('INSERT')) {
        return this.handleInsertQuery(connectionId, cleanQuery, schemas, defaultSchema, startTime, timestamp);
      }

      // 3. UPDATE
      if (upperQuery.startsWith('UPDATE')) {
        return this.handleUpdateQuery(connectionId, cleanQuery, schemas, defaultSchema, startTime, timestamp);
      }

      // 4. DELETE
      if (upperQuery.startsWith('DELETE')) {
        return this.handleDeleteQuery(connectionId, cleanQuery, schemas, defaultSchema, startTime, timestamp);
      }

      // 5. DROP TABLE / VIEW
      if (upperQuery.startsWith('DROP')) {
        return this.handleDropQuery(connectionId, cleanQuery, schemas, defaultSchema, startTime, timestamp);
      }

      // 6. CREATE TABLE
      if (upperQuery.startsWith('CREATE TABLE')) {
        return this.handleCreateTableQuery(connectionId, cleanQuery, schemas, defaultSchema, startTime, timestamp);
      }

      // Fallback response for unhandled statement types (e.g. SET, EXPLAIN, SHOW)
      const endTime = performance.now();
      return {
        query: rawQuery,
        columns: ['status', 'statement_type'],
        rows: [{ status: 'EXECUTED_SUCCESSFULLY', statement_type: upperQuery.split(' ')[0] }],
        rowCount: 1,
        affectedRows: 1,
        executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
        status: 'success',
        message: 'Query executed successfully.',
        timestamp,
        plan: this.generateMockPlan(upperQuery, 10),
      };
    } catch (err: any) {
      const endTime = performance.now();
      return {
        query: rawQuery,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
        status: 'error',
        error: err.message || 'Error executing query.',
        timestamp,
      };
    }
  }

  private static handleSelectQuery(
    query: string,
    schemas: SchemaObject[],
    defaultSchema: string,
    startTime: number,
    timestamp: string
  ): QueryExecutionResult {
    // Basic table extraction
    let targetTableName = '';
    let targetSchemaName = defaultSchema;

    const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_\.]+)/i);
    if (fromMatch && fromMatch[1]) {
      const parts = fromMatch[1].split('.');
      if (parts.length > 1) {
        targetSchemaName = parts[0];
        targetTableName = parts[1];
      } else {
        targetTableName = parts[0];
      }
    }

    const currentSchema = schemas.find((s) => s.name === targetSchemaName) || schemas[0];
    const table = currentSchema?.tables.find((t) => t.name.toLowerCase() === targetTableName.toLowerCase());

    if (!table) {
      // Check views
      const view = currentSchema?.views.find((v) => v.name.toLowerCase() === targetTableName.toLowerCase());
      if (view) {
        const endTime = performance.now();
        return {
          query,
          columns: ['view_name', 'schema', 'definition'],
          rows: [{ view_name: view.name, schema: view.schema, definition: view.definition }],
          rowCount: 1,
          executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
          status: 'success',
          message: `Query on view ${view.name} executed successfully.`,
          timestamp,
          plan: this.generateMockPlan('VIEW SCAN', 1),
        };
      }

      // If no specific table specified, return all tables metadata or default customer table if available
      const defaultTable = currentSchema?.tables[0];
      if (defaultTable) {
        const endTime = performance.now();
        return {
          query,
          columns: defaultTable.columns.map((c) => c.name),
          columnTypes: defaultTable.columns.reduce((acc, c) => ({ ...acc, [c.name]: c.type }), {}),
          rows: defaultTable.data,
          rowCount: defaultTable.data.length,
          executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
          status: 'success',
          timestamp,
          plan: this.generateMockPlan('Seq Scan', defaultTable.data.length),
        };
      }

      throw new Error(`Relation "${targetSchemaName}.${targetTableName}" does not exist.`);
    }

    let rowsData = [...table.data];

    // Filter simulation (WHERE clause)
    const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/i);
    if (whereMatch && whereMatch[1]) {
      const cond = whereMatch[1].trim();
      const colMatch = cond.match(/([a-zA-Z0-9_]+)\s*(=|>|<|LIKE|IN)\s*(.+)/i);
      if (colMatch) {
        const [, colName, op, rawVal] = colMatch;
        const val = rawVal.replace(/'/g, '').trim();
        rowsData = rowsData.filter((r) => {
          const itemVal = String(r[colName] ?? '');
          if (op === '=') return itemVal.toLowerCase() === val.toLowerCase();
          if (op.toUpperCase() === 'LIKE') return itemVal.toLowerCase().includes(val.toLowerCase().replace(/%/g, ''));
          if (op === '>') return Number(itemVal) > Number(val);
          if (op === '<') return Number(itemVal) < Number(val);
          return true;
        });
      }
    }

    // Limit simulation
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch && limitMatch[1]) {
      const limit = parseInt(limitMatch[1], 10);
      rowsData = rowsData.slice(0, limit);
    }

    const endTime = performance.now();
    return {
      query,
      columns: table.columns.map((c) => c.name),
      columnTypes: table.columns.reduce((acc, c) => ({ ...acc, [c.name]: c.type }), {}),
      rows: rowsData,
      rowCount: rowsData.length,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      status: 'success',
      timestamp,
      plan: this.generateMockPlan('Seq Scan on ' + table.name, rowsData.length),
    };
  }

  private static handleInsertQuery(
    connectionId: string,
    query: string,
    schemas: SchemaObject[],
    defaultSchema: string,
    startTime: number,
    timestamp: string
  ): QueryExecutionResult {
    let targetTableName = '';
    let targetSchemaName = defaultSchema;

    const match = query.match(/INSERT\s+INTO\s+([a-zA-Z0-9_\.]+)/i);
    if (match && match[1]) {
      const parts = match[1].split('.');
      if (parts.length > 1) {
        targetSchemaName = parts[0];
        targetTableName = parts[1];
      } else {
        targetTableName = parts[0];
      }
    }

    const schema = schemas.find((s) => s.name === targetSchemaName) || schemas[0];
    const table = schema?.tables.find((t) => t.name.toLowerCase() === targetTableName.toLowerCase());

    if (!table) {
      throw new Error(`Relation "${targetSchemaName}.${targetTableName}" does not exist.`);
    }

    // Generate simulated inserted row
    const newId = Math.floor(Math.random() * 90000) + 10000;
    const newRow: Record<string, any> = {};
    table.columns.forEach((c) => {
      if (c.isPrimaryKey || c.name === 'id') newRow[c.name] = newId;
      else if (c.type.includes('TIMESTAMP')) newRow[c.name] = new Date().toISOString().replace('T', ' ').slice(0, 19);
      else if (c.type.includes('INT') || c.type.includes('NUMERIC')) newRow[c.name] = 100;
      else newRow[c.name] = `Sample ${c.name}`;
    });

    table.data.push(newRow);
    table.rowCount = table.data.length;
    this.saveSchema(connectionId);

    const endTime = performance.now();
    return {
      query,
      columns: Object.keys(newRow),
      rows: [newRow],
      rowCount: 1,
      affectedRows: 1,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      status: 'success',
      message: `INSERT 0 1 - Successfully inserted 1 row into ${targetSchemaName}.${targetTableName}.`,
      timestamp,
    };
  }

  private static handleUpdateQuery(
    connectionId: string,
    query: string,
    schemas: SchemaObject[],
    defaultSchema: string,
    startTime: number,
    timestamp: string
  ): QueryExecutionResult {
    let targetTableName = '';
    let targetSchemaName = defaultSchema;

    const match = query.match(/UPDATE\s+([a-zA-Z0-9_\.]+)/i);
    if (match && match[1]) {
      const parts = match[1].split('.');
      if (parts.length > 1) {
        targetSchemaName = parts[0];
        targetTableName = parts[1];
      } else {
        targetTableName = parts[0];
      }
    }

    const schema = schemas.find((s) => s.name === targetSchemaName) || schemas[0];
    const table = schema?.tables.find((t) => t.name.toLowerCase() === targetTableName.toLowerCase());

    if (!table) {
      throw new Error(`Relation "${targetSchemaName}.${targetTableName}" does not exist.`);
    }

    const updatedCount = Math.min(table.data.length, 1);
    this.saveSchema(connectionId);

    const endTime = performance.now();
    return {
      query,
      columns: table.columns.map((c) => c.name),
      rows: table.data.slice(0, updatedCount),
      rowCount: updatedCount,
      affectedRows: updatedCount,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      status: 'success',
      message: `UPDATE ${updatedCount} - Updated ${updatedCount} rows in ${targetSchemaName}.${targetTableName}.`,
      timestamp,
    };
  }

  private static handleDeleteQuery(
    connectionId: string,
    query: string,
    schemas: SchemaObject[],
    defaultSchema: string,
    startTime: number,
    timestamp: string
  ): QueryExecutionResult {
    let targetTableName = '';
    let targetSchemaName = defaultSchema;

    const match = query.match(/DELETE\s+FROM\s+([a-zA-Z0-9_\.]+)/i);
    if (match && match[1]) {
      const parts = match[1].split('.');
      if (parts.length > 1) {
        targetSchemaName = parts[0];
        targetTableName = parts[1];
      } else {
        targetTableName = parts[0];
      }
    }

    const schema = schemas.find((s) => s.name === targetSchemaName) || schemas[0];
    const table = schema?.tables.find((t) => t.name.toLowerCase() === targetTableName.toLowerCase());

    if (!table) {
      throw new Error(`Relation "${targetSchemaName}.${targetTableName}" does not exist.`);
    }

    let deletedCount = 0;
    if (table.data.length > 0) {
      table.data.pop(); // simulate deleting 1 row
      table.rowCount = table.data.length;
      deletedCount = 1;
      this.saveSchema(connectionId);
    }

    const endTime = performance.now();
    return {
      query,
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: deletedCount,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      status: 'success',
      message: `DELETE ${deletedCount} - Removed ${deletedCount} row from ${targetSchemaName}.${targetTableName}.`,
      timestamp,
    };
  }

  private static handleDropQuery(
    connectionId: string,
    query: string,
    schemas: SchemaObject[],
    defaultSchema: string,
    startTime: number,
    timestamp: string
  ): QueryExecutionResult {
    const match = query.match(/DROP\s+(TABLE|VIEW)\s+([a-zA-Z0-9_\.]+)/i);
    if (!match) {
      throw new Error('Invalid DROP syntax. Expected DROP TABLE or DROP VIEW.');
    }

    const type = match[1].toUpperCase();
    const targetName = match[2];
    const parts = targetName.split('.');
    const schemaName = parts.length > 1 ? parts[0] : defaultSchema;
    const objName = parts.length > 1 ? parts[1] : parts[0];

    const schema = schemas.find((s) => s.name === schemaName) || schemas[0];
    if (type === 'TABLE') {
      schema.tables = schema.tables.filter((t) => t.name.toLowerCase() !== objName.toLowerCase());
    } else {
      schema.views = schema.views.filter((v) => v.name.toLowerCase() !== objName.toLowerCase());
    }

    this.saveSchema(connectionId);

    const endTime = performance.now();
    return {
      query,
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: 1,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      status: 'success',
      message: `DROP ${type} - Object "${schemaName}.${objName}" successfully dropped.`,
      timestamp,
    };
  }

  private static handleCreateTableQuery(
    connectionId: string,
    query: string,
    schemas: SchemaObject[],
    defaultSchema: string,
    startTime: number,
    timestamp: string
  ): QueryExecutionResult {
    const match = query.match(/CREATE\s+TABLE\s+([a-zA-Z0-9_\.]+)/i);
    if (!match) {
      throw new Error('Invalid CREATE TABLE statement.');
    }

    const targetName = match[1];
    const parts = targetName.split('.');
    const schemaName = parts.length > 1 ? parts[0] : defaultSchema;
    const tableName = parts.length > 1 ? parts[1] : parts[0];

    const schema = schemas.find((s) => s.name === schemaName) || schemas[0];

    const newTable: TableObject = {
      name: tableName,
      schema: schemaName,
      rowCount: 0,
      columns: [
        { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
        { name: 'created_at', type: 'TIMESTAMP', isNullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
      data: [],
      comment: 'User created table',
    };

    schema.tables.push(newTable);
    this.saveSchema(connectionId);

    const endTime = performance.now();
    return {
      query,
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: 0,
      executionTimeMs: Math.round((endTime - startTime) * 100) / 100,
      status: 'success',
      message: `CREATE TABLE - Table "${schemaName}.${tableName}" created successfully.`,
      timestamp,
    };
  }

  private static generateMockPlan(relationName: string, rowsCount: number): ExecutionPlanNode {
    return {
      nodeType: 'Seq Scan',
      relationName,
      startupCost: 0.00,
      totalCost: Math.round((rowsCount * 1.05 + 10) * 100) / 100,
      planRows: Math.max(1, rowsCount),
      planWidth: 120,
      plans: [
        {
          nodeType: 'Hash Join',
          startupCost: 1.25,
          totalCost: 18.50,
          planRows: Math.max(1, rowsCount),
          planWidth: 64,
          filter: '(status = ACTIVE)',
        },
      ],
    };
  }
}
