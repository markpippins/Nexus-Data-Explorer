import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Map, Minimize2, LocateFixed } from 'lucide-react';
import { TableObject } from '../../types/database';

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RelationshipEdge {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  cardinality: '1:1' | '1:N' | 'N:M';
}

interface ErdMinimapProps {
  tables: TableObject[];
  nodePositions: Record<string, NodePosition>;
  relationships: RelationshipEdge[];
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  theme: 'dark' | 'light' | 'steel';
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ErdMinimap: React.FC<ErdMinimapProps> = ({
  tables,
  nodePositions,
  relationships,
  pan,
  setPan,
  zoom,
  setZoom,
  containerRef,
  selectedTable,
  onSelectTable,
  theme,
  isOpen,
  onToggleOpen,
}) => {
  const minimapRef = useRef<HTMLDivElement>(null);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);

  // Compute bounding box of all tables on stage
  const getBounds = useCallback(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    tables.forEach((table) => {
      const pos = nodePositions[table.name];
      if (!pos) return;
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + pos.width > maxX) maxX = pos.x + pos.width;
      if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
    });

    if (!isFinite(minX) || !isFinite(minY)) {
      minX = 0;
      minY = 0;
      maxX = 1200;
      maxY = 800;
    }

    const padding = 120;
    const cropX = minX - padding;
    const cropY = minY - padding;
    const width = Math.max(800, maxX - cropX + padding);
    const height = Math.max(600, maxY - cropY + padding);

