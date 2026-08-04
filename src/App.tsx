import React, { useState, useEffect } from 'react';
import {
  DBConnection,
  SchemaObject,
  QueryTab,
  QueryExecutionResult,
  ContextMenuState,
  SavedQuery
} from './types/database';
import { DBEngine } from './services/dbEngine';
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

import { ConnectionModal } from './components/Modals/ConnectionModal';
import { NewTableModal } from './components/Modals/NewTableModal';
import { AiAssistantModal } from './components/Modals/AiAssistantModal';
import { ObjectDetailsModal } from './components/Modals/ObjectDetailsModal';
import { ShortcutsModal } from './components/Modals/ShortcutsModal';

export default function App() {
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
    DBEngine.initialize();
    const conns = DBEngine.getConnections();
    setConnections(conns);

    if (conns.length > 0) {
      const active = conns[0];
      setActiveConnection(active);
      const loadedSchemas = DBEngine.getSchemas(active.id);
      setSchemas(loadedSchemas);

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
  }, []);

  // Handle switching active connection
  const handleSelectConnection = (conn: DBConnection) => {
    setActiveConnection(conn);
    const loadedSchemas = DBEngine.getSchemas(conn.id);
    setSchemas(loadedSchemas);
  };

  // Refresh current schema
  const handleRefreshSchema = () => {
    if (activeConnection) {
      const reloaded = DBEngine.getSchemas(activeConnection.id);
      setSchemas([...reloaded]);
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

  const handleUpdateSchemas = (updatedSchemas: SchemaObject[]) => {
    setSchemas(updatedSchemas);
    if (activeConnection) {
      DBEngine.saveSchemas(activeConnection.id, updatedSchemas);
    }
  };

  // Execute Query
  const handleRunQuery = (queryToRun?: string) => {
    if (!activeConnection) return;
    const sql = queryToRun || activeTab.query;
    const result = DBEngine.executeQuery(activeConnection.id, sql);

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

  // Save new connection from modal
  const handleSaveConnection = (newConn: DBConnection) => {
    DBEngine.addConnection(newConn);
    setConnections(DBEngine.getConnections());
    handleSelectConnection(newConn);
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
  const handleDropObject = (type: string, schemaName: string, objectName: string) => {
    if (!activeConnection) return;
    const dropSql = `DROP ${type} ${schemaName}.${objectName};`;
    DBEngine.executeQuery(activeConnection.id, dropSql);
    handleRefreshSchema();
  };

  // Table Data Viewer Actions
  const currentSchemaObj = schemas.find((s) => s.name === activeTab.schema) || schemas[0];
  const currentTableObj = currentSchemaObj?.tables.find((t) => t.name === activeTab.tableName);

  const handleDataViewerUpdateRow = (rowIndex: number, updatedRow: Record<string, any>) => {
    if (!currentTableObj || !activeConnection) return;
    currentTableObj.data[rowIndex] = updatedRow;
    DBEngine.saveSchema(activeConnection.id);
    handleRefreshSchema();
  };

  const handleDataViewerAddRow = (newRow: Record<string, any>) => {
    if (!currentTableObj || !activeConnection) return;
    currentTableObj.data.push(newRow);
    currentTableObj.rowCount = currentTableObj.data.length;
    DBEngine.saveSchema(activeConnection.id);
    handleRefreshSchema();
  };

  const handleDataViewerDeleteRow = (rowIndex: number) => {
    if (!currentTableObj || !activeConnection) return;
    currentTableObj.data.splice(rowIndex, 1);
    currentTableObj.rowCount = currentTableObj.data.length;
    DBEngine.saveSchema(activeConnection.id);
    handleRefreshSchema();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* Navbar Header */}
      <Header
        connections={connections}
        activeConnection={activeConnection}
        onSelectConnection={handleSelectConnection}
        onOpenNewConnectionModal={() => setIsConnModalOpen(true)}
        onOpenNewTableModal={() => setIsNewTableModalOpen(true)}
        onOpenAiAssistant={() => setIsAiModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenErdView={handleOpenErdView}
        onOpenEavStudio={() => handleOpenEavStudio()}
        onRunCurrentQuery={() => handleRunQuery()}
        onFormatCurrentQuery={handleFormatQuery}
        onRefreshSchema={handleRefreshSchema}
        activeTabType={activeTab?.type || 'editor'}
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
          onOpenNewConnectionModal={() => setIsConnModalOpen(true)}
          onOpenNewTableModal={() => setIsNewTableModalOpen(true)}
          onRefreshSchema={handleRefreshSchema}
          onOpenEavStudio={(sName) => handleOpenEavStudio(sName)}
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
                schemas={schemas}
              />

              {/* Bottom Query Results Panel */}
              <ResultsPanel
                activeResult={activeTab.activeResult || null}
                history={executionHistory}
                onReRunQuery={(q) => handleRunQuery(q)}
              />
            </div>
          )}

          {activeTab.type === 'table-viewer' && (
            <TableDataViewer
              schemaName={activeTab.schema || 'public'}
              tableName={activeTab.tableName || ''}
              table={currentTableObj}
              onRefresh={handleRefreshSchema}
              onUpdateRow={handleDataViewerUpdateRow}
              onAddRow={handleDataViewerAddRow}
              onDeleteRow={handleDataViewerDeleteRow}
            />
          )}

          {activeTab.type === 'erd' && (
            <ErdViewer
              schemas={schemas}
              onOpenTableQuery={(sName, tName) => handleOpenTableViewer(sName, tName)}
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
      />

      {/* Modals */}
      <ConnectionModal
        isOpen={isConnModalOpen}
        onClose={() => setIsConnModalOpen(false)}
        onSaveConnection={handleSaveConnection}
      />

      <NewTableModal
        isOpen={isNewTableModalOpen}
        onClose={() => setIsNewTableModalOpen(false)}
        onCreateTable={(ddl) => {
          if (activeConnection) {
            DBEngine.executeQuery(activeConnection.id, ddl);
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
