
import React, { useState, useEffect } from 'react';
import { MindMapEdge, MindMapNode, Position, EDGE_COLORS, EdgeType, ViewportTransform } from '../types';
import { getEdgePath, getHandlePosition, getBezierMidpoint, getQuadraticAngleAtT, getCubicAngleAtT, screenToWorld } from '../utils/geometry';
import { Trash2, Type, ArrowLeftRight, Activity, Spline, ArrowUpRight, GitCommitHorizontal } from 'lucide-react';

interface EdgeComponentProps {
  edge: MindMapEdge;
  sourceNode: MindMapNode;
  targetNode: MindMapNode;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<MindMapEdge>) => void;
  transform: ViewportTransform;
}

export const EdgeComponent: React.FC<EdgeComponentProps> = ({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  transform
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const scale = transform.scale;
  
  // Calculate geometric points
  const start = getHandlePosition(sourceNode, edge.fromHandle);
  const end = getHandlePosition(targetNode, edge.toHandle);
  
  // Backwards compatibility for single control point
  const breakpoints = edge.breakpoints || (edge.controlPoint ? [edge.controlPoint] : []);

  // Midpoint logic for label
  const midPoint = getBezierMidpoint(start, end, edge.fromHandle, edge.toHandle, edge.controlPoint, edge.type, breakpoints);

  // Path Generation
  const pathD = getEdgePath(sourceNode, targetNode, edge.fromHandle, edge.toHandle, edge.controlPoint, edge.type, breakpoints);
  
  const strokeColor = edge.color || '#94a3b8';
  const strokeWidth = isSelected || isHovered ? 3 : 2;
  const strokeDashArray = edge.style === 'dashed' ? '5,5' : edge.style === 'dotted' ? '2,2' : 'none';

  // --- Arrow Logic ---
  const renderArrow = (position: 'start' | 'end') => {
      let angle = 0;
      let pos = { x: 0, y: 0 };
      const arrowType = edge.type || 'bezier';

      if (arrowType === 'step') {
           if (position === 'start') {
               pos = start;
               switch (edge.fromHandle) {
                   case 'top': angle = 90; break;     // Line goes Up, Arrow points Down at node
                   case 'bottom': angle = 270; break; // Line goes Down, Arrow points Up at node
                   case 'left': angle = 0; break;     // Line goes Left, Arrow points Right at node
                   case 'right': angle = 180; break;  // Line goes Right, Arrow points Left at node
               }
           } else {
               pos = end;
               switch (edge.toHandle) {
                   case 'top': angle = 90; break;     // Line enters from Top, Arrow points Down
                   case 'bottom': angle = 270; break; // Line enters from Bottom, Arrow points Up
                   case 'left': angle = 0; break;     // Line enters from Left, Arrow points Right
                   case 'right': angle = 180; break;  // Line enters from Right, Arrow points Left
               }
           }
      } else if (arrowType === 'straight') {
          // Straight / Polyline Logic
          if (position === 'start') {
             const target = breakpoints.length > 0 ? breakpoints[0] : end;
             angle = Math.atan2(target.y - start.y, target.x - start.x) * (180 / Math.PI) + 180;
             pos = start;
          } else {
             const source = breakpoints.length > 0 ? breakpoints[breakpoints.length - 1] : start;
             angle = Math.atan2(end.y - source.y, end.x - source.x) * (180 / Math.PI);
             pos = end;
          }
      } else if (breakpoints.length === 1) {
          // Quadratic Arrow Calculation
          const cp = breakpoints[0];
          if (position === 'start') {
             angle = getQuadraticAngleAtT(start, cp, end, 0) + 180;
             pos = start;
          } else {
             angle = getQuadraticAngleAtT(start, cp, end, 1);
             pos = end;
          }
      } else {
           // Cubic Arrow Calculation (Approximated)
           const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
           const controlOffset = Math.min(dist * 0.5, 100);
           let cp1 = { ...start };
           let cp2 = { ...end };
           
           if(edge.fromHandle === 'top') cp1.y -= controlOffset;
           if(edge.fromHandle === 'bottom') cp1.y += controlOffset;
           if(edge.fromHandle === 'left') cp1.x -= controlOffset;
           if(edge.fromHandle === 'right') cp1.x += controlOffset;
           
           if(edge.toHandle === 'top') cp2.y -= controlOffset;
           if(edge.toHandle === 'bottom') cp2.y += controlOffset;
           if(edge.toHandle === 'left') cp2.x -= controlOffset;
           if(edge.toHandle === 'right') cp2.x += controlOffset;

           if (position === 'start') {
               angle = getCubicAngleAtT(start, cp1, cp2, end, 0) + 180;
               pos = start;
           } else {
               angle = getCubicAngleAtT(start, cp1, cp2, end, 1);
               pos = end;
           }
      }

      return (
        <path
            d="M 0 0 L -10 -5 L -10 5 Z"
            fill={strokeColor}
            transform={`translate(${pos.x}, ${pos.y}) rotate(${angle})`}
            pointerEvents="none"
        />
      );
  };

  const showStartArrow = edge.arrow === 'from' || edge.arrow === 'both';
  const showEndArrow = edge.arrow === 'to' || edge.arrow === 'both' || !edge.arrow; // Default to 'to'

  // --- Event Handlers ---
  const handleMouseDownBreakpoint = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      
      const startX = e.clientX;
      const startY = e.clientY;
      const initialPoint = breakpoints[index];

      const handleMouseMove = (mv: MouseEvent) => {
          const dx = (mv.clientX - startX) / scale;
          const dy = (mv.clientY - startY) / scale;
          
          const newBreakpoints = [...breakpoints];
          newBreakpoints[index] = {
              x: initialPoint.x + dx,
              y: initialPoint.y + dy
          };

          onUpdate(edge.id, { breakpoints: newBreakpoints, controlPoint: undefined });
      };
      
      const handleMouseUp = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClickLine = (e: React.MouseEvent) => {
      e.stopPropagation();
      const worldPos = screenToWorld({ x: e.clientX, y: e.clientY }, transform);
      const newType = edge.type === 'step' ? 'straight' : (edge.type || 'bezier');
      
      onUpdate(edge.id, {
          type: newType,
          breakpoints: [...breakpoints, worldPos],
          controlPoint: undefined 
      });
  };

  const handleDoubleClickBreakpoint = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      const newBreakpoints = breakpoints.filter((_, i) => i !== index);
      onUpdate(edge.id, { breakpoints: newBreakpoints });
  };

  return (
    <g 
        onMouseEnter={() => setIsHovered(true)} 
        onMouseLeave={() => setIsHovered(false)}
        className="group"
    >
        {/* Hit Area */}
        <path
            d={pathD}
            stroke="transparent"
            strokeWidth="20"
            fill="none"
            cursor="pointer"
            style={{ pointerEvents: 'auto' }}
            onMouseDown={(e) => onSelect(e, edge.id)}
            onDoubleClick={handleDoubleClickLine}
        />

        {/* Visible Path */}
        <path
            d={pathD}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDashArray}
            fill="none"
            pointerEvents="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ 
                filter: isSelected ? `drop-shadow(0 0 3px ${strokeColor})` : 'none',
                opacity: isHovered || isSelected ? 1 : 0.8
            }}
        />

        {/* Arrows */}
        {showStartArrow && renderArrow('start')}
        {showEndArrow && renderArrow('end')}

        {/* Label */}
        {edge.label && (
             <foreignObject 
                x={midPoint.x - 60} 
                y={midPoint.y - 14} 
                width="120" 
                height="28"
                style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                    <span 
                        style={{ 
                            backgroundColor: 'rgba(255,255,255,0.95)', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            fontWeight: 600, 
                            color: strokeColor, 
                            borderColor: strokeColor,
                            borderWidth: 1,
                            borderStyle: 'solid',
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '120px'
                        }}
                        onMouseDown={(e) => onSelect(e, edge.id)}
                    >
                        {edge.label}
                    </span>
                </div>
             </foreignObject>
        )}

        {/* Breakpoints / Controls */}
        {isSelected && edge.type !== 'step' && (
            <>
                {breakpoints.map((bp, index) => (
                    <circle
                        key={index}
                        cx={bp.x}
                        cy={bp.y}
                        r={6}
                        fill="white"
                        stroke={strokeColor}
                        strokeWidth={2}
                        cursor="move"
                        onMouseDown={(e) => handleMouseDownBreakpoint(e, index)}
                        onDoubleClick={(e) => handleDoubleClickBreakpoint(e, index)}
                        style={{ pointerEvents: 'auto' }}
                    />
                ))}
            </>
        )}
    </g>
  );
};

