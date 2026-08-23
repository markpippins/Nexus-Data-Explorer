import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Network,
  Key,
  Layers,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Maximize2,
  Minimize2,
  Sparkles,
  Zap,
  LayoutGrid,
  Settings,
  Download,
  Info,
  ChevronRight,
  X,
  FileCode,
  ArrowRight,
  Database,
  Eye,
  Terminal,
  Shield,
  HelpCircle,
  Move,
  Palette,
  Sun,
  Moon,
  ChevronDown,
  Image,
  Loader2,
  Map,
  LocateFixed,
  Link,
  Link2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRightLeft,
} from 'lucide-react';
import { SchemaObject, TableObject, ColumnDefinition } from '../../types/database';
import { ErdMinimap } from './ErdMinimap';
import { NewRelationshipModal } from './NewRelationshipModal';

interface ErdViewerProps {
  schemas: SchemaObject[];
  onOpenTableQuery: (schemaName: string, tableName: string) => void;
  globalTheme?: Theme;
  onUpdateSchemas?: (updatedSchemas: SchemaObject[]) => void;
  onExecuteSql?: (sql: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RelationshipEdge {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  cardinality: '1:N' | '1:1' | 'N:M';
}

interface ActiveDragConnection {
  sourceTable: string;
  sourceColumn: string;
  sourceColumnType: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  sourceSide: 'left' | 'right';
}

interface HoveredTarget {
  table: string;
  column: string;
  type: string;
}

type Theme = 'dark' | 'light' | 'steel';

interface ThemeConfig {
  name: string;
  bgMain: string;
  bgCanvas: string;
  gridColor: string;
  toolbarBg: string;
  toolbarBorder: string;
  toolbarText: string;
  toolbarMuted: string;
  nodeBg: string;
  nodeHeaderBg: string;
  nodeHeaderSelected: string;
  nodeBorder: string;
  nodeBorderHover: string;
  nodeColumnBg: string;
  nodeColumnPkBg: string;
  nodeColumnFkBg: string;
  nodeColumnDefaultBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  edgeDefault: string;
  edgeConnected: string;
  edgeSelected: string;
  edgeBadgeBg: string;
  inspectorBg: string;
  inspectorHeaderBg: string;
  inspectorBorder: string;
}

const THEMES: Record<Theme, ThemeConfig> = {
  dark: {
    name: 'Dark CAD',
    bgMain: 'bg-[#0B0D10]',
    bgCanvas: '#0F1115',
    gridColor: '#2D3139',
    toolbarBg: 'bg-[#181A1F]',
    toolbarBorder: 'border-[#2D3139]',
    toolbarText: 'text-[#E2E8F0]',
    toolbarMuted: 'text-[#94A3B8]',
    nodeBg: 'bg-[#181A1F]',
    nodeHeaderBg: 'bg-[#1E232A]',
    nodeHeaderSelected: 'bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border-purple-600',
    nodeBorder: 'border-[#2D3139]',
    nodeBorderHover: 'hover:border-[#3B414D]',
    nodeColumnBg: 'bg-[#13151B]',
    nodeColumnPkBg: 'bg-amber-950/30 border-amber-800/40',
    nodeColumnFkBg: 'bg-blue-950/30 border-blue-800/40',
    nodeColumnDefaultBg: 'bg-[#181A1F] border-[#2D3139]/60',
    textPrimary: 'text-white',
    textSecondary: 'text-[#E2E8F0]',
    textMuted: 'text-[#64748B]',
    edgeDefault: '#475569',
    edgeConnected: '#A855F7',
    edgeSelected: '#F59E0B',
    edgeBadgeBg: '#181A1F',
    inspectorBg: 'bg-[#181A1F]',
    inspectorHeaderBg: 'bg-[#1E232A]',
    inspectorBorder: 'border-[#2D3139]',
  },
  light: {
    name: 'Light Draft',
    bgMain: 'bg-[#F8FAFC]',
    bgCanvas: '#F1F5F9',
    gridColor: '#CBD5E1',
    toolbarBg: 'bg-white',
    toolbarBorder: 'border-slate-200',
    toolbarText: 'text-slate-800',
    toolbarMuted: 'text-slate-500',
    nodeBg: 'bg-white',
    nodeHeaderBg: 'bg-slate-100',
    nodeHeaderSelected: 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-400',
    nodeBorder: 'border-slate-300',
    nodeBorderHover: 'hover:border-slate-400',
    nodeColumnBg: 'bg-slate-50',
    nodeColumnPkBg: 'bg-amber-50 border-amber-200',
    nodeColumnFkBg: 'bg-blue-50 border-blue-200',
    nodeColumnDefaultBg: 'bg-white border-slate-200',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    edgeDefault: '#94A3B8',
    edgeConnected: '#7C3AED',
    edgeSelected: '#D97706',
    edgeBadgeBg: '#FFFFFF',
    inspectorBg: 'bg-white',
    inspectorHeaderBg: 'bg-slate-100',
    inspectorBorder: 'border-slate-200',
  },
  steel: {
    name: 'Steel Blue',
    bgMain: 'bg-[#1E293B]',
    bgCanvas: '#0F172A',
    gridColor: '#334155',
    toolbarBg: 'bg-[#1E293B]',
    toolbarBorder: 'border-slate-700',
    toolbarText: 'text-slate-100',
    toolbarMuted: 'text-slate-400',
    nodeBg: 'bg-[#1E293B]',
    nodeHeaderBg: 'bg-[#334155]',
    nodeHeaderSelected: 'bg-gradient-to-r from-cyan-900 to-slate-800 border-cyan-500',
    nodeBorder: 'border-slate-700',
    nodeBorderHover: 'hover:border-slate-500',
    nodeColumnBg: 'bg-[#0F172A]',
    nodeColumnPkBg: 'bg-amber-950/40 border-amber-700/50',
    nodeColumnFkBg: 'bg-cyan-950/40 border-cyan-700/50',
    nodeColumnDefaultBg: 'bg-[#1E293B] border-slate-700',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-200',
    textMuted: 'text-slate-400',
    edgeDefault: '#64748B',
    edgeConnected: '#06B6D4',
    edgeSelected: '#F59E0B',
    edgeBadgeBg: '#1E293B',
    inspectorBg: 'bg-[#1E293B]',
    inspectorHeaderBg: 'bg-[#334155]',
    inspectorBorder: 'border-slate-700',
  },
};

export const ErdViewer: React.FC<ErdViewerProps> = ({
  schemas,
  onOpenTableQuery,
  globalTheme,
  onUpdateSchemas,
  onExecuteSql,
}) => {
  const [selectedSchema, setSelectedSchema] = useState(schemas[0]?.name || 'public');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(0.9);
  const [lineStyle, setLineStyle] = useState<'orthogonal' | 'bezier' | 'straight'>('orthogonal');
  const [notationStyle, setNotationStyle] = useState<'crowsfoot' | 'uml'>('crowsfoot');
  const [theme, setTheme] = useState<Theme>(globalTheme || 'dark');

  useEffect(() => {
    if (globalTheme) {
      setTheme(globalTheme);
    }
  }, [globalTheme]);

  // Selection
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  // Link Mode & Drag Line Relationships
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [activeDragConnection, setActiveDragConnection] = useState<ActiveDragConnection | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<HoveredTarget | null>(null);

  // Relationship Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    sourceTable?: string;
    sourceColumn?: string;
    targetTable?: string;
    targetColumn?: string;
  }>({ isOpen: false });

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Export dropdown states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dragging state for table nodes
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pan state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const t = THEMES[theme];

  const activeSchema = schemas.find((s) => s.name === selectedSchema) || schemas[0];
  const tables = useMemo(() => {
    if (!activeSchema) return [];
    return activeSchema.tables.filter((table) =>
      table.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeSchema, searchTerm]);

  // Dynamic layout node positions state
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  // Calculate grid layout positions
  const calculateAutoLayout = () => {
    if (!activeSchema) return;

    const positions: Record<string, NodePosition> = {};
    const colsCount = Math.ceil(Math.sqrt(activeSchema.tables.length * 1.2));
    const cardWidth = 260;
    const cardHeight = 220;
    const gapX = 140;
    const gapY = 100;

    activeSchema.tables.forEach((table, idx) => {
      const row = Math.floor(idx / colsCount);
      const col = idx % colsCount;
      const computedHeight = Math.max(160, 60 + table.columns.length * 28);

      positions[table.name] = {
        x: col * (cardWidth + gapX) + 60,
        y: row * (cardHeight + gapY) + 60,
        width: cardWidth,
        height: computedHeight,
      };
    });

    setNodePositions(positions);
  };

  useEffect(() => {
    calculateAutoLayout();
  }, [selectedSchema]);

  // Extract all Foreign Key Relationship Edges
  const relationships = useMemo(() => {
    if (!activeSchema) return [];
    const edges: RelationshipEdge[] = [];

    activeSchema.tables.forEach((table) => {
      table.columns.forEach((col) => {
        if (col.isForeignKey && col.referencesTable) {
          edges.push({
            id: `fk-${table.name}-${col.name}-${col.referencesTable}`,
            sourceTable: table.name,
            sourceColumn: col.name,
            targetTable: col.referencesTable,
            targetColumn: col.referencesColumn || 'id',
            cardinality: col.isPrimaryKey ? '1:1' : '1:N',
          });
        }
      });
    });

    return edges;
  }, [activeSchema]);

  // Helper to get exact column row Y center in canvas coordinate space
  const getColumnAnchorCoord = (tableName: string, columnName: string, side: 'left' | 'right' = 'right') => {
    const table = tables.find((t) => t.name === tableName);
    const pos = nodePositions[tableName];
    if (!table || !pos) return { x: 0, y: 0 };

    const colIdx = table.columns.findIndex((c) => c.name === columnName);
    const colY = colIdx >= 0 ? pos.y + 38 + 6 + colIdx * 28 + 14 : pos.y + pos.height / 2;
    const colX = side === 'left' ? pos.x : pos.x + pos.width;

    return { x: colX, y: colY };
  };

  // Dragging Table Cards
  const handleNodeMouseDown = (e: React.MouseEvent, tableName: string) => {
    if (activeDragConnection) return;
    e.stopPropagation();
    setSelectedTable(tableName);
    setSelectedEdge(null);

    const pos = nodePositions[tableName];
    if (!pos) return;

    setDraggingTable(tableName);
    setDragOffset({
      x: e.clientX / zoom - pos.x,
      y: e.clientY / zoom - pos.y,
    });
  };

  // Start dragging a foreign key relationship from a column anchor
  const handleStartDragConnection = (
    e: React.MouseEvent,
    tableName: string,
    columnName: string,
    columnType: string,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const anchor = getColumnAnchorCoord(tableName, columnName, side);

    const canvasX = (e.clientX - cRect.left - pan.x) / zoom;
    const canvasY = (e.clientY - cRect.top - pan.y) / zoom;

    setActiveDragConnection({
      sourceTable: tableName,
      sourceColumn: columnName,
      sourceColumnType: columnType,
      startX: anchor.x,
      startY: anchor.y,
      currentX: canvasX,
      currentY: canvasY,
      sourceSide: side,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (activeDragConnection && containerRef.current) {
      const cRect = containerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - cRect.left - pan.x) / zoom;
      const canvasY = (e.clientY - cRect.top - pan.y) / zoom;

      setActiveDragConnection((prev) =>
        prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null
      );
    } else if (draggingTable) {
      const newX = Math.max(10, e.clientX / zoom - dragOffset.x);
      const newY = Math.max(10, e.clientY / zoom - dragOffset.y);

      setNodePositions((prev) => ({
        ...prev,
        [draggingTable]: {
          ...prev[draggingTable],
          x: newX,
          y: newY,
        },
      }));
    } else if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y),
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeDragConnection) {
      if (hoveredTarget) {
        if (
          activeDragConnection.sourceTable !== hoveredTarget.table ||
          activeDragConnection.sourceColumn !== hoveredTarget.column
        ) {
          // Open relationship modal
          setModalState({
            isOpen: true,
            sourceTable: activeDragConnection.sourceTable,
            sourceColumn: activeDragConnection.sourceColumn,
            targetTable: hoveredTarget.table,
            targetColumn: hoveredTarget.column,
          });
        }
      }
      setActiveDragConnection(null);
    }

    setDraggingTable(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setSelectedTable(null);
      setSelectedEdge(null);
      if (e.button === 0 || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  // Compute Connector Path between two table columns or boxes
  const getConnectorPath = (rel: RelationshipEdge, sourcePos: NodePosition, targetPos: NodePosition) => {
    if (!sourcePos || !targetPos) return { path: '', x1: 0, y1: 0, x2: 0, y2: 0 };

    const srcAnchor = getColumnAnchorCoord(rel.sourceTable, rel.sourceColumn, 'right');
    const tgtAnchor = getColumnAnchorCoord(rel.targetTable, rel.targetColumn, 'left');

    const sCy = srcAnchor.y;
    const tCy = tgtAnchor.y;

    let x1 = 0, y1 = sCy, x2 = 0, y2 = tCy;

    if (targetPos.x >= sourcePos.x + sourcePos.width) {
      x1 = sourcePos.x + sourcePos.width;
      x2 = targetPos.x;
    } else if (sourcePos.x >= targetPos.x + targetPos.width) {
      x1 = sourcePos.x;
      x2 = targetPos.x + targetPos.width;
    } else {
      x1 = targetPos.x > sourcePos.x ? sourcePos.x + sourcePos.width : sourcePos.x;
      x2 = targetPos.x > sourcePos.x ? targetPos.x : targetPos.x + targetPos.width;
    }

    let path = '';
    if (lineStyle === 'orthogonal') {
      const midX = (x1 + x2) / 2;
      path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    } else if (lineStyle === 'bezier') {
      const deltaX = Math.max(40, Math.abs(x2 - x1) * 0.5);
      path = `M ${x1} ${y1} C ${x1 + (x2 > x1 ? deltaX : -deltaX)} ${y1}, ${x2 + (x2 > x1 ? -deltaX : deltaX)} ${y2}, ${x2} ${y2}`;
    } else {
      path = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    return { path, x1, y1, x2, y2 };
  };

  // Save new or updated foreign key relationship
  const handleSaveRelationship = (params: {
    schemaName: string;
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    constraintName: string;
    cardinality: '1:N' | '1:1';
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate: 'CASCADE' | 'RESTRICT' | 'NO ACTION';
  }) => {
    const updatedSchemas = schemas.map((schema) => {
      if (schema.name !== params.schemaName) return schema;
      const updatedTables = schema.tables.map((table) => {
        if (table.name === params.sourceTable) {
          const updatedColumns = table.columns.map((col) => {
            if (col.name === params.sourceColumn) {
              return {
                ...col,
                isForeignKey: true,
                referencesTable: params.targetTable,
                referencesColumn: params.targetColumn,
              };
            }
            return col;
          });
          return { ...table, columns: updatedColumns };
        }
        return table;
      });
      return { ...schema, tables: updatedTables };
    });

    if (onUpdateSchemas) {
      onUpdateSchemas(updatedSchemas);
    }

    const newEdgeId = `fk-${params.sourceTable}-${params.sourceColumn}-${params.targetTable}`;
    setSelectedEdge(newEdgeId);
    setSelectedTable(null);

    setToast({
      message: `Defined relationship: ${params.sourceTable}.${params.sourceColumn} ➔ ${params.targetTable}.${params.targetColumn}`,
      type: 'success',
    });
  };

  // Delete foreign key relationship
  const handleDeleteRelationship = (rel: RelationshipEdge) => {
    const updatedSchemas = schemas.map((schema) => {
      if (schema.name !== selectedSchema) return schema;
      const updatedTables = schema.tables.map((table) => {
        if (table.name === rel.sourceTable) {
          const updatedColumns = table.columns.map((col) => {
            if (col.name === rel.sourceColumn) {
              const { referencesTable, referencesColumn, ...rest } = col;
              return {
                ...rest,
                isForeignKey: false,
              };
            }
            return col;
          });
          return { ...table, columns: updatedColumns };
        }
        return table;
      });
      return { ...schema, tables: updatedTables };
    });

    if (onUpdateSchemas) {
      onUpdateSchemas(updatedSchemas);
    }

    setSelectedEdge(null);

    setToast({
      message: `Deleted foreign key relationship on ${rel.sourceTable}.${rel.sourceColumn}`,
      type: 'info',
    });
  };

  const selectedTableObj = activeSchema?.tables.find((table) => table.name === selectedTable);
  const selectedEdgeObj = relationships.find((r) => r.id === selectedEdge);

  // Generate high-resolution standalone SVG document containing complete ERD diagram
  const generateExportSvgString = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    tables.forEach((table) => {
      const pos = nodePositions[table.name];
      if (!pos) return;
      const computedHeight = Math.max(160, 60 + table.columns.length * 28);
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + pos.width > maxX) maxX = pos.x + pos.width;
      if (pos.y + computedHeight > maxY) maxY = pos.y + computedHeight;
    });

    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 800; maxY = 600;
    }

    const padding = 60;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const width = Math.max(400, Math.ceil(maxX - cropX + padding));
    const height = Math.max(300, Math.ceil(maxY - cropY + padding));

    const isLight = theme === 'light';
    const isSteel = theme === 'steel';
    const gridColor = t.gridColor;

    const escapeXml = (unsafe: string) =>
      unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

    const defs = `
      <defs>
        <pattern id="exp-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1" fill="${gridColor}" opacity="0.6" />
        </pattern>
        <marker id="exp-crowsfoot" viewBox="0 0 20 20" refX="18" refY="10" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M 0 0 L 20 10 L 0 20 M 12 0 L 12 20" fill="none" stroke="${t.edgeConnected}" stroke-width="2" />
        </marker>
        <marker id="exp-oneside" viewBox="0 0 20 20" refX="2" refY="10" markerWidth="10" markerHeight="10" orient="auto">
          <path d="M 6 2 L 6 18 M 12 2 L 12 18" fill="none" stroke="${isSteel ? '#06B6D4' : isLight ? '#2563EB' : '#38BDF8'}" stroke-width="2" />
        </marker>
      </defs>
    `;

    let relsSvg = '';
    relationships.forEach((rel) => {
      const srcPos = nodePositions[rel.sourceTable];
      const tgtPos = nodePositions[rel.targetTable];
      if (!srcPos || !tgtPos) return;

      const { x1, y1, x2, y2 } = getConnectorPath(rel, srcPos, tgtPos);
      const sx1 = x1 - cropX;
      const sy1 = y1 - cropY;
      const sx2 = x2 - cropX;
      const sy2 = y2 - cropY;

      let adjPath = '';
      if (lineStyle === 'orthogonal') {
        const midX = (sx1 + sx2) / 2;
        adjPath = `M ${sx1} ${sy1} L ${midX} ${sy1} L ${midX} ${sy2} L ${sx2} ${sy2}`;
      } else if (lineStyle === 'bezier') {
        const deltaX = Math.abs(sx2 - sx1) * 0.5;
        adjPath = `M ${sx1} ${sy1} C ${sx1 + deltaX} ${sy1}, ${sx2 - deltaX} ${sy2}, ${sx2} ${sy2}`;
      } else {
        adjPath = `M ${sx1} ${sy1} L ${sx2} ${sy2}`;
      }

      const badgeX = (sx1 + sx2) / 2;
      const badgeY = (sy1 + sy2) / 2;

      relsSvg += `
        <g>
          <path d="${adjPath}" fill="none" stroke="${t.edgeConnected}" stroke-width="2"
            ${rel.cardinality === '1:1' ? 'stroke-dasharray="4 2"' : ''}
            marker-end="url(#exp-crowsfoot)" marker-start="url(#exp-oneside)" />
          <g transform="translate(${badgeX}, ${badgeY})">
            <rect x="-22" y="-10" width="44" height="20" rx="4" fill="${t.edgeBadgeBg}" stroke="${t.edgeConnected}" stroke-width="1" />
            <text x="0" y="3" text-anchor="middle" fill="${isLight ? '#0F172A' : '#E2E8F0'}" font-size="9" font-family="monospace" font-weight="bold">${escapeXml(rel.cardinality)}</text>
          </g>
        </g>
      `;
    });

    let tablesSvg = '';
    tables.forEach((table) => {
      const pos = nodePositions[table.name];
      if (!pos) return;
      const sx = pos.x - cropX;
      const sy = pos.y - cropY;
      const computedHeight = Math.max(160, 60 + table.columns.length * 28);

      const headerFill = isLight ? '#F1F5F9' : isSteel ? '#334155' : '#1E232A';
      const cardFill = isLight ? '#FFFFFF' : isSteel ? '#1E293B' : '#181A1F';
      const cardBorder = isLight ? '#CBD5E1' : isSteel ? '#475569' : '#2D3139';
      const textTitleColor = isLight ? '#0F172A' : '#FFFFFF';

      let colsSvg = '';
      table.columns.forEach((col, idx) => {
        const colY = sy + 38 + idx * 28;
        const isPk = col.isPrimaryKey;
        const isFk = col.isForeignKey;

        const colBg = isPk
          ? isLight ? '#FEF3C7' : '#451A03'
          : isFk
          ? isLight ? '#EFF6FF' : '#172554'
          : isLight ? '#F8FAFC' : '#13151B';

        const colTextColor = isPk
          ? '#F59E0B'
          : isFk
          ? isSteel ? '#38BDF8' : '#60A5FA'
          : isLight ? '#334155' : '#E2E8F0';

        colsSvg += `
          <g transform="translate(${sx + 6}, ${colY})">
            <rect x="0" y="0" width="${pos.width - 12}" height="24" rx="4" fill="${colBg}" />
            <text x="8" y="16" fill="${colTextColor}" font-size="11" font-family="monospace" font-weight="${isPk || isFk ? 'bold' : 'normal'}">${escapeXml(col.name)}</text>
            <text x="${pos.width - 20}" y="16" text-anchor="end" fill="${isLight ? '#64748B' : '#94A3B8'}" font-size="10" font-family="monospace">${escapeXml(col.type)}</text>
          </g>
        `;
      });

      tablesSvg += `
        <g id="table-${escapeXml(table.name)}">
          <rect x="${sx}" y="${sy}" width="${pos.width}" height="${computedHeight}" rx="8" fill="${cardFill}" stroke="${cardBorder}" stroke-width="1.5" />
          <path d="M ${sx} ${sy + 36} L ${sx + pos.width} ${sy + 36}" stroke="${cardBorder}" stroke-width="1" />
          <rect x="${sx}" y="${sy}" width="${pos.width}" height="36" rx="8" fill="${headerFill}" />
          <rect x="${sx}" y="${sy + 28}" width="${pos.width}" height="8" fill="${headerFill}" />
          <text x="${sx + 12}" y="${sy + 15}" fill="${isSteel ? '#38BDF8' : '#A855F7'}" font-size="8" font-family="monospace" font-weight="bold" letter-spacing="1">&lt;&lt;TABLE&gt;&gt;</text>
          <text x="${sx + 12}" y="${sy + 29}" fill="${textTitleColor}" font-size="12" font-family="monospace" font-weight="bold">${escapeXml(table.name)}</text>
          <text x="${sx + pos.width - 12}" y="${sy + 23}" text-anchor="end" fill="${isLight ? '#64748B' : '#94A3B8'}" font-size="9" font-family="monospace">${table.rowCount} r</text>
          ${colsSvg}
        </g>
      `;
    });

    return `<?xml version="1.0" standalone="no"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${defs}
        <rect width="100%" height="100%" fill="${t.bgCanvas}" />
        <rect width="100%" height="100%" fill="url(#exp-grid)" />
        ${relsSvg}
        ${tablesSvg}
      </svg>
    `;
  };

  // Export handler
  const handleExportImage = (format: 'svg' | 'png') => {
    setIsExporting(true);
    try {
      const svgString = generateExportSvgString();

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = doc.documentElement;
      const width = parseFloat(svgEl.getAttribute('width') || '1200');
      const height = parseFloat(svgEl.getAttribute('height') || '900');

      if (format === 'svg') {
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedSchema}_erd_diagram_${theme}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        setShowExportMenu(false);
      } else {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setIsExporting(false);
          return;
        }

        const img = new window.Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);

          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              const link = document.createElement('a');
              link.href = pngUrl;
              link.download = `${selectedSchema}_erd_diagram_${theme}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(pngUrl);
            }
            setIsExporting(false);
            setShowExportMenu(false);
          }, 'image/png');
        };

        img.onerror = (err) => {
          console.error('Failed to convert SVG to PNG:', err);
          setIsExporting(false);
          setShowExportMenu(false);
        };

        img.src = url;
      }
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col ${t.bgMain} font-sans text-xs select-none overflow-hidden relative`}>
      {/* Top Engineering Toolbar */}
      <div className={`${t.toolbarBg} border-b ${t.toolbarBorder} px-4 py-2 flex flex-wrap items-center justify-between gap-2 ${t.toolbarText} shrink-0 z-10 shadow-md`}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-bold bg-purple-600/10 border border-purple-500/40 px-2.5 py-1 rounded">
            <Network className="w-4 h-4 text-purple-500" />
            <span className="tracking-wide text-xs">PowerDesigner E/R Studio</span>
          </div>

          {/* Schema Selector */}
          <div className="flex items-center space-x-1.5">
            <label className={`text-[11px] ${t.toolbarMuted} font-mono`}>Schema:</label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className={`bg-transparent border ${t.toolbarBorder} rounded px-2.5 py-1 text-xs ${t.toolbarText} focus:outline-none focus:border-purple-500 font-mono`}
            >
              {schemas.map((s) => (
                <option key={s.name} value={s.name} className="bg-slate-900 text-white">
                  {s.name} {s.category === 'shrapnel' ? '(shrapnel EAV)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${t.toolbarMuted} pointer-events-none`} />
            <input
              type="text"
              placeholder="Highlight entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`bg-transparent border ${t.toolbarBorder} rounded pl-8 pr-2.5 py-1 text-xs ${t.toolbarText} focus:outline-none focus:border-purple-500 placeholder:text-slate-400 w-44 font-mono`}
            />
          </div>
        </div>

        {/* Action Controls & Link Mode Options */}
        <div className="flex flex-wrap items-center gap-2 font-mono">
          {/* Link Mode Toggle Button */}
          <button
            onClick={() => setIsLinkMode(!isLinkMode)}
            className={`px-2.5 py-1 text-xs rounded border font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
              isLinkMode
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-purple-900/40 ring-2 ring-purple-400/50 animate-pulse'
                : `${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} text-purple-400 hover:text-purple-300`
            }`}
            title="Toggle Link Columns Mode to drag and connect foreign keys"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{isLinkMode ? 'Linking Active' : 'Link Columns'}</span>
          </button>

          {/* Manual + Add Relationship Button */}
          <button
            onClick={() => setModalState({ isOpen: true })}
            className={`px-2.5 py-1 text-xs rounded border font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="Open Foreign Key Definition Dialog"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Relationship</span>
          </button>

          {/* Theme Selector */}
          <div className={`flex items-center border ${t.toolbarBorder} rounded-md px-2 py-1 space-x-2 ${theme === 'light' ? 'bg-slate-100 shadow-sm' : 'bg-slate-900/80 shadow-sm'}`}>
            <div className="flex items-center space-x-1 text-purple-400 font-bold text-[11px]">
              <Palette className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Theme:</span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setTheme('dark')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-purple-600 text-white font-bold shadow ring-1 ring-purple-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Dark CAD Theme"
              >
                <Moon className="w-3 h-3 text-purple-300" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-500 text-white font-bold shadow ring-1 ring-amber-300'
                    : 'text-slate-400 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Light Draft Blueprint Theme"
              >
                <Sun className="w-3 h-3 text-amber-200" />
                <span>Light</span>
              </button>
              <button
                onClick={() => setTheme('steel')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                  theme === 'steel'
                    ? 'bg-cyan-600 text-white font-bold shadow ring-1 ring-cyan-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
                title="Steel Blue Metallic Theme"
              >
                <Palette className="w-3 h-3 text-cyan-200" />
                <span>Steel</span>
              </button>
            </div>
          </div>

          {/* Connector Line Style */}
          <div className={`flex items-center border ${t.toolbarBorder} rounded p-0.5 ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900/60'}`}>
            <button
              onClick={() => setLineStyle('orthogonal')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                lineStyle === 'orthogonal'
                  ? 'bg-purple-600 text-white font-bold'
                  : `${t.toolbarMuted} hover:text-purple-400`
              }`}
              title="Orthogonal Step Lines"
            >
              Orthogonal
            </button>
            <button
              onClick={() => setLineStyle('bezier')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                lineStyle === 'bezier'
                  ? 'bg-purple-600 text-white font-bold'
                  : `${t.toolbarMuted} hover:text-purple-400`
              }`}
              title="Cubic Bezier Curves"
            >
              Curved
            </button>
            <button
              onClick={() => setLineStyle('straight')}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                lineStyle === 'straight'
                  ? 'bg-purple-600 text-white font-bold'
                  : `${t.toolbarMuted} hover:text-purple-400`
              }`}
              title="Straight Lines"
            >
              Straight
            </button>
          </div>

          {/* Notation Toggle */}
          <button
            onClick={() => setNotationStyle(notationStyle === 'crowsfoot' ? 'uml' : 'crowsfoot')}
            className={`px-2 py-1 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} text-xs ${t.toolbarText} rounded border flex items-center space-x-1.5 transition-colors`}
            title="Toggle Crow's Foot vs UML Notation"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{notationStyle === 'crowsfoot' ? "IE Crow's Foot" : 'UML 1..*'}</span>
          </button>

          {/* Auto Layout */}
          <button
            onClick={calculateAutoLayout}
            className={`px-2.5 py-1 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} text-xs text-purple-500 rounded border flex items-center space-x-1.5 transition-colors`}
            title="Auto Arrange Layout"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-purple-500" />
            <span>Auto Layout</span>
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`px-2.5 py-1 text-xs rounded border font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              showMinimap
                ? 'bg-purple-600/20 border-purple-500 text-purple-400 font-semibold shadow-sm'
                : `${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} ${t.toolbarText}`
            }`}
            title="Toggle Database Minimap Overview"
          >
            <Map className="w-3.5 h-3.5 text-purple-400" />
            <span>Minimap</span>
          </button>

          {/* Legend Toggle */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-1.5 rounded border transition-colors ${
              showLegend
                ? 'bg-purple-600/20 border-purple-500 text-purple-500'
                : `${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} ${t.toolbarText}`
            }`}
            title="Toggle E/R Legend"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className={`px-2.5 py-1 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-emerald-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400'} text-xs rounded border font-medium flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer`}
              title="Export ERD Diagram"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {showExportMenu && (
              <div className={`absolute right-0 mt-1.5 w-56 ${t.nodeBg} border ${t.nodeBorder} rounded-lg shadow-2xl py-1 z-50 font-mono text-xs text-left backdrop-blur-md`}>
                <div className={`px-3 py-1.5 text-[10px] font-bold ${t.textMuted} uppercase border-b ${t.nodeBorder}`}>
                  Export Diagram Visualization
                </div>

                <button
                  onClick={() => handleExportImage('svg')}
                  className={`w-full px-3 py-2 flex items-center space-x-2.5 text-left hover:${t.nodeHeaderBg} ${t.textPrimary} transition-colors cursor-pointer`}
                >
                  <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <div className="font-bold">Export as SVG</div>
                    <div className={`text-[10px] ${t.textMuted}`}>Scalable vector file (.svg)</div>
                  </div>
                </button>

                <button
                  onClick={() => handleExportImage('png')}
                  className={`w-full px-3 py-2 flex items-center space-x-2.5 text-left hover:${t.nodeHeaderBg} ${t.textPrimary} transition-colors cursor-pointer`}
                >
                  <Image className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold">Export as High-Res PNG</div>
                    <div className={`text-[10px] ${t.textMuted}`}>2x HD image file (.png)</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className={`flex items-center space-x-1 border-l ${t.toolbarBorder} pl-2`}>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
              className={`p-1.5 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} ${t.toolbarText} rounded border transition-colors`}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className={`text-[10px] ${t.toolbarMuted} w-8 text-center`}>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className={`p-1.5 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} ${t.toolbarText} rounded border transition-colors`}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(0.9);
                setPan({ x: 40, y: 40 });
              }}
              className={`p-1.5 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 border-slate-700'} ${t.toolbarText} rounded border transition-colors`}
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Helper Banner when Link Mode is Enabled */}
      {isLinkMode && (
        <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 border-b border-purple-500/50 px-4 py-1.5 flex items-center justify-between text-white font-mono text-[11px] z-20 shadow-lg animate-in slide-in-from-top-1">
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-purple-300 animate-spin" style={{ animationDuration: '3s' }} />
            <span>
              <strong>Link Columns Mode Active:</strong> Drag from any column connector handle (●) and drop onto another table's column to define a Foreign Key relationship.
            </span>
          </div>
          <button
            onClick={() => setIsLinkMode(false)}
            className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-800 text-purple-200 border border-purple-600/50 text-[10px] cursor-pointer"
          >
            Exit Link Mode
          </button>
        </div>
      )}

      {/* Main Diagram Area with Inspector Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Infinite CAD Canvas Container */}
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className={`flex-1 relative overflow-hidden ${
            activeDragConnection ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
          style={{
            backgroundColor: t.bgCanvas,
            backgroundImage: `radial-gradient(circle, ${t.gridColor} 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Zoom & Pan Stage Layer */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '4000px',
              height: '3000px',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {/* SVG Relationship Connector Lines Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Crow's Foot End Marker */}
                <marker
                  id="crowsfoot-end"
                  viewBox="0 0 20 20"
                  refX="18"
                  refY="10"
                  markerWidth="12"
                  markerHeight="12"
                  orient="auto"
                >
                  <path d="M 0 0 L 20 10 L 0 20 M 12 0 L 12 20" fill="none" stroke={t.edgeConnected} strokeWidth="2" />
                </marker>

                {/* Selected Crow's Foot End Marker */}
                <marker
                  id="crowsfoot-end-selected"
                  viewBox="0 0 20 20"
                  refX="18"
                  refY="10"
                  markerWidth="12"
                  markerHeight="12"
                  orient="auto"
                >
                  <path d="M 0 0 L 20 10 L 0 20 M 12 0 L 12 20" fill="none" stroke={t.edgeSelected} strokeWidth="2.5" />
                </marker>

                {/* Parent One-Side Marker (||) */}
                <marker
                  id="one-side"
                  viewBox="0 0 20 20"
                  refX="2"
                  refY="10"
                  markerWidth="10"
                  markerHeight="10"
                  orient="auto"
                >
                  <path d="M 6 2 L 6 18 M 12 2 L 12 18" fill="none" stroke={theme === 'steel' ? '#06B6D4' : theme === 'light' ? '#2563EB' : '#38BDF8'} strokeWidth="2" />
                </marker>
              </defs>

              {relationships.map((rel) => {
                const srcPos = nodePositions[rel.sourceTable];
                const tgtPos = nodePositions[rel.targetTable];
                if (!srcPos || !tgtPos) return null;

                const { path, x1, y1, x2, y2 } = getConnectorPath(rel, srcPos, tgtPos);
                const isSelected = selectedEdge === rel.id;
                const isConnectedToSelectedTable =
                  selectedTable === rel.sourceTable || selectedTable === rel.targetTable;

                const strokeColor = isSelected
                  ? t.edgeSelected
                  : isConnectedToSelectedTable
                  ? t.edgeConnected
                  : t.edgeDefault;
                const strokeWidth = isSelected ? 3 : isConnectedToSelectedTable ? 2.5 : 1.5;

                return (
                  <g key={rel.id} className="cursor-pointer pointer-events-auto">
                    {/* Hit box for easier edge clicking */}
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdge(rel.id);
                        setSelectedTable(null);
                      }}
                    />

                    {/* Visible Line */}
                    <path
                      d={path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={rel.cardinality === '1:1' ? '4 2' : undefined}
                      markerEnd={
                        notationStyle !== 'crowsfoot'
                          ? undefined
                          : isSelected
                          ? 'url(#crowsfoot-end-selected)'
                          : 'url(#crowsfoot-end)'
                      }
                      markerStart={notationStyle === 'crowsfoot' ? 'url(#one-side)' : undefined}
                      className="transition-colors duration-150"
                    />

                    {/* Relationship Badge Label in Center */}
                    <g
                      transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdge(rel.id);
                        setSelectedTable(null);
                      }}
                    >
                      <rect
                        x="-24"
                        y="-10"
                        width="48"
                        height="20"
                        rx="4"
                        fill={t.edgeBadgeBg}
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill={isSelected ? t.edgeSelected : theme === 'light' ? '#0F172A' : '#E2E8F0'}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {rel.cardinality}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Active Visual Drag Line Connector */}
              {activeDragConnection && (
                <g className="pointer-events-none">
                  {/* Outer Glow Path */}
                  <path
                    d={`M ${activeDragConnection.startX} ${activeDragConnection.startY} C ${
                      activeDragConnection.startX +
                      (activeDragConnection.currentX - activeDragConnection.startX) * 0.5
                    } ${activeDragConnection.startY}, ${
                      activeDragConnection.currentX -
                      (activeDragConnection.currentX - activeDragConnection.startX) * 0.5
                    } ${activeDragConnection.currentY}, ${activeDragConnection.currentX} ${
                      activeDragConnection.currentY
                    }`}
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="6"
                    strokeOpacity="0.4"
                  />
                  {/* Dynamic Core Path */}
                  <path
                    d={`M ${activeDragConnection.startX} ${activeDragConnection.startY} C ${
                      activeDragConnection.startX +
                      (activeDragConnection.currentX - activeDragConnection.startX) * 0.5
                    } ${activeDragConnection.startY}, ${
                      activeDragConnection.currentX -
                      (activeDragConnection.currentX - activeDragConnection.startX) * 0.5
                    } ${activeDragConnection.currentY}, ${activeDragConnection.currentX} ${
                      activeDragConnection.currentY
                    }`}
                    fill="none"
                    stroke="#C084FC"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                  {/* Source Anchor Circle */}
                  <circle
                    cx={activeDragConnection.startX}
                    cy={activeDragConnection.startY}
                    r="5"
                    fill="#A855F7"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  {/* Cursor Follower Target Indicator */}
                  <circle
                    cx={activeDragConnection.currentX}
                    cy={activeDragConnection.currentY}
                    r="7"
                    fill="#E879F9"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {/* Draggable Entity Table Nodes */}
            {tables.map((table) => {
              const pos = nodePositions[table.name] || { x: 50, y: 50, width: 260, height: 200 };
              const isSelected = selectedTable === table.name;
              const isHighlighted =
                searchTerm && table.name.toLowerCase().includes(searchTerm.toLowerCase());
              const isDragSourceTable = activeDragConnection?.sourceTable === table.name;

              return (
                <div
                  key={table.name}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    width: `${pos.width}px`,
                    position: 'absolute',
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, table.name)}
                  onDoubleClick={() => onOpenTableQuery(selectedSchema, table.name)}
                  className={`${t.nodeBg} border rounded-lg shadow-2xl transition-shadow select-none ${
                    isSelected
                      ? theme === 'steel'
                        ? 'border-cyan-500 ring-2 ring-cyan-500/40 z-20'
                        : 'border-purple-500 ring-2 ring-purple-500/40 z-20'
                      : isHighlighted
                      ? 'border-amber-400 ring-1 ring-amber-400/50 z-10'
                      : `${t.nodeBorder} ${t.nodeBorderHover} z-0`
                  }`}
                >
                  {/* PowerDesigner Corner Handle Dots for Selected Node */}
                  {isSelected && (
                    <>
                      <div className={`w-2.5 h-2.5 ${theme === 'steel' ? 'bg-cyan-500' : 'bg-purple-500'} rounded-full absolute -top-1.5 -left-1.5 border border-white`} />
                      <div className={`w-2.5 h-2.5 ${theme === 'steel' ? 'bg-cyan-500' : 'bg-purple-500'} rounded-full absolute -top-1.5 -right-1.5 border border-white`} />
                      <div className={`w-2.5 h-2.5 ${theme === 'steel' ? 'bg-cyan-500' : 'bg-purple-500'} rounded-full absolute -bottom-1.5 -left-1.5 border border-white`} />
                      <div className={`w-2.5 h-2.5 ${theme === 'steel' ? 'bg-cyan-500' : 'bg-purple-500'} rounded-full absolute -bottom-1.5 -right-1.5 border border-white`} />
                    </>
                  )}

                  {/* Header Bar */}
                  <div
                    className={`px-3 py-2 rounded-t-lg border-b flex items-center justify-between cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? t.nodeHeaderSelected
                        : `${t.nodeHeaderBg} ${t.nodeBorder}`
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Layers className={`w-3.5 h-3.5 ${theme === 'steel' ? 'text-cyan-400' : 'text-purple-500'} shrink-0`} />
                      <div>
                        <div className={`text-[9px] font-mono ${theme === 'light' ? 'text-purple-700' : 'text-purple-300'} uppercase tracking-widest leading-none`}>
                          {"<<TABLE>>"}
                        </div>
                        <span className={`font-bold ${theme === 'light' && !isSelected ? 'text-slate-900' : 'text-white'} text-xs font-mono truncate`}>
                          {table.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span className={`px-1.5 py-0.5 text-[9px] font-mono ${t.nodeColumnBg} ${t.textMuted} border ${t.nodeBorder} rounded`}>
                        {table.rowCount} r
                      </span>
                    </div>
                  </div>

                  {/* Column List with Drag-and-Drop Connection Ports */}
                  <div className={`p-1.5 space-y-1 ${t.nodeColumnBg}`}>
                    {table.columns.map((col) => {
                      const isHoveredTargetCol =
                        hoveredTarget?.table === table.name && hoveredTarget?.column === col.name;
                      const isDraggingThisCol =
                        activeDragConnection?.sourceTable === table.name &&
                        activeDragConnection?.sourceColumn === col.name;

                      return (
                        <div
                          key={col.name}
                          onMouseEnter={() => {
                            if (activeDragConnection) {
                              setHoveredTarget({
                                table: table.name,
                                column: col.name,
                                type: col.type,
                              });
                            }
                          }}
                          onMouseLeave={() => {
                            if (hoveredTarget?.table === table.name && hoveredTarget?.column === col.name) {
                              setHoveredTarget(null);
                            }
                          }}
                          className={`group relative flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono transition-all ${
                            isHoveredTargetCol
                              ? 'ring-2 ring-purple-400 bg-purple-950/60 shadow-lg z-10'
                              : isDraggingThisCol
                              ? 'ring-2 ring-purple-500 bg-purple-900/40'
                              : col.isPrimaryKey
                              ? t.nodeColumnPkBg
                              : col.isForeignKey
                              ? t.nodeColumnFkBg
                              : t.nodeColumnDefaultBg
                          }`}
                        >
                          {/* Left Column Port Anchor Handle */}
                          <div
                            onMouseDown={(e) =>
                              handleStartDragConnection(e, table.name, col.name, col.type, 'left')
                            }
                            title={`Drag to connect ${table.name}.${col.name}`}
                            className={`absolute -left-2.5 w-4 h-4 rounded-full flex items-center justify-center cursor-crosshair z-20 transition-all ${
                              isLinkMode
                                ? 'opacity-100 scale-100 bg-purple-600 border border-white text-white shadow'
                                : 'opacity-0 group-hover:opacity-100 bg-purple-600 border border-white text-white shadow'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          <div className="flex items-center space-x-1.5 truncate mr-1">
                            {col.isPrimaryKey ? (
                              <Key className="w-3 h-3 text-amber-500 shrink-0" />
                            ) : col.isForeignKey ? (
                              <Key className={`w-3 h-3 ${theme === 'steel' ? 'text-cyan-400' : 'text-blue-500'} shrink-0`} />
                            ) : (
                              <span className={`w-2.5 h-2.5 rounded-full ${theme === 'light' ? 'bg-slate-300' : 'bg-slate-700'} text-[8px] ${t.textMuted} flex items-center justify-center font-bold shrink-0`}>
                                •
                              </span>
                            )}

                            <span
                              className={`truncate ${
                                col.isPrimaryKey
                                  ? theme === 'light' ? 'text-amber-700 font-bold' : 'text-amber-300 font-bold'
                                  : col.isForeignKey
                                  ? theme === 'light' ? 'text-blue-700 font-semibold' : 'text-blue-300 font-semibold'
                                  : t.textSecondary
                              }`}
                            >
                              {col.name}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0 text-[9px]">
                            {!col.isNullable && (
                              <span className={`px-1 ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300'} rounded font-bold`}>
                                NN
                              </span>
                            )}
                            <span className={`${t.textMuted} font-mono mr-1`}>{col.type}</span>

                            {/* Quick Link Button in Column Row */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalState({
                                  isOpen: true,
                                  sourceTable: table.name,
                                  sourceColumn: col.name,
                                });
                              }}
                              title={`Define Foreign Key for ${table.name}.${col.name}`}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-purple-600/30 text-purple-400 hover:text-purple-200 transition-opacity"
                            >
                              <Link className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          {/* Right Column Port Anchor Handle */}
                          <div
                            onMouseDown={(e) =>
                              handleStartDragConnection(e, table.name, col.name, col.type, 'right')
                            }
                            title={`Drag to connect ${table.name}.${col.name}`}
                            className={`absolute -right-2.5 w-4 h-4 rounded-full flex items-center justify-center cursor-crosshair z-20 transition-all ${
                              isLinkMode
                                ? 'opacity-100 scale-100 bg-purple-600 border border-white text-white shadow'
                                : 'opacity-0 group-hover:opacity-100 bg-purple-600 border border-white text-white shadow'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Foreign Key Connections Indicator Footer */}
                  {table.columns.some((c) => c.isForeignKey) && (
                    <div className={`px-2.5 py-1 ${t.nodeBg} border-t ${t.nodeBorder} text-[10px] ${theme === 'steel' ? 'text-cyan-400' : 'text-blue-500'} font-mono flex items-center justify-between`}>
                      <div className="flex items-center space-x-1 truncate">
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          FK:{' '}
                          {table.columns
                            .filter((c) => c.isForeignKey)
                            .map((c) => c.referencesTable)
                            .join(', ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend Overlay Panel */}
        {showLegend && (
          <div className={`absolute top-4 left-4 ${t.nodeBg} border ${t.nodeBorder} rounded-lg p-3 w-64 shadow-2xl backdrop-blur font-mono text-xs z-30`}>
            <div className={`flex items-center justify-between pb-2 border-b ${t.nodeBorder} mb-2`}>
              <span className={`font-bold ${t.textPrimary} flex items-center space-x-1.5`}>
                <Info className="w-3.5 h-3.5 text-purple-500" />
                <span>{`E/R Diagram Legend (${t.name})`}</span>
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className={`${t.textMuted} hover:${t.textPrimary}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`space-y-2 text-[11px] ${t.textSecondary}`}>
              <div className="flex items-center space-x-2">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Primary Key (PK)</span>
              </div>
              <div className="flex items-center space-x-2">
                <Key className={`w-3.5 h-3.5 ${theme === 'steel' ? 'text-cyan-400' : 'text-blue-500'}`} />
                <span>Foreign Key (FK)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-1 ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300'} rounded font-bold text-[9px]`}>
                  NN
                </span>
                <span>Not Null constraint</span>
              </div>
              <div className={`flex items-center space-x-2 pt-1 border-t ${t.nodeBorder}`}>
                <div className="w-6 h-0.5" style={{ backgroundColor: t.edgeConnected }} />
                <span>Foreign Key Relationship (1 : N)</span>
              </div>
              <div className={`text-[10px] ${t.textMuted} pt-1`}>
                Drag between column ports (●) to visually define new Foreign Key relationships.
              </div>
            </div>
          </div>
        )}

        {/* Floating Toast Notification */}
        {toast && (
          <div
            className={`absolute top-4 right-4 z-40 px-4 py-2.5 rounded-xl border shadow-2xl flex items-center space-x-2.5 font-mono text-xs animate-in slide-in-from-top-2 backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                : 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Floating Canvas Quick Theme Switcher */}
        <div className={`absolute bottom-4 left-4 ${t.nodeBg} border ${t.nodeBorder} rounded-lg p-1.5 shadow-2xl backdrop-blur font-mono text-xs z-30 flex items-center space-x-2`}>
          <div className="flex items-center space-x-1 pl-1 text-[11px] font-bold text-purple-400">
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Theme:</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setTheme('dark')}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-purple-600 text-white shadow ring-1 ring-purple-400'
                  : `${t.toolbarMuted} hover:text-white hover:bg-slate-800`
              }`}
              title="Dark CAD Theme"
            >
              <Moon className="w-3 h-3 text-purple-300" />
              <span>Dark CAD</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-amber-500 text-white shadow ring-1 ring-amber-300'
                  : `${t.toolbarMuted} hover:text-slate-900 hover:bg-slate-200`
              }`}
              title="Light Blueprint Theme"
            >
              <Sun className="w-3 h-3 text-amber-200" />
              <span>Light</span>
            </button>
            <button
              onClick={() => setTheme('steel')}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                theme === 'steel'
                  ? 'bg-cyan-600 text-white shadow ring-1 ring-cyan-300'
                  : `${t.toolbarMuted} hover:text-slate-100 hover:bg-slate-800`
              }`}
              title="Steel Blue Theme"
            >
              <Palette className="w-3 h-3 text-cyan-200" />
              <span>Steel</span>
            </button>
          </div>
        </div>

        {/* Interactive ERD Minimap Overview */}
        <ErdMinimap
          tables={tables}
          nodePositions={nodePositions}
          relationships={relationships}
          pan={pan}
          setPan={setPan}
          zoom={zoom}
          setZoom={setZoom}
          containerRef={containerRef}
          selectedTable={selectedTable}
          onSelectTable={(tableName) => setSelectedTable(tableName)}
          theme={theme}
          isOpen={showMinimap}
          onToggleOpen={() => setShowMinimap(!showMinimap)}
        />
      </div>

      {/* Right Property & Relationship Inspector Drawer */}
      {inspectorOpen && (selectedTableObj || selectedEdgeObj) ? (
        <div className={`w-80 ${t.inspectorBg} border-l ${t.inspectorBorder} flex flex-col z-20 shadow-2xl shrink-0 font-mono`}>
          {/* Inspector Header */}
          <div className={`p-3 ${t.inspectorHeaderBg} border-b ${t.inspectorBorder} flex items-center justify-between`}>
            <div className="flex items-center space-x-2 text-purple-500 font-bold text-xs">
              <Settings className="w-4 h-4" />
              <span>
                {selectedTableObj ? 'Entity Property Inspector' : 'Relationship Inspector'}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedTable(null);
                setSelectedEdge(null);
              }}
              className={`${t.textMuted} hover:${t.textPrimary}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Entity Inspector View */}
          {selectedTableObj && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
              <div>
                <div className={`text-[10px] ${t.textMuted} uppercase`}>Entity Name</div>
                <div className={`text-sm font-bold ${t.textPrimary} mt-0.5 flex items-center space-x-2`}>
                  <Layers className="w-4 h-4 text-purple-500" />
                  <span>{selectedTableObj.name}</span>
                </div>
                <div className={`text-[10px] ${t.textMuted} mt-0.5`}>
                  Schema: {selectedSchema} | {selectedTableObj.rowCount} rows
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => onOpenTableQuery(selectedSchema, selectedTableObj.name)}
                  className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded shadow flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Query Table</span>
                </button>

                <button
                  onClick={() =>
                    setModalState({
                      isOpen: true,
                      sourceTable: selectedTableObj.name,
                    })
                  }
                  className="px-3 py-1.5 bg-[#2D3139] hover:bg-[#3B414D] text-purple-300 font-bold text-xs rounded border border-[#3B414D] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                  title="Add new foreign key relationship from this table"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Link FK</span>
                </button>
              </div>

              {/* Columns Table Breakdown */}
              <div>
                <div className={`text-[10px] ${t.textMuted} uppercase mb-1.5`}>
                  {`Columns (${selectedTableObj.columns.length})`}
                </div>
                <div className={`border ${t.nodeBorder} rounded ${t.nodeColumnBg} overflow-hidden`}>
                  <div className={`divide-y ${t.nodeBorder}`}>
                    {selectedTableObj.columns.map((c) => (
                      <div key={c.name} className={`p-2 space-y-1 hover:${t.nodeHeaderBg}`}>
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-bold ${
                              c.isPrimaryKey
                                ? 'text-amber-500'
                                : c.isForeignKey
                                ? theme === 'steel' ? 'text-cyan-400' : 'text-blue-500'
                                : t.textPrimary
                            }`}
                          >
                            {c.name}
                          </span>
                          <span className={`text-[10px] ${t.textMuted}`}>{c.type}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-[10px] ${t.textMuted}">
                          {c.isPrimaryKey && (
                            <span className="text-amber-500 flex items-center space-x-1">
                              <Key className="w-3 h-3" />
                              <span>PK</span>
                            </span>
                          )}
                          {c.isForeignKey && (
                            <span className={`${theme === 'steel' ? 'text-cyan-400' : 'text-blue-500'} flex items-center space-x-1`}>
                              <Key className="w-3 h-3" />
                              <span>FK ➔ {c.referencesTable}</span>
                            </span>
                          )}
                          {!c.isNullable && <span className={t.textMuted}>NOT NULL</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Foreign Keys List */}
              {selectedTableObj.columns.some((c) => c.isForeignKey) && (
                <div>
                  <div className={`text-[10px] ${t.textMuted} uppercase mb-1.5`}>
                    Foreign Key References
                  </div>
                  <div className="space-y-1.5">
                    {selectedTableObj.columns
                      .filter((c) => c.isForeignKey)
                      .map((c) => (
                        <div
                          key={c.name}
                          className={`p-2 ${t.nodeColumnBg} border ${t.nodeBorder} rounded text-[11px] flex items-center justify-between`}
                        >
                          <div>
                            <div className={`${theme === 'steel' ? 'text-cyan-400' : 'text-blue-500'} font-bold`}>{c.name}</div>
                            <div className={`text-[10px] ${t.textMuted} mt-0.5`}>
                              References ➔ <strong className={t.textPrimary}>{c.referencesTable}</strong> ({c.referencesColumn || 'id'})
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRelationship({
                                id: `fk-${selectedTableObj.name}-${c.name}-${c.referencesTable}`,
                                sourceTable: selectedTableObj.name,
                                sourceColumn: c.name,
                                targetTable: c.referencesTable || '',
                                targetColumn: c.referencesColumn || 'id',
                                cardinality: '1:N',
                              })
                            }
                            title="Drop Foreign Key"
                            className="p-1 rounded text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Relationship Edge Inspector View */}
          {selectedEdgeObj && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
              <div>
                <div className={`text-[10px] ${t.textMuted} uppercase`}>Relationship Constraint</div>
                <div className="text-sm font-bold text-amber-500 mt-0.5 flex items-center space-x-2">
                  <Network className="w-4 h-4" />
                  <span>FK Constraint</span>
                </div>
                <div className={`text-[10px] ${t.textMuted} mt-0.5 font-mono truncate`}>
                  ID: {selectedEdgeObj.id}
                </div>
              </div>

              <div className={`p-3 ${t.nodeColumnBg} border ${t.nodeBorder} rounded space-y-2`}>
                <div>
                  <div className={`text-[10px] ${t.textMuted}`}>Child Entity (Foreign Key)</div>
                  <div className={`${t.textPrimary} font-bold`}>{selectedEdgeObj.sourceTable}.{selectedEdgeObj.sourceColumn}</div>
                </div>

                <div className="flex items-center justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-purple-500" />
                </div>

                <div>
                  <div className={`text-[10px] ${t.textMuted}`}>Parent Entity (Primary Key)</div>
                  <div className="text-emerald-500 font-bold">{selectedEdgeObj.targetTable}.{selectedEdgeObj.targetColumn}</div>
                </div>
              </div>

              <div className={`p-3 ${t.nodeColumnBg} border ${t.nodeBorder} rounded space-y-1`}>
                <div className={`text-[10px] ${t.textMuted}`}>Cardinality</div>
                <div className="text-purple-500 font-bold text-sm">{`${selectedEdgeObj.cardinality} (One-to-Many)`}</div>
                <div className={`text-[10px] ${t.textMuted} pt-1`}>
                  Enforces referential integrity between {selectedEdgeObj.sourceTable} and {selectedEdgeObj.targetTable}.
                </div>
              </div>

              {/* Generated SQL DDL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-[10px] ${t.textMuted} uppercase`}>SQL Definition</div>
                  <button
                    type="button"
                    onClick={() => {
                      const ddl = `ALTER TABLE "${selectedSchema}"."${selectedEdgeObj.sourceTable}"
  ADD CONSTRAINT "fk_${selectedEdgeObj.sourceTable}_${selectedEdgeObj.sourceColumn}"
  FOREIGN KEY ("${selectedEdgeObj.sourceColumn}")
  REFERENCES "${selectedSchema}"."${selectedEdgeObj.targetTable}" ("${selectedEdgeObj.targetColumn}");`;
                      navigator.clipboard.writeText(ddl);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className={`p-2.5 rounded border text-[10px] font-mono overflow-x-auto ${
                  theme === 'light' ? 'bg-slate-900 text-emerald-300 border-slate-800' : 'bg-[#0F1115] text-emerald-400 border-[#2D3139]'
                }`}>
                  {`ALTER TABLE "${selectedSchema}"."${selectedEdgeObj.sourceTable}"
  ADD CONSTRAINT "fk_${selectedEdgeObj.sourceTable}_${selectedEdgeObj.sourceColumn}"
  FOREIGN KEY ("${selectedEdgeObj.sourceColumn}")
  REFERENCES "${selectedSchema}"."${selectedEdgeObj.targetTable}" ("${selectedEdgeObj.targetColumn}");`}
                </pre>
              </div>

              {/* Relationship Actions */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalState({
                      isOpen: true,
                      sourceTable: selectedEdgeObj.sourceTable,
                      sourceColumn: selectedEdgeObj.sourceColumn,
                      targetTable: selectedEdgeObj.targetTable,
                      targetColumn: selectedEdgeObj.targetColumn,
                    })
                  }
                  className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Edit Foreign Key Constraint</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteRelationship(selectedEdgeObj)}
                  className="w-full py-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-bold text-xs rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete Foreign Key</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* New / Edit Relationship Modal Dialog */}
      <NewRelationshipModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false })}
        schemas={schemas}
        activeSchemaName={selectedSchema}
        initialSourceTable={modalState.sourceTable}
        initialSourceColumn={modalState.sourceColumn}
        initialTargetTable={modalState.targetTable}
        initialTargetColumn={modalState.targetColumn}
        onSaveRelationship={handleSaveRelationship}
        onExecuteSql={onExecuteSql}
        theme={theme}
      />
    </div>
  );
};
