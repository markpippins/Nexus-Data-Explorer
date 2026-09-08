import React, { useState, useEffect } from 'react';
import {
  DBConnection,
  DatabaseNode,
  SchemaObject,
  QueryTab,
  QueryExecutionResult,
  ContextMenuState,
  SavedQuery
} from './types/database';
import { DBEngine, isLiveMode } from './services/dbEngine';
import { formatSqlQuery } from './services/sqlFormatter';

import { Header } from './components/Header';
import { TreeView } from './components/Sidebar/TreeView';
import { ContextMenu } from './components/Sidebar/ContextMenu';
import { QueryTabs } from './components/QueryEditor/QueryTabs';
import { SqlEditor } from './components/QueryEditor/SqlEditor';
import { ResultsPanel } from './components/Results/ResultsPanel';
import { TableDataViewer } from './components/DataGrid/TableDataViewer';
import { ErdViewer } from './components/Schema/ErdViewer';
import { ShrapnelEavStudio } from './components/Eav/ShrapnelEavStudio';
import { VisualQueryBuilder } from './components/QueryBuilder/VisualQueryBuilder';
import { ResultSetDiffViewer } from './components/DiffViewer/ResultSetDiffViewer';

import { ConnectionModal } from './components/Modals/ConnectionModal';
import { NewTableModal } from './components/Modals/NewTableModal';
import { AiAssistantModal } from './components/Modals/AiAssistantModal';
import { ObjectDetailsModal } from './components/Modals/ObjectDetailsModal';
import { ShortcutsModal } from './components/Modals/ShortcutsModal';
import { SchemaCompareModal } from './components/Modals/SchemaCompareModal';
import { DropGuardModal } from './components/Modals/DropGuardModal';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'steel'>(() => {
    return (localStorage.getItem('data_workbench_theme') as 'dark' | 'light' | 'steel') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('data_workbench_theme', theme);
  }, [theme]);

  const [connections, setConnections] = useState<DBConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<DBConnection | null>(null);
  const [databases, setDatabases] = useState<DatabaseNode[]>([]);
  const [activeDatabase, setActiveDatabase] = useState<string | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [schemas, setSchemas] = useState<SchemaObject[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [executionHistory, setExecutionHistory] = useState<QueryExecutionResult[]>([]);
  /**
   * The ACTIVE schema for the active connection: where unqualified names
   * resolve and where new work starts. Independent of the connection's
   * stored "default" schema — any schema in the tree can be made active.
   * Persisted per connection (localStorage via DBEngine) so it survives
   * reloads and sessions instead of re-seeding on every load.
   */
  const [activeSchema, setActiveSchema] = useState<string | null>(null);

  // Tabs state
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: 'tab-1',
      title: 'Console 1',
      type: 'editor',
      query: `-- Welcome to Data Workbench PostgreSQL IDE
-- Execute SELECT, INSERT, UPDATE, DELETE queries or format your SQL

SELECT 
    c.id AS customer_id,
    c.first_name || ' ' || c.last_name AS full_name,
    c.email,
    c.loyalty_tier,
    c.total_spent
FROM public.customers c
WHERE c.total_spent > 500
ORDER BY c.total_spent DESC
LIMIT 10;`,
      connectionId: '',
      isUnsaved: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // Modals state
  const [isConnModalOpen, setIsConnModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DBConnection | null>(null);
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareBaseSchema, setCompareBaseSchema] = useState<string | undefined>(undefined);
  const [compareRightSchema, setCompareRightSchema] = useState<string | undefined>(undefined);

  // Schema-activity drop guard: when a drop targets a schema other than the
  // active one, require typed confirmation naming the object exactly.
  const [dropGuard, setDropGuard] = useState<{
    open: boolean;
    target: { type: string; schemaName: string; objectName: string; databaseName?: string } | null;
    confirmedText: string;
  }>({ open: false, target: null, confirmedText: '' });

  // Sidebar width (px) — user-resizable via the tree's right-edge drag
  // handle; persisted across sessions like the active schema.
  const SIDEBAR_WIDTH_KEY = 'data_workbench_sidebar_width';
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return saved >= 200 && saved <= 560 ? saved : 256;
  });
  const handleSidebarResize = (w: number) => {
    setSidebarWidth(w);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
    } catch {
      /* persistence is best-effort */
    }
  };
  const [objectDetailsModal, setObjectDetailsModal] = useState<{
    open: boolean;
    schemaName: string;
    objectName: string;
    objectData: any;
  }>({ open: false, schemaName: '', objectName: '', objectData: null });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: 'table',
  });

  // Initialize DB Engine on mount
  useEffect(() => {
    (async () => {
      DBEngine.initialize();
      const conns = DBEngine.getConnections();
      setConnections(conns);

      if (conns.length > 0) {
        const active = conns[0];
        setActiveConnection(active);
        // Restore the persisted active schema immediately (optimistic — no
        // flash of the default while discovery runs), then reconcile below
        // once the discovered set is known.
        const persisted = DBEngine.getActiveSchema(active.id, active.database);
        if (persisted) setActiveSchema(persisted);
        try {
          const discoveredDatabases = await DBEngine.getDatabases(active.id);
          setDatabases(discoveredDatabases);
          const initialDatabase =
            discoveredDatabases.find((database) => database.name === active.database)?.name ||
            discoveredDatabases[0]?.name ||
            active.database;
          setActiveDatabase(initialDatabase);
          const loadedSchemas = await DBEngine.getSchemas(active.id, initialDatabase);
          setDatabases(discoveredDatabases.map((database) =>
            database.name === initialDatabase
              ? { ...database, schemas: loadedSchemas, schemasLoaded: true }
              : database
          ));
          setSchemas(loadedSchemas);
          if (persisted && loadedSchemas.some((s) => s.name === persisted)) {
            setActiveSchema(persisted);
          } else {
            // No persisted value (first run) or the persisted schema no
            // longer exists (dropped/renamed since last session): fall back
            // to connection default → public → first, and persist the result.
            const seed =
          (initialDatabase === active.database && active.defaultSchema && loadedSchemas.find((s) => s.name === active.defaultSchema)?.name) ||
              loadedSchemas.find((s) => s.name === 'public')?.name ||
              loadedSchemas[0]?.name ||
              null;
            setActiveSchema(seed);
            DBEngine.setActiveSchema(active.id, seed, initialDatabase);
          }
        } catch (err: any) {
          setSchemas([]);
          setExecutionHistory((prev) => [
            {
              query: 'schema discovery',
              columns: [],
              rows: [],
              rowCount: 0,
              executionTimeMs: 0,
              status: 'error',
              error: `Failed to load schema from the live database: ${err?.message || String(err)}`,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 49),
          ]);
        }

        setTabs((prev) =>
          prev.map((t) => (t.id === 'tab-1' ? { ...t, connectionId: active.id } : t))
        );
      }

      // Load saved snippets
      const saved = localStorage.getItem('data_workbench_saved_snippets');
      if (saved) {
        try {
          setSavedQueries(JSON.parse(saved));
        } catch {
          setSavedQueries([]);
        }
      }
    })();
  }, []);

  // Handle switching active connection
  const handleSelectConnection = async (conn: DBConnection) => {
    setActiveConnection(conn);
    setDatabaseLoading(true);
    try {
      const discoveredDatabases = await DBEngine.getDatabases(conn.id, { bypassCache: true });
      setDatabases(discoveredDatabases);
      const databaseName =
        discoveredDatabases.find((database) => database.name === conn.database)?.name ||
        discoveredDatabases[0]?.name ||
        conn.database;
      setActiveDatabase(databaseName);
      const persisted = DBEngine.getActiveSchema(conn.id, databaseName);
      if (persisted) setActiveSchema(persisted);
      const loadedSchemas = await DBEngine.getSchemas(conn.id, databaseName);
      setSchemas(loadedSchemas);
      if (persisted && loadedSchemas.some((s) => s.name === persisted)) {
        setActiveSchema(persisted);
      } else {
        const seed =
          (databaseName === conn.database && conn.defaultSchema && loadedSchemas.find((s) => s.name === conn.defaultSchema)?.name) ||
          loadedSchemas.find((s) => s.name === 'public')?.name ||
          loadedSchemas[0]?.name ||
          null;
        setActiveSchema(seed);
        DBEngine.setActiveSchema(conn.id, seed, databaseName);
      }
    } catch (err: any) {
      setDatabases([]);
      setSchemas([]);
      setExecutionHistory((prev) => [
        {
          query: 'database/schema discovery',
          columns: [], rows: [], rowCount: 0, executionTimeMs: 0, status: 'error',
          error: `Failed to load databases from the live database: ${err?.message || String(err)}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 49),
      ]);
    } finally {
      setDatabaseLoading(false);
    }
  };

  // Handle switching the database node beneath the active server connection.
  const handleSelectDatabase = async (databaseName: string) => {
    if (!activeConnection || databaseName === activeDatabase) return;
    setActiveDatabase(databaseName);
    setDatabaseLoading(true);
    try {
      const loadedSchemas = await DBEngine.getSchemas(activeConnection.id, databaseName);
      setDatabases((prev) => prev.map((database) =>
        database.name === databaseName
          ? { ...database, schemas: loadedSchemas, schemasLoaded: true, loading: false, error: undefined }
          : database
      ));
      setSchemas(loadedSchemas);
      const persisted = DBEngine.getActiveSchema(activeConnection.id, databaseName);
      const seed =
        (databaseName === activeConnection.database && activeConnection.defaultSchema && loadedSchemas.find((s) => s.name === activeConnection.defaultSchema)?.name) ||
        (persisted && loadedSchemas.find((s) => s.name === persisted)?.name) ||
        loadedSchemas.find((s) => s.name === 'public')?.name ||
        loadedSchemas[0]?.name ||
        null;
      setActiveSchema(seed);
      DBEngine.setActiveSchema(activeConnection.id, seed, databaseName);
      setTabs((prev) => prev.map((tab) => tab.connectionId === activeConnection.id ? { ...tab, databaseName } : tab));
    } catch (err: any) {
      setSchemas([]);
      setExecutionHistory((prev) => [{
        query: `schema discovery (${databaseName})`, columns: [], rows: [], rowCount: 0,
        executionTimeMs: 0, status: 'error',
        error: `Failed to load schemas for ${databaseName}: ${err?.message || String(err)}`,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev.slice(0, 49)]);
    } finally {
      setDatabaseLoading(false);
    }
  };

  // Refresh current database schema
  const handleRefreshSchema = async () => {
    if (activeConnection) {
      try {
        const databaseName = activeDatabase || activeConnection.database;
        const reloaded = await DBEngine.getSchemas(activeConnection.id, databaseName, { bypassCache: true });
        setSchemas([...reloaded]);
        // Reconcile: if the persisted/active schema was dropped or renamed on
        // the server since the last discovery, fall back and re-persist.
        setActiveSchema((current) => {
          if (current && reloaded.some((s) => s.name === current)) return current;
          const seed =
            (databaseName === activeConnection.database && activeConnection.defaultSchema && reloaded.find((s) => s.name === activeConnection.defaultSchema)?.name) ||
            reloaded.find((s) => s.name === 'public')?.name ||
            reloaded[0]?.name ||
            null;
          DBEngine.setActiveSchema(activeConnection.id, seed, databaseName);
          return seed;
        });
      } catch (err: any) {
        setSchemas([]);
        setExecutionHistory((prev) => [
          {
            query: 'schema refresh',
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: 0,
            status: 'error',
            error: `Schema refresh failed: ${err?.message || String(err)}`,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 49),
        ]);
      }
    }
  };

  // Edit the active connection (e.g. to set its password) in the modal.
  const handleEditConnection = () => {
    if (!activeConnection) return;
    setEditingConnection(activeConnection);
    setIsConnModalOpen(true);
  };

  // Save a connection from the modal: update in place when editing an existing
  // connection id, otherwise add. Re-discovers schemas for the edited/new conn.
  // A changed default schema re-seeds the active schema if the user hasn't
  // explicitly chosen one this session.
  const handleSaveConnection = async (conn: DBConnection) => {
    const existing = connections.find((c) => c.id === conn.id);
    const priorDefault = existing?.defaultSchema;
    if (existing) {
      DBEngine.updateConnection(conn);
      setConnections((prev) => prev.map((c) => (c.id === conn.id ? conn : c)));
      if (activeConnection?.id === conn.id) setActiveConnection(conn);
    } else {
      DBEngine.addConnection(conn);
      setConnections((prev) => [...prev, conn]);
    }
    await handleSelectConnection(conn);
    // Default-schema change on an existing connection: re-seed the active
    // schema and persist it (handleSelectConnection already restored the
    // persisted value; this overrides it with the user's new intent).
    if (existing && conn.defaultSchema && conn.defaultSchema !== priorDefault) {
      handleSetActiveSchema(conn.defaultSchema);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Tab Manager Handlers
  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length === 1) return;
    const filtered = tabs.filter((t) => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  const handleNewQueryTab = (initialQuery = '', title = 'Console') => {
    const newId = `tab-${Date.now()}`;
    const newTabCount = tabs.filter((t) => t.type === 'editor').length + 1;
    const newTab: QueryTab = {
      id: newId,
      title: title === 'Console' ? `Console ${newTabCount}` : title,
      type: 'editor',
      query: initialQuery || `SELECT * FROM public.customers LIMIT 50;`,
      connectionId: activeConnection?.id || '',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Open Data Grid Tab on double-clicking table
  const handleOpenTableViewer = (schemaName: string, tableName: string, databaseName = activeDatabase || activeConnection?.database || '') => {
    const existing = tabs.find(
      (t) => t.type === 'table-viewer' && t.databaseName === databaseName && t.schema === schemaName && t.tableName === tableName
    );
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const newId = `tab-grid-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: `${schemaName}.${tableName}`,
      type: 'table-viewer',
      query: `SELECT * FROM ${schemaName}.${tableName};`,
      connectionId: activeConnection?.id || '',
      databaseName,
      schema: schemaName,
      tableName: tableName,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Open ERD Tab
  const handleOpenErdView = () => {
    const existing = tabs.find((t) => t.type === 'erd');
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const newId = `tab-erd-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: 'Schema ERD',
      type: 'erd',
      query: '',
      connectionId: activeConnection?.id || '',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Open EAV Studio Tab
  const handleOpenEavStudio = (schemaName?: string) => {
    const existing = tabs.find((t) => t.type === 'eav-studio');
    if (existing) {
      if (schemaName) {
        setTabs((prev) =>
          prev.map((t) => (t.id === existing.id ? { ...t, schema: schemaName } : t))
        );
      }
      setActiveTabId(existing.id);
      return;
    }

    const newId = `tab-eav-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: 'shrapnel EAV Studio',
      type: 'eav-studio',
      query: '',
      connectionId: activeConnection?.id || '',
      schema: schemaName || 'shrapnel',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Open Visual Query Builder Tab
  const handleOpenQueryBuilder = (schemaName?: string, tableName?: string, databaseName = activeDatabase || activeConnection?.database || '') => {
    const targetSchema = schemaName || schemas[0]?.name || 'public';
    const targetTable = tableName || (schemas.find((s) => s.name === targetSchema)?.tables[0]?.name || 'customers');
    const existing = tabs.find((t) => t.type === 'query-builder');
    if (existing) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                schema: targetSchema,
                databaseName,
                title: `Query Builder: ${targetTable}`,
              }
            : t
        )
      );
      setActiveTabId(existing.id);
      return;
    }

    const newId = `tab-builder-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: `Query Builder: ${targetTable}`,
      type: 'query-builder',
      query: '',
      connectionId: activeConnection?.id || '',
      databaseName,
      schema: targetSchema,
      tableName: targetTable,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleOpenDiffViewer = (leftResult?: QueryExecutionResult, rightResult?: QueryExecutionResult) => {
    const existing = tabs.find((t) => t.type === 'diff-viewer');
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const newId = `tab-diff-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: 'Diff Viewer',
      type: 'diff-viewer',
      query: '',
      connectionId: activeConnection?.id || '',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleUpdateSchemas = (updatedSchemas: SchemaObject[]) => {
    setSchemas(updatedSchemas);
    if (activeConnection) {
      DBEngine.saveSchemas(activeConnection.id, updatedSchemas);
    }
  };

  // Set the active schema (unqualified-name resolution target). Write-through
  // persisted per connection so it survives reloads and sessions.
  const handleSetActiveSchema = (schemaName: string) => {
    setActiveSchema(schemaName);
    if (activeConnection) DBEngine.setActiveSchema(activeConnection.id, schemaName, activeDatabase || activeConnection.database);
  };

  // Open the compare modal, optionally with a preselected base schema.
  const handleCompareSchemas = (left: string, right?: string) => {
    setCompareBaseSchema(left);
    if (right) setCompareRightSchema(right);
    setIsCompareModalOpen(true);
  };

  // Execute Query
  const handleRunQuery = async (queryToRun?: string) => {
    if (!activeConnection) return;
    const sql = queryToRun || activeTab.query;
    // Unqualified names resolve against the ACTIVE schema (tree-selected);
    // falls back to the connection default, then 'public'.
    const result = await DBEngine.executeQuery(
      activeConnection.id,
      sql,
      activeSchema || activeConnection.defaultSchema || 'public',
      activeDatabase || activeConnection.database
    );

    // Update active tab result
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, activeResult: result } : t))
    );

    // Push to execution history
    setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);

    // Refresh schema if DDL statement ran
    const upper = sql.trim().toUpperCase();
    if (
      upper.startsWith('CREATE') ||
      upper.startsWith('DROP') ||
      upper.startsWith('ALTER') ||
      upper.startsWith('INSERT') ||
      upper.startsWith('UPDATE') ||
      upper.startsWith('DELETE')
    ) {
      handleRefreshSchema();
    }
  };

  // Format Query
  const handleFormatQuery = () => {
    if (!activeTab || activeTab.type !== 'editor') return;
    const formatted = formatSqlQuery(activeTab.query, 'postgresql');
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, query: formatted, isUnsaved: true } : t))
    );
  };

  // Generate DDL statements from treeview context menu
  const handleGenerateQuery = (
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE' | 'DDL',
    schemaName: string,
    objectData: any,
    databaseName = activeDatabase || activeConnection?.database || ''
  ) => {
    if (!objectData) return;
    const ddl = DBEngine.generateDDL(type, schemaName, objectData);
    const newId = `tab-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: `${type} ${objectData.name}`,
      type: 'editor',
      query: ddl,
      connectionId: activeConnection?.id || '',
      databaseName,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Whole-schema DDL → new query tab (context menu on a schema node).
  const handleGenerateSchemaDDL = (schemaName: string, databaseName?: string) => {
    if (!activeConnection) return;
    const db = databaseName || activeDatabase || activeConnection.database;
    const schema = schemas.find((s) => s.name === schemaName) || databases.find((d) => d.name === db)?.schemas?.find((s) => s.name === schemaName);
    if (!schema) return;
    const ddl = DBEngine.generateSchemaDDL(schema, db);
    const newId = `tab-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: `DDL schema ${db}.${schemaName}`,
      type: 'editor',
      query: ddl,
      connectionId: activeConnection.id,
      databaseName: db,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Whole-database DDL → new query tab (context menu on a database node).
  // Opens every loaded schema of that database, one CREATE SCHEMA + objects
  // per section; schemas that were never expanded are skipped (comment notes it).
  const handleGenerateDatabaseDDL = (databaseName: string) => {
    if (!activeConnection) return;
    const database = databases.find((d) => d.name === databaseName);
    const loaded = database?.schemas || [];
    const sections = loaded.length
      ? loaded.map((schema) => DBEngine.generateSchemaDDL(schema, databaseName)).join('\n\n')
      : `-- Database ${databaseName}: no schemas have been loaded into the tree yet.\n-- Expand the schemas you want included, then regenerate.`;
    const header = `-- Database DDL for ${databaseName}\n-- ${loaded.length} loaded schema(s)\n\n`;
    const newId = `tab-${Date.now()}`;
    const newTab: QueryTab = {
      id: newId,
      title: `DDL database ${databaseName}`,
      type: 'editor',
      query: header + sections,
      connectionId: activeConnection.id,
      databaseName,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Save snippet
  const handleSaveSnippet = () => {
    if (!activeTab.query.trim()) return;
    const newSnippet: SavedQuery = {
      id: `snip-${Date.now()}`,
      title: activeTab.title,
      query: activeTab.query,
      databaseId: activeConnection?.id || '',
      updatedAt: new Date().toLocaleTimeString(),
    };
    const updated = [newSnippet, ...savedQueries];
    setSavedQueries(updated);
    localStorage.setItem('data_workbench_saved_snippets', JSON.stringify(updated));
  };

  // Delete table object from context menu. Guarded: drops outside the active
  // schema always require typed confirmation (schema-activity guard); drops
  // inside the active schema get a plain confirm.
  const handleDropObject = async (type: string, schemaName: string, objectName: string, databaseName = activeDatabase || activeConnection?.database || '') => {
    if (!activeConnection) return;
    const target = { type, schemaName, objectName, databaseName };
    if (databaseName !== activeDatabase || schemaName !== activeSchema) {
      setDropGuard({ open: true, target, confirmedText: '' });
      return;
    }
    if (!window.confirm(`Drop ${type} ${databaseName}.${schemaName}.${objectName}? This cannot be undone.`)) return;
    await executeDrop(target);
  };

  const executeDrop = async (target: { type: string; schemaName: string; objectName: string; databaseName?: string }) => {
    if (!activeConnection) return;
    const dropSql = `DROP ${target.type} ${target.schemaName}.${target.objectName};`;
    const result = await DBEngine.executeQuery(
      activeConnection.id,
      dropSql,
      target.schemaName,
      target.databaseName || activeDatabase || activeConnection.database
    );
    setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
    handleRefreshSchema();
  };

  // Table Data Viewer Actions
  const currentSchemaObj = schemas.find(
    (s) => s.name === activeTab.schema && (!activeTab.databaseName || s.databaseName === activeTab.databaseName)
  ) || schemas[0];
  const currentTableObj = currentSchemaObj?.tables.find((t) => t.name === activeTab.tableName);

  // In live mode, grid edits run REAL SQL against the connected database; in
  // mock mode they mutate the in-memory sample data as before.
  const sqlLiteral = (v: any): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  };

  const handleDataViewerUpdateRow = async (rowIndex: number, updatedRow: Record<string, any>) => {
    if (!currentTableObj || !activeConnection) return;
    const table = currentTableObj;
    if (table.data[rowIndex]) table.data[rowIndex] = updatedRow;
    DBEngine.saveSchema(activeConnection.id);

    if (isLiveMode()) {
      const pkCol = table.columns.find((c) => c.isPrimaryKey) || table.columns[0];
      if (!pkCol || updatedRow[pkCol.name] === undefined) {
        setExecutionHistory((prev) => [{
          query: `UPDATE ${table.schema}.${table.name}`,
          columns: [], rows: [], rowCount: 0, executionTimeMs: 0, status: 'error',
          error: 'Cannot update row: no primary key value available.',
          timestamp: new Date().toLocaleTimeString(),
        }, ...prev.slice(0, 49)]);
        return;
      }
      const setClause = table.columns
        .filter((c) => c.name !== pkCol.name)
        .map((c) => `${c.name} = ${sqlLiteral(updatedRow[c.name])}`)
        .join(', ');
      const sql = `UPDATE ${table.schema}.${table.name} SET ${setClause} WHERE ${pkCol.name} = ${sqlLiteral(updatedRow[pkCol.name])};`;
      const result = await DBEngine.executeQuery(
        activeConnection.id,
        sql,
        activeSchema || activeConnection.defaultSchema || 'public',
        activeDatabase || activeConnection.database
      );
      setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
    }
    handleRefreshSchema();
  };

  const handleDataViewerAddRow = async (newRow: Record<string, any>) => {
    if (!currentTableObj || !activeConnection) return;
    const table = currentTableObj;
    table.data.push(newRow);
    table.rowCount = table.data.length;
    DBEngine.saveSchema(activeConnection.id);

    if (isLiveMode()) {
      const cols = table.columns.filter((c) => newRow[c.name] !== undefined);
      if (cols.length === 0) return;
      const sql = `INSERT INTO ${table.schema}.${table.name} (${cols.map((c) => c.name).join(', ')})
        VALUES (${cols.map((c) => sqlLiteral(newRow[c.name])).join(', ')});`;
      const result = await DBEngine.executeQuery(
        activeConnection.id,
        sql,
        activeSchema || activeConnection.defaultSchema || 'public',
        activeDatabase || activeConnection.database
      );
      setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
    }
    handleRefreshSchema();
  };

  const handleDataViewerDeleteRow = async (rowIndex: number) => {
    if (!currentTableObj || !activeConnection) return;
    const table = currentTableObj;
    const deletedRow = table.data[rowIndex];
    table.data.splice(rowIndex, 1);
    table.rowCount = table.data.length;
    DBEngine.saveSchema(activeConnection.id);

    if (isLiveMode() && deletedRow) {
      const pkCol = table.columns.find((c) => c.isPrimaryKey) || table.columns[0];
      if (!pkCol || deletedRow[pkCol.name] === undefined) {
        setExecutionHistory((prev) => [{
          query: `DELETE FROM ${table.schema}.${table.name}`,
          columns: [], rows: [], rowCount: 0, executionTimeMs: 0, status: 'error',
          error: 'Cannot delete row: no primary key value available.',
          timestamp: new Date().toLocaleTimeString(),
        }, ...prev.slice(0, 49)]);
        return;
      }
      const sql = `DELETE FROM ${table.schema}.${table.name} WHERE ${pkCol.name} = ${sqlLiteral(deletedRow[pkCol.name])};`;
      const result = await DBEngine.executeQuery(
        activeConnection.id,
        sql,
        activeSchema || activeConnection.defaultSchema || 'public',
        activeDatabase || activeConnection.database
      );
      setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
    }
    handleRefreshSchema();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* Navbar Header */}
      <Header
        connections={connections}
        activeConnection={activeConnection}
        onSelectConnection={handleSelectConnection}
        onEditConnection={handleEditConnection}
        onOpenNewConnectionModal={() => { setEditingConnection(null); setIsConnModalOpen(true); }}
        onOpenNewTableModal={() => setIsNewTableModalOpen(true)}
        onOpenAiAssistant={() => setIsAiModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenErdView={handleOpenErdView}
        onOpenEavStudio={() => handleOpenEavStudio()}
        onOpenQueryBuilder={() => handleOpenQueryBuilder()}
        onOpenDiffViewer={() => handleOpenDiffViewer()}
        onRunCurrentQuery={() => handleRunQuery()}
        onFormatCurrentQuery={handleFormatQuery}
        onRefreshSchema={handleRefreshSchema}
        activeTabType={activeTab?.type || 'editor'}
        theme={theme}
        onChangeTheme={setTheme}
      />

      {/* Workbench Central Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left TreeView Sidebar */}
        <TreeView
          activeConnection={activeConnection}
          schemas={schemas}
          databases={databases}
          activeDatabase={activeDatabase}
          databaseLoading={databaseLoading}
          onSelectDatabase={handleSelectDatabase}
          savedQueries={savedQueries}
          history={executionHistory.map((h) => h.query)}
          onContextMenu={setContextMenu}
          onSelectTable={handleOpenTableViewer}
          onOpenSavedQuery={(q) => handleNewQueryTab(q.query, q.title)}
          onOpenHistoryQuery={(qStr) => handleNewQueryTab(qStr, 'History Query')}
          onOpenNewConnectionModal={() => { setEditingConnection(null); setIsConnModalOpen(true); }}
          onOpenNewTableModal={() => setIsNewTableModalOpen(true)}
          onRefreshSchema={handleRefreshSchema}
          onOpenEavStudio={(sName) => handleOpenEavStudio(sName)}
          onOpenQueryBuilder={(sName, tName, dbName) => handleOpenQueryBuilder(sName, tName, dbName)}
          activeSchema={activeSchema}
          onSetActiveSchema={handleSetActiveSchema}
          onCompareSchemas={handleCompareSchemas}
          width={sidebarWidth}
          onResize={handleSidebarResize}
        />

        {/* Main Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* Query Tabs Bar */}
          <QueryTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onNewTab={() => handleNewQueryTab()}
          />

          {/* Active Tab View */}
          {activeTab.type === 'editor' && (
            <div className="flex-1 flex flex-col min-h-0">
              <SqlEditor
                query={activeTab.query}
                onChangeQuery={(newQuery) =>
                  setTabs((prev) =>
                    prev.map((t) => (t.id === activeTabId ? { ...t, query: newQuery, isUnsaved: true } : t))
                  )
                }
                onRunQuery={(q) => handleRunQuery(q)}
                onFormatQuery={handleFormatQuery}
                onOpenAiAssistant={() => setIsAiModalOpen(true)}
                onSaveSnippet={handleSaveSnippet}
                onOpenQueryBuilder={() => handleOpenQueryBuilder()}
                schemas={schemas}
              />

              {/* Bottom Query Results Panel */}
              <ResultsPanel
                activeResult={activeTab.activeResult || null}
                history={executionHistory}
                onReRunQuery={(q) => handleRunQuery(q)}
                onOpenDiffTab={handleOpenDiffViewer}
                activeConnectionId={activeConnection?.id}
                schemas={schemas}
              />
            </div>
          )}

          {activeTab.type === 'diff-viewer' && (
            <ResultSetDiffViewer
              history={executionHistory}
              activeConnectionId={activeConnection?.id}
              schemas={schemas}
              isEmbedded={false}
            />
          )}

          {activeTab.type === 'table-viewer' && (
            <TableDataViewer
              schemaName={activeTab.schema || 'public'}
              tableName={activeTab.tableName || ''}
              table={currentTableObj}
              schemas={schemas}
              onOpenTable={(sName, tName) => handleOpenTableViewer(sName, tName)}
              onOpenQueryBuilder={(sName, tName, dbName) => handleOpenQueryBuilder(sName, tName, dbName)}
              onRefresh={handleRefreshSchema}
              onUpdateRow={handleDataViewerUpdateRow}
              onAddRow={handleDataViewerAddRow}
              onDeleteRow={handleDataViewerDeleteRow}
            />
          )}

          {activeTab.type === 'query-builder' && (
            <VisualQueryBuilder
              schemas={schemas}
              activeConnectionId={activeConnection?.id}
              initialSchema={activeTab.schema}
              initialTable={activeTab.tableName}
              onOpenInSqlEditor={(sql, title) => handleNewQueryTab(sql, title || 'Generated Query')}
              onRunQueryInEngine={(sql) => handleRunQuery(sql)}
            />
          )}

          {activeTab.type === 'erd' && (
            <ErdViewer
              schemas={schemas}
              onOpenTableQuery={(sName, tName) => handleOpenTableViewer(sName, tName)}
              globalTheme={theme}
              onUpdateSchemas={handleUpdateSchemas}
              onExecuteSql={(sql) => handleRunQuery(sql)}
            />
          )}

          {activeTab.type === 'eav-studio' && (
            <ShrapnelEavStudio
              schemas={schemas}
              activeSchemaName={activeTab.schema || 'shrapnel'}
              onUpdateSchema={handleUpdateSchemas}
              onRunQueryInConsole={(sql) => handleNewQueryTab(sql, 'EAV Query')}
            />
          )}
        </main>
      </div>

      {/* Floating Context Menu */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ ...contextMenu, visible: false })}
        onGenerateQuery={handleGenerateQuery}
        onViewDataGrid={handleOpenTableViewer}
        onDropObject={handleDropObject}
        onViewProperties={(sName, oName, oData) =>
          setObjectDetailsModal({ open: true, schemaName: sName, objectName: oName, objectData: oData })
        }
        onOpenEavStudio={(sName) => handleOpenEavStudio(sName)}
        onOpenQueryBuilder={(sName, tName, dbName) => handleOpenQueryBuilder(sName, tName, dbName)}
        onSetActiveSchema={handleSetActiveSchema}
        isActiveSchema={!!contextMenu.schemaName && contextMenu.schemaName === activeSchema}
        onCompareSchemas={handleCompareSchemas}
        onGenerateSchemaDDL={handleGenerateSchemaDDL}
        onGenerateDatabaseDDL={handleGenerateDatabaseDDL}
      />

      {/* Modals */}
      <ConnectionModal
        isOpen={isConnModalOpen}
        editing={editingConnection}
        onClose={() => {
          setIsConnModalOpen(false);
          setEditingConnection(null);
        }}
        onSaveConnection={handleSaveConnection}
      />

      <NewTableModal
        isOpen={isNewTableModalOpen}
        onClose={() => setIsNewTableModalOpen(false)}
        onCreateTable={async (ddl) => {
          if (!activeConnection) return;
          const result = await DBEngine.executeQuery(
            activeConnection.id,
            ddl,
            activeSchema || activeConnection.defaultSchema || 'public',
            activeDatabase || activeConnection.database
          );
          setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
          handleRefreshSchema();
        }}
      />

      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplySql={(sql) =>
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId ? { ...t, query: sql, isUnsaved: true } : t))
          )
        }
        schemas={schemas}
        currentQuery={activeTab.query}
      />

      <ObjectDetailsModal
        isOpen={objectDetailsModal.open}
        onClose={() => setObjectDetailsModal({ ...objectDetailsModal, open: false })}
        schemaName={objectDetailsModal.schemaName}
        objectName={objectDetailsModal.objectName}
        objectData={objectDetailsModal.objectData}
      />

      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <SchemaCompareModal
        isOpen={isCompareModalOpen}
        schemas={schemas}
        initialLeft={compareBaseSchema}
        onClose={() => {
          setIsCompareModalOpen(false);
          setCompareBaseSchema(undefined);
          setCompareRightSchema(undefined);
        }}
      />

      <DropGuardModal
        isOpen={dropGuard.open}
        target={dropGuard.target}
        activeSchema={activeSchema}
        onClose={() => setDropGuard({ open: false, target: null, confirmedText: '' })}
        onConfirm={async () => {
          const target = dropGuard.target;
          setDropGuard({ open: false, target: null, confirmedText: '' });
          if (target) await executeDrop(target);
        }}
      />
    </div>
  );
}
