
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
  transform,
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
            className="pointer-events-auto" 
            onMouseDown={(e) => onSelect(e, edge.id)}
            onDoubleClick={handleDoubleClickLine}
        />

        {/* Visible Path - Removed transition-all to fix drag lag */}
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
                <div className="flex justify-center items-center w-full h-full">
                    <span 
                        className="bg-white/95 px-2 py-0.5 rounded text-xs font-semibold shadow-sm truncate max-w-[120px] border pointer-events-auto cursor-pointer"
                        style={{ color: strokeColor, borderColor: strokeColor }}
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
                        className="hover:scale-125 transition-transform shadow-sm pointer-events-auto"
                    />
                ))}
            </>
        )}
    </g>
  );
};

export const EdgeMenu: React.FC<{
    edge: MindMapEdge;
    position: Position;
    onUpdate: (id: string, updates: Partial<MindMapEdge>) => void;
    onDelete: (id: string) => void;
}> = ({ edge, position, onUpdate, onDelete }) => {
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
            className="absolute z-50 bg-white/95 backdrop-blur shadow-xl border border-gray-200 rounded-xl p-3 flex flex-col gap-3 w-64 animate-in fade-in zoom-in duration-200"
            style={{ 
                left: position.x, 
                top: position.y,
                transform: 'translate(-50%, -100%) translateY(-15px)'
            }}
            onMouseDown={e => e.stopPropagation()} 
        >
             {/* Label Input */}
             <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 border border-gray-100">
                <Type size={14} className="text-gray-400" />
                <input 
                    className="flex-1 text-sm outline-none text-gray-700 bg-transparent py-1.5 placeholder-gray-400"
                    placeholder="Label..."
                    value={labelInput}
                    onChange={(e) => {
                        setLabelInput(e.target.value);
                        onUpdate(edge.id, { label: e.target.value });
                    }}
                />
            </div>

            {/* Line Type Selector */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setType('bezier')}
                    className={`flex-1 flex justify-center py-1 rounded-md text-xs font-medium transition-all ${(!edge.type || edge.type === 'bezier') ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Curve (Bezier)"
                >
                    <Spline size={16} />
                </button>
                <button 
                    onClick={() => setType('straight')}
                    className={`flex-1 flex justify-center py-1 rounded-md text-xs font-medium transition-all ${edge.type === 'straight' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Straight / Polyline"
                >
                    <ArrowUpRight size={16} />
                </button>
                <button 
                    onClick={() => setType('step')}
                    className={`flex-1 flex justify-center py-1 rounded-md text-xs font-medium transition-all ${edge.type === 'step' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Step / Right Angle"
                >
                    <GitCommitHorizontal size={16} />
                </button>
            </div>

            {/* Colors */}
            <div className="flex justify-between items-center">
                 <div className="flex gap-1.5 flex-wrap">
                    {EDGE_COLORS.map(c => (
                        <button
                            key={c}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${edge.color === c ? 'border-gray-400 scale-110' : 'border-transparent hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => onUpdate(edge.id, { color: c })}
                            title={c}
                        />
                    ))}
                 </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2">
                <button 
                    onClick={toggleArrow} 
                    className="flex flex-col items-center justify-center p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors gap-1" 
                    title="Change Arrow Direction"
                >
                    <ArrowLeftRight size={18} />
                    <span className="text-[10px] font-medium">Arrow</span>
                </button>
                <button 
                    onClick={toggleStyle} 
                    className="flex flex-col items-center justify-center p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors gap-1" 
                    title="Change Line Style"
                >
                    <Activity size={18} />
                    <span className="text-[10px] font-medium">Style</span>
                </button>
                <button 
                    onClick={() => onDelete(edge.id)} 
                    className="flex flex-col items-center justify-center p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors gap-1" 
                    title="Disconnect / Delete"
                >
                    <Trash2 size={18} />
                    <span className="text-[10px] font-medium">Delete</span>
                </button>
            </div>
            
            <div className="text-[10px] text-gray-400 text-center px-2">
                Double-click line to add point. Double-click point to remove.
            </div>
        </div>
    );
}
