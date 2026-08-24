import React, { useState, useEffect } from 'react';
import {
  DBConnection,
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
  const [schemas, setSchemas] = useState<SchemaObject[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [executionHistory, setExecutionHistory] = useState<QueryExecutionResult[]>([]);

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
        try {
          const loadedSchemas = await DBEngine.getSchemas(active.id);
          setSchemas(loadedSchemas);
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
    try {
      const loadedSchemas = await DBEngine.getSchemas(conn.id);
      setSchemas(loadedSchemas);
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
  };

  // Refresh current schema
  const handleRefreshSchema = async () => {
    if (activeConnection) {
      try {
        // bypassCache: Refresh must re-hit the live database, never replay a
        // (possibly empty) cached discovery.
        const reloaded = await DBEngine.getSchemas(activeConnection.id, { bypassCache: true });
        setSchemas([...reloaded]);
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
  const handleSaveConnection = async (conn: DBConnection) => {
    const existing = connections.find((c) => c.id === conn.id);
    if (existing) {
      DBEngine.updateConnection(conn);
      setConnections((prev) => prev.map((c) => (c.id === conn.id ? conn : c)));
      if (activeConnection?.id === conn.id) setActiveConnection(conn);
    } else {
      DBEngine.addConnection(conn);
      setConnections((prev) => [...prev, conn]);
    }
    await handleSelectConnection(conn);
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
  const handleOpenTableViewer = (schemaName: string, tableName: string) => {
    const existing = tabs.find(
      (t) => t.type === 'table-viewer' && t.schemaName === schemaName && t.tableName === tableName
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
  const handleOpenQueryBuilder = (schemaName?: string, tableName?: string) => {
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
                tableName: targetTable,
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
      DBEngine.saveSchema(activeConnection.id);
    }
  };

  // Execute Query
  const handleRunQuery = async (queryToRun?: string) => {
    if (!activeConnection) return;
    const sql = queryToRun || activeTab.query;
    const result = await DBEngine.executeQuery(activeConnection.id, sql);

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
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE',
    schemaName: string,
    objectData: any
  ) => {
    if (!objectData) return;
    const ddl = DBEngine.generateDDL(type, schemaName, objectData);
    handleNewQueryTab(ddl, `${type} ${objectData.name}`);
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

  // Delete table object from context menu
  const handleDropObject = async (type: string, schemaName: string, objectName: string) => {
    if (!activeConnection) return;
    const dropSql = `DROP ${type} ${schemaName}.${objectName};`;
    const result = await DBEngine.executeQuery(activeConnection.id, dropSql);
    setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
    handleRefreshSchema();
  };

  // Table Data Viewer Actions
  const currentSchemaObj = schemas.find((s) => s.name === activeTab.schema) || schemas[0];
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
      const result = await DBEngine.executeQuery(activeConnection.id, sql);
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
      const result = await DBEngine.executeQuery(activeConnection.id, sql);
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
      const result = await DBEngine.executeQuery(activeConnection.id, sql);
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
          onOpenQueryBuilder={(sName, tName) => handleOpenQueryBuilder(sName, tName)}
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
              onOpenQueryBuilder={(sName, tName) => handleOpenQueryBuilder(sName, tName)}
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
        onOpenQueryBuilder={(sName, tName) => handleOpenQueryBuilder(sName, tName)}
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
          if (activeConnection) {
            const result = await DBEngine.executeQuery(activeConnection.id, ddl);
            setExecutionHistory((prev) => [result, ...prev.slice(0, 49)]);
            handleRefreshSchema();
          }
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
    </div>
  );
}