export const EdgeMenu: React.FC<{
    edge: MindMapEdge;
    onUpdate: (id: string, updates: Partial<MindMapEdge>) => void;
    onDelete: (id: string) => void;
}> = ({ edge, onUpdate, onDelete }) => {
    const [labelInput, setLabelInput] = useState(edge.label || '');

    useEffect(() => {
        setLabelInput(edge.label || '');
    }, [edge.id, edge.label]);

    const toggleArrow = () => {
        const sequence: MindMapEdge['arrow'][] = ['to', 'both', 'from', 'none'];
        const currentIdx = sequence.indexOf(edge.arrow || 'to');
        onUpdate(edge.id, { arrow: sequence[(currentIdx + 1) % sequence.length] });
    };

    const toggleStyle = () => {
        const styles: MindMapEdge['style'][] = ['solid', 'dashed', 'dotted'];
        const currentIdx = styles.indexOf(edge.style || 'solid');
        onUpdate(edge.id, { style: styles[(currentIdx + 1) % styles.length] });
    };

    const setType = (type: EdgeType) => {
        onUpdate(edge.id, { type });
    };

    return (
        <div 
            className="mindo-edge-menu"
            onMouseDown={e => e.stopPropagation()} 
        >
             {/* Label Input */}
             <div className="mindo-edge-label-input">
                <Type size={14} color="#9ca3af" />
                <input 
                    placeholder="标签..."
                    value={labelInput}
                    onChange={(e) => {
                        setLabelInput(e.target.value);
                        onUpdate(edge.id, { label: e.target.value });
                    }}
                />
            </div>

            {/* Line Type Selector */}
            <div className="mindo-edge-type-group">
                <button 
                    onClick={() => setType('bezier')}
                    className={`mindo-edge-type-btn ${(!edge.type || edge.type === 'bezier') ? 'active' : ''}`}
                    title="曲线"
                >
                    <Spline size={16} />
                </button>
                <button 
                    onClick={() => setType('straight')}
                    className={`mindo-edge-type-btn ${edge.type === 'straight' ? 'active' : ''}`}
                    title="直线"
                >
                    <ArrowUpRight size={16} />
                </button>
                <button 
                    onClick={() => setType('step')}
                    className={`mindo-edge-type-btn ${edge.type === 'step' ? 'active' : ''}`}
                    title="直角/折线"
                >
                    <GitCommitHorizontal size={16} />
                </button>
            </div>

            {/* Colors */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {EDGE_COLORS.map(c => (
                    <button
                        key={c}
                        style={{ 
                            width: '1.25rem', 
                            height: '1.25rem', 
                            borderRadius: '9999px', 
                            border: edge.color === c ? '2px solid #9ca3af' : '2px solid transparent',
                            backgroundColor: c,
                            cursor: 'pointer',
                            transform: edge.color === c ? 'scale(1.1)' : 'scale(1)',
                            transition: 'transform 0.2s',
                            padding: 0
                        }}
                        onClick={() => onUpdate(edge.id, { color: c })}
                        title={c}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="mindo-edge-menu-row">
                <button 
                    onClick={toggleArrow} 
                    className="mindo-edge-action-btn" 
                    title="切换箭头方向"
                >
                    <ArrowLeftRight size={18} />
                    <span style={{ fontSize: '10px', fontWeight: 500 }}>箭头</span>
                </button>
                <button 
                    onClick={toggleStyle} 
                    className="mindo-edge-action-btn" 
                    title="切换线条样式"
                >
                    <Activity size={18} />
                    <span style={{ fontSize: '10px', fontWeight: 500 }}>样式</span>
                </button>
                <button 
                    onClick={() => onDelete(edge.id)} 
                    className="mindo-edge-action-btn delete" 
                    title="删除连接"
                >
                    <Trash2 size={18} />
                    <span style={{ fontSize: '10px', fontWeight: 500 }}>删除</span>
                </button>
            </div>
        </div>
    );
}
