
import { MindMapNode, Position, HandlePosition, EdgeType } from '../types';

export const getCenter = (node: MindMapNode): Position => {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const getHandlePosition = (node: MindMapNode, handle: HandlePosition): Position => {
  switch (handle) {
    case 'top': return { x: node.x + node.width / 2, y: node.y };
    case 'right': return { x: node.x + node.width, y: node.y + node.height / 2 };
    case 'bottom': return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left': return { x: node.x, y: node.y + node.height / 2 };
    default: return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  }
};

// Find the closest handle on any node to a given point
export const getNearestHandle = (
  point: Position, 
  nodes: MindMapNode[], 
  excludeNodeId: string, 
  threshold: number = 30
): { nodeId: string; handle: HandlePosition } | null => {
  let closest: { nodeId: string; handle: HandlePosition; dist: number } | null = null;

  for (const node of nodes) {
    if (node.id === excludeNodeId) continue;

    const handles: HandlePosition[] = ['top', 'right', 'bottom', 'left'];
    for (const h of handles) {
      const pos = getHandlePosition(node, h);
      const dist = Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2));
      
      if (dist < threshold) {
        if (!closest || dist < closest.dist) {
          closest = { nodeId: node.id, handle: h, dist };
        }
      }
    }
  }

  return closest ? { nodeId: closest.nodeId, handle: closest.handle } : null;
};

// --- Path Generation Strategies ---

const getStepPath = (start: Position, end: Position, sourceHandle: HandlePosition, targetHandle: HandlePosition): string => {
    // Offset to ensure the line leaves/enters the node cleanly
    const offset = 20;
    
    let pStart = { ...start };
    let pEnd = { ...end };
    
    // Calculate intermediate start point based on source handle
    switch(sourceHandle) {
        case 'top': pStart.y -= offset; break;
        case 'bottom': pStart.y += offset; break;
        case 'left': pStart.x -= offset; break;
        case 'right': pStart.x += offset; break;
    }

    // Calculate intermediate end point based on target handle
    switch(targetHandle) {
        case 'top': pEnd.y -= offset; break;
        case 'bottom': pEnd.y += offset; break;
        case 'left': pEnd.x -= offset; break;
        case 'right': pEnd.x += offset; break;
    }

    let d = `M ${start.x} ${start.y} L ${pStart.x} ${pStart.y}`;
    
    const midX = (pStart.x + pEnd.x) / 2;
    const midY = (pStart.y + pEnd.y) / 2;
    
    const startVertical = sourceHandle === 'top' || sourceHandle === 'bottom';
    const endVertical = targetHandle === 'top' || targetHandle === 'bottom';

    if (startVertical === endVertical) {
        // Handles are parallel (e.g., Top to Bottom, Left to Right, or same side)
        if (startVertical) {
            // Both vertical: Move vertically to midY, then horizontal, then vertical
             // Check if we need to go "around" or if direct midY works
             // For simple logic:
             if ((sourceHandle === 'bottom' && pEnd.y > pStart.y) || (sourceHandle === 'top' && pEnd.y < pStart.y)) {
                 // Direct path possible
                 d += ` L ${pStart.x} ${midY} L ${pEnd.x} ${midY}`;
             } else {
                 // Zigzag might be needed, but simplified step keeps it consistent
                 d += ` L ${pStart.x} ${midY} L ${pEnd.x} ${midY}`;
             }
        } else {
            // Both horizontal
            d += ` L ${midX} ${pStart.y} L ${midX} ${pEnd.y}`;
        }
    } else {
        // Handles are perpendicular (e.g., Right to Bottom)
        if (startVertical) {
             // Start is vertical (Top/Bottom), Target is horizontal (Left/Right)
             // We are at pStart (vertical offset). We want to reach pEnd (horizontal offset).
             // Path: pStart -> (pStart.x, pEnd.y) -> pEnd ? 
             // Or pStart -> (pEnd.x, pStart.y) -> pEnd ?
             
             // Try to find the corner that makes a 90 deg turn.
             // Corner 1: (pStart.x, pEnd.y) -> Matches Target Y, Start X.
             d += ` L ${pStart.x} ${pEnd.y}`;
        } else {
             // Start is horizontal (Left/Right), Target is vertical (Top/Bottom)
             // Corner: (pEnd.x, pStart.y)
             d += ` L ${pEnd.x} ${pStart.y}`;
        }
    }

    // Final connection to target
    d += ` L ${pEnd.x} ${pEnd.y} L ${end.x} ${end.y}`;

    return d;
};

const getPolylinePath = (start: Position, end: Position, breakpoints: Position[]): string => {
    let d = `M ${start.x} ${start.y}`;
    breakpoints.forEach(p => {
        d += ` L ${p.x} ${p.y}`;
    });
    d += ` L ${end.x} ${end.y}`;
    return d;
};