    return { minX: cropX, minY: cropY, width, height };
  }, [tables, nodePositions]);

  const { minX, minY, width: boundsW, height: boundsH } = getBounds();

  const MINIMAP_WIDTH = 220;
  const MINIMAP_HEIGHT = Math.max(120, Math.min(180, Math.round(MINIMAP_WIDTH * (boundsH / boundsW))));

  const scaleX = MINIMAP_WIDTH / boundsW;
  const scaleY = MINIMAP_HEIGHT / boundsH;
  const scale = Math.min(scaleX, scaleY);

  // Get viewport dimensions in stage coordinates
  const containerWidth = containerRef.current?.clientWidth || 1000;
  const containerHeight = containerRef.current?.clientHeight || 700;

  const vpStageX = -pan.x / zoom;
  const vpStageY = -pan.y / zoom;
  const vpStageW = containerWidth / zoom;
  const vpStageH = containerHeight / zoom;

  // Map stage coords to minimap pixel coords
  const miniVpX = Math.max(0, (vpStageX - minX) * scale);
  const miniVpY = Math.max(0, (vpStageY - minY) * scale);
  const miniVpW = Math.min(MINIMAP_WIDTH, vpStageW * scale);
  const miniVpH = Math.min(MINIMAP_HEIGHT, vpStageH * scale);

  // Jump or drag pan based on minimap coordinates
  const updatePanFromMinimap = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const mouseY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    // Convert mouse position on minimap to stage coordinates
    const targetStageX = minX + mouseX / scale;
    const targetStageY = minY + mouseY / scale;

    // Center viewport at targetStage position
    const newPanX = containerWidth / 2 - targetStageX * zoom;
    const newPanY = containerHeight / 2 - targetStageY * zoom;

    setPan({ x: newPanX, y: newPanY });
  }, [minX, minY, scale, containerWidth, containerHeight, zoom, setPan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingViewport(true);
    updatePanFromMinimap(e);
  };

  useEffect(() => {
    if (!isDraggingViewport) return;

    const handleMouseMove = (e: MouseEvent) => {
      updatePanFromMinimap(e);
    };

    const handleMouseUp = () => {
      setIsDraggingViewport(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingViewport, updatePanFromMinimap]);

  // Fit all tables neatly in viewport
  const handleFitAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tables.length === 0) return;

    const fitPadding = 80;
    const requiredW = boundsW - 240 + fitPadding * 2;
    const requiredH = boundsH - 240 + fitPadding * 2;

    const zoomX = containerWidth / requiredW;
    const zoomY = containerHeight / requiredH;
    const newZoom = Math.min(1.2, Math.max(0.3, Math.min(zoomX, zoomY)));

    const stageCenterX = minX + 120 + (boundsW - 240) / 2;
    const stageCenterY = minY + 120 + (boundsH - 240) / 2;

    const newPanX = containerWidth / 2 - stageCenterX * newZoom;
    const newPanY = containerHeight / 2 - stageCenterY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className={`absolute bottom-4 right-4 z-30 px-3 py-2 ${
          theme === 'light'
            ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-lg'
            : theme === 'steel'
            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300 shadow-2xl'
            : 'bg-[#181A1F] hover:bg-[#252830] border-[#2D3139] text-purple-300 shadow-2xl'
        } border rounded-lg font-mono text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer group`}
        title="Open ERD Minimap"
      >
        <Map className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
        <span>Minimap</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-400'}`}>
          {tables.length} tables
        </span>
      </button>
    );
  }

  const isLight = theme === 'light';
  const isSteel = theme === 'steel';

  const cardBg = isLight ? 'bg-white/95 border-slate-300' : isSteel ? 'bg-[#1E293B]/95 border-slate-700' : 'bg-[#181A1F]/95 border-[#2D3139]';
  const headerBg = isLight ? 'bg-slate-100 border-slate-200' : isSteel ? 'bg-[#334155] border-slate-700' : 'bg-[#1E232A] border-[#2D3139]';

  return (
    <div className={`absolute bottom-4 right-4 z-30 ${cardBg} border rounded-xl shadow-2xl overflow-hidden backdrop-blur-md font-mono select-none transition-all w-[236px]`}>
      {/* Header */}
      <div className={`px-2.5 py-1.5 ${headerBg} border-b flex items-center justify-between`}>
        <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-400">
          <Map className="w-3.5 h-3.5 text-purple-400" />
          <span>Minimap Overview</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleFitAll}
            className={`p-1 rounded ${isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-700 text-slate-300'} transition-colors`}
            title="Fit Diagram to Screen"
          >
            <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            onClick={onToggleOpen}
            className={`p-1 rounded ${isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-700 text-slate-300'} transition-colors`}
            title="Minimize Overview"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Thumbnail Area */}
      <div
        ref={minimapRef}
        onMouseDown={handleMouseDown}
        className="relative cursor-crosshair overflow-hidden"
        style={{
          width: `${MINIMAP_WIDTH}px`,
          height: `${MINIMAP_HEIGHT}px`,
          margin: '8px auto',
          backgroundColor: isLight ? '#F8FAFC' : isSteel ? '#0F172A' : '#0B0D10',
          borderRadius: '6px',
          border: isLight ? '1px solid #E2E8F0' : '1px solid #2D3139',
        }}
      >
        {/* Render SVG Mini Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {relationships.map((rel) => {
            const srcPos = nodePositions[rel.sourceTable];
            const tgtPos = nodePositions[rel.targetTable];
            if (!srcPos || !tgtPos) return null;

            const x1 = (srcPos.x + srcPos.width / 2 - minX) * scale;
            const y1 = (srcPos.y + srcPos.height / 2 - minY) * scale;
            const x2 = (tgtPos.x + tgtPos.width / 2 - minX) * scale;
            const y2 = (tgtPos.y + tgtPos.height / 2 - minY) * scale;

            const isSelected = selectedTable === rel.sourceTable || selectedTable === rel.targetTable;

            return (
              <line
                key={`mini-${rel.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isSelected ? '#F59E0B' : isSteel ? '#06B6D4' : isLight ? '#94A3B8' : '#475569'}
                strokeWidth={isSelected ? 1.5 : 0.8}
                opacity={0.6}
              />
            );
          })}
        </svg>

        {/* Render Mini Node Rectangles */}
        {tables.map((table) => {
          const pos = nodePositions[table.name];
          if (!pos) return null;

          const mx = (pos.x - minX) * scale;
          const my = (pos.y - minY) * scale;
          const mw = Math.max(8, pos.width * scale);
          const mh = Math.max(6, pos.height * scale);

          const isSelected = selectedTable === table.name;

          return (
            <div
              key={`mini-node-${table.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable(table.name);
                // Center on selected node
                const targetStageX = pos.x + pos.width / 2;
                const targetStageY = pos.y + pos.height / 2;
                setPan({
                  x: containerWidth / 2 - targetStageX * zoom,
                  y: containerHeight / 2 - targetStageY * zoom,
                });
              }}
              title={`${table.name} (${table.columns.length} cols)`}
              className="absolute rounded-[2px] transition-all cursor-pointer hover:ring-2 hover:ring-purple-400 z-10"
              style={{
                left: `${mx}px`,
                top: `${my}px`,
                width: `${mw}px`,
                height: `${mh}px`,
                backgroundColor: isSelected
                  ? '#A855F7'
                  : isLight
                  ? '#CBD5E1'
                  : isSteel
                  ? '#334155'
                  : '#2D3139',
                border: isSelected
                  ? '1px solid #F59E0B'
                  : isLight
                  ? '1px solid #94A3B8'
                  : '1px solid #4B5563',
              }}
            />
          );
        })}

        {/* Viewport Box Indicator */}
        <div
          className="absolute border-2 border-purple-500 bg-purple-500/20 rounded-[3px] pointer-events-none transition-transform z-20"
          style={{
            left: `${miniVpX}px`,
            top: `${miniVpY}px`,
            width: `${miniVpW}px`,
            height: `${miniVpH}px`,
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
          }}
        />
      </div>

      {/* Footer Info */}
      <div className={`px-2.5 py-1 ${headerBg} border-t flex items-center justify-between text-[10px] text-slate-400`}>
        <span>Drag viewport to pan</span>
        <span className="font-bold text-purple-400">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
};