// Calculate a smooth cubic bezier curve
export const getEdgePath = (
  source: MindMapNode, 
  target: MindMapNode, 
  sourceHandle: HandlePosition, 
  targetHandle: HandlePosition,
  manualControlPoint?: Position,
  type: EdgeType = 'bezier',
  breakpoints: Position[] = []
): string => {
  const start = getHandlePosition(source, sourceHandle);
  const end = getHandlePosition(target, targetHandle);

  if (type === 'step') {
      return getStepPath(start, end, sourceHandle, targetHandle);
  }

  if (type === 'straight') {
      return getPolylinePath(start, end, breakpoints);
  }

  // Type: Bezier (Default)
  if (breakpoints.length > 0) {
      // If breakpoints exist, fallback to polyline or simple quadratic if single point
      if (breakpoints.length === 1 && !manualControlPoint) {
         return `M ${start.x} ${start.y} Q ${breakpoints[0].x} ${breakpoints[0].y} ${end.x} ${end.y}`;
      }
      return getPolylinePath(start, end, breakpoints);
  }

  if (manualControlPoint) {
      return `M ${start.x} ${start.y} Q ${manualControlPoint.x} ${manualControlPoint.y} ${end.x} ${end.y}`;
  }

  const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
  const controlOffset = Math.min(dist * 0.5, 100);

  let cp1 = { ...start };
  let cp2 = { ...end };

  switch (sourceHandle) {
    case 'top': cp1.y -= controlOffset; break;
    case 'bottom': cp1.y += controlOffset; break;
    case 'left': cp1.x -= controlOffset; break;
    case 'right': cp1.x += controlOffset; break;
  }

  switch (targetHandle) {
    case 'top': cp2.y -= controlOffset; break;
    case 'bottom': cp2.y += controlOffset; break;
    case 'left': cp2.x -= controlOffset; break;
    case 'right': cp2.x += controlOffset; break;
  }

  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
};

// Calculate the point at t=0.5 for the label position
export const getBezierMidpoint = (
    start: Position, 
    end: Position, 
    sourceHandle: HandlePosition, 
    targetHandle: HandlePosition,
    manualControlPoint?: Position,
    type: EdgeType = 'bezier',
    breakpoints: Position[] = []
): Position => {
    // For Step/Straight, simple average is okay for label
    if (type === 'step') {
        return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }
    
    // Correct logic for single control point (Quadratic Bezier)
    if (breakpoints.length === 1) {
        const t = 0.5;
        const cp = breakpoints[0];
        const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cp.x + t * t * end.x;
        const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cp.y + t * t * end.y;
        return { x, y };
    }

    if (breakpoints.length > 1) {
        const midIdx = Math.floor(breakpoints.length / 2);
        const p1 = breakpoints[midIdx];
        const p2 = breakpoints[midIdx + 1] || end;
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; 
    }

    if (manualControlPoint) {
        const t = 0.5;
        const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * manualControlPoint.x + t * t * end.x;
        const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * manualControlPoint.y + t * t * end.y;
        return { x, y };
    }

    // Cubic Approximation for label
    const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    const controlOffset = Math.min(dist * 0.5, 100);
    
    let cp1 = { ...start };
    let cp2 = { ...end };
    
    if(sourceHandle === 'top') cp1.y -= controlOffset;
    if(sourceHandle === 'bottom') cp1.y += controlOffset;
    if(sourceHandle === 'left') cp1.x -= controlOffset;
    if(sourceHandle === 'right') cp1.x += controlOffset;
    
    if(targetHandle === 'top') cp2.y -= controlOffset;
    if(targetHandle === 'bottom') cp2.y += controlOffset;
    if(targetHandle === 'left') cp2.x -= controlOffset;
    if(targetHandle === 'right') cp2.x += controlOffset;

    const t = 0.5;
    const x = Math.pow(1-t,3)*start.x + 3*Math.pow(1-t,2)*t*cp1.x + 3*(1-t)*t*t*cp2.x + t*t*t*end.x;
    const y = Math.pow(1-t,3)*start.y + 3*Math.pow(1-t,2)*t*cp1.y + 3*(1-t)*t*t*cp2.y + t*t*t*end.y;
    return { x, y };
}

// Calculate angle for arrows
export const getQuadraticAngleAtT = (start: Position, cp: Position, end: Position, t: number): number => {
    const dx = 2 * (1 - t) * (cp.x - start.x) + 2 * t * (end.x - cp.x);
    const dy = 2 * (1 - t) * (cp.y - start.y) + 2 * t * (end.y - cp.y);
    return Math.atan2(dy, dx) * (180 / Math.PI);
};

// Simplified cubic angle at endpoints
export const getCubicAngleAtT = (start: Position, cp1: Position, cp2: Position, end: Position, t: number): number => {
    // Derivative of Cubic Bezier
    const dx = 3 * Math.pow(1 - t, 2) * (cp1.x - start.x) + 
               6 * (1 - t) * t * (cp2.x - cp1.x) + 
               3 * Math.pow(t, 2) * (end.x - cp2.x);
    const dy = 3 * Math.pow(1 - t, 2) * (cp1.y - start.y) + 
               6 * (1 - t) * t * (cp2.y - cp1.y) + 
               3 * Math.pow(t, 2) * (end.y - cp2.y);
    return Math.atan2(dy, dx) * (180 / Math.PI);
}


export const screenToWorld = (screenPos: Position, transform: { x: number; y: number; scale: number }): Position => {
  return {
    x: (screenPos.x - transform.x) / transform.scale,
    y: (screenPos.y - transform.y) / transform.scale,
  };
};
