
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MindMapNode, MindMapEdge, ViewportTransform, Position, NodeColor, HandlePosition } from './types';
import { getEdgePath, generateId, screenToWorld, getHandlePosition, getNearestHandle, getCenter, getBezierMidpoint } from './utils/geometry';
import { NodeComponent } from './components/NodeComponent';
import { EdgeComponent, EdgeMenu } from './components/EdgeComponent';
import { Toolbar } from './components/Toolbar';
import { expandIdea } from './services/aiService';
import * as htmlToImage from 'html-to-image';

interface AppProps {
    initialData?: { nodes: MindMapNode[], edges: MindMapEdge[], transform?: ViewportTransform };
    onSave: (data: string) => void;
    fileName: string;
    settings: { aiApiKey: string; aiModel: string };
    onShowMessage?: (message: string) => void;
}

const DEFAULT_INITIAL_NODES: MindMapNode[] = [
  { id: 'root', title: 'Mindo', content: 'Central Topic', x: 0, y: 0, width: 200, height: 100, color: 'yellow' }
];

const App: React.FC<AppProps> = ({ initialData, onSave, fileName, settings, onShowMessage }) => {
  // --- State ---
  const [nodes, setNodes] = useState<MindMapNode[]>(initialData?.nodes || DEFAULT_INITIAL_NODES);
  const [edges, setEdges] = useState<MindMapEdge[]>(initialData?.edges || []);
  const [transform, setTransform] = useState<ViewportTransform>(initialData?.transform || { x: 0, y: 0, scale: 1 });
  
  // Selection
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  
  // Interaction State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggedChildrenIds, setDraggedChildrenIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: Position, end: Position } | null>(null);

  const [connectionStart, setConnectionStart] = useState<{ nodeId: string, handle: HandlePosition } | null>(null); 
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Position | null>(null);
  const [snapPreview, setSnapPreview] = useState<{ nodeId: string, handle: HandlePosition } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Position>({ x: 0, y: 0 }); 
  const itemStartRef = useRef<Position>({ x: 0, y: 0 });
  const hasCentered = useRef(false);
  const rafRef = useRef<number | null>(null); 

  // Dark Mode Detection
  useEffect(() => {
    const checkDarkMode = () => {
        const isDark = document.body.classList.contains('theme-dark');
        setDarkMode(isDark);
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Initial Center if new file
  useEffect(() => {
    if (!initialData && containerRef.current && !hasCentered.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setTransform({
            x: clientWidth / 2 - 100,
            y: clientHeight / 2 - 50,
            scale: 1
        });
        hasCentered.current = true;
    }
  }, [initialData]);

  // Auto Save
  useEffect(() => {
      const data = JSON.stringify({ nodes, edges, transform, version: 1 }, null, 2);
      onSave(data);
  }, [nodes, edges, transform, onSave]);


  // --- Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(transform.scale * (1 + delta), 0.1), 5);

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - transform.x) / transform.scale;
      const worldY = (mouseY - transform.y) / transform.scale;

      const newX = mouseX - worldX * newScale;
      const newY = mouseY - worldY * newScale;

      setTransform({ x: newX, y: newY, scale: newScale });
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button === 0) {
        if (!e.shiftKey) {
            setSelectedNodeIds(new Set());
            setSelectedEdgeId(null);
        }

        if (e.shiftKey) {
            // Start Selection Box
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const startPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                setSelectionBox({ start: startPos, end: startPos });
            }
        } else {
            // Pan
            setIsPanning(true);
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            itemStartRef.current = { x: transform.x, y: transform.y };
        }
    }
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(mousePos, transform);
    const newNode: MindMapNode = {
      id: generateId(),
      title: 'New Node',
      content: '',
      x: worldPos.x - 100,
      y: worldPos.y - 40,
      width: 200,
      height: 80, 
      color: 'blue',
      type: 'node'
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeIds(new Set([newNode.id]));
    setSelectedEdgeId(null);
  };

  const handleCreateGroup = () => {
    if (selectedNodeIds.size === 0) return;

    const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
    if (selectedNodes.length === 0) return;

    // Auto Layout: Grid
    // 1. Sort nodes
    selectedNodes.sort((a, b) => a.y - b.y || a.x - b.x);

    // 2. Arrange in Grid
    const columns = Math.ceil(Math.sqrt(selectedNodes.length));
    const GAP = 20;
    let currentX = 0;
    let currentY = 0;
    let rowMaxHeight = 0;
    
    // Calculate layout origin based on top-left most node
    const minX = Math.min(...selectedNodes.map(n => n.x));
    const minY = Math.min(...selectedNodes.map(n => n.y));
    
    const layoutMap = new Map<string, Position>();

    selectedNodes.forEach((node, index) => {
        if (index > 0 && index % columns === 0) {
            currentX = 0;
            currentY += rowMaxHeight + GAP;
            rowMaxHeight = 0;
        }
        
        layoutMap.set(node.id, { x: minX + currentX, y: minY + currentY });
        
        currentX += node.width + GAP;
        rowMaxHeight = Math.max(rowMaxHeight, node.height);
    });

    // 3. Update nodes with new positions
    let updatedNodes = nodes.map(n => {
        if (layoutMap.has(n.id)) {
            const pos = layoutMap.get(n.id)!;
            return { ...n, x: pos.x, y: pos.y };
        }
        return n;
    });

    // 4. Create Group
    const newGroupId = generateId();
    
    // Calculate bounds of rearranged nodes
    let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
    selectedNodes.forEach(n => {
        const pos = layoutMap.get(n.id)!;
        gMinX = Math.min(gMinX, pos.x);
        gMinY = Math.min(gMinY, pos.y);
        gMaxX = Math.max(gMaxX, pos.x + n.width);
        gMaxY = Math.max(gMaxY, pos.y + n.height);
    });

    const PADDING = 40;
    const TITLE_OFFSET = 40;
    
    const groupNode: MindMapNode = {
        id: newGroupId,
        type: 'group',
        title: 'New Group',
        content: '',
        x: gMinX - PADDING,
        y: gMinY - PADDING - TITLE_OFFSET,
        width: (gMaxX - gMinX) + (PADDING * 2),
        height: (gMaxY - gMinY) + (PADDING * 2) + TITLE_OFFSET,
        color: 'gray'
    };

    updatedNodes = updatedNodes.map(n => {
        if (selectedNodeIds.has(n.id)) {
            return { ...n, parentId: newGroupId };
        }
        return n;
    });

    setNodes([...updatedNodes, groupNode]);
    setSelectedNodeIds(new Set([newGroupId]));
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
        setSelectedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setSelectedEdgeId(null);
    } else {
        if (!selectedNodeIds.has(id)) {
            setSelectedNodeIds(new Set([id]));
        }
        setSelectedEdgeId(null);
    }

    setDraggingNodeId(id);
    
    const node = nodes.find(n => n.id === id);
    if (node) {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialNodesRef.current = nodes; // Snapshot for drag delta

      if (node.type === 'group') {
          const children = nodes.filter(n => n.parentId === id);
          setDraggedChildrenIds(children.map(c => c.id));
      } else {
          setDraggedChildrenIds([]);
      }
    }
  };

  const handleEdgeSelect = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSelectedEdgeId(id);
      setSelectedNodeIds(new Set());
  };

  const handleConnectStart = (e: React.MouseEvent, nodeId: string, handle: HandlePosition) => {
    setConnectionStart({ nodeId, handle });
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
       const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
       const worldPos = screenToWorld(mousePos, transform);
       setTempConnectionEnd(worldPos);
    }
  };

  const handleConnectEnd = (e: React.MouseEvent, targetId: string, targetHandle: HandlePosition) => {
     createConnection(targetId, targetHandle);
  };

  const createConnection = (targetId: string, targetHandle: HandlePosition) => {
    if (connectionStart && connectionStart.nodeId !== targetId) {
        const exists = edges.some(edge => 
          (edge.from === connectionStart.nodeId && edge.to === targetId) ||
          (edge.from === targetId && edge.to === connectionStart.nodeId)
        );
  
        if (!exists) {
          const newEdge: MindMapEdge = {
              id: generateId(),
              from: connectionStart.nodeId,
              to: targetId,
              fromHandle: connectionStart.handle,
              toHandle: targetHandle,
              style: 'solid',
              arrow: 'to',
              color: darkMode ? '#a3a3a3' : '#94a3b8'
          };
          setEdges(prev => [...prev, newEdge]);
        }
      }
      setConnectionStart(null);
      setTempConnectionEnd(null);
      setSnapPreview(null);
  };

  const initialNodesRef = useRef<MindMapNode[]>([]);
  useEffect(() => {
      // Logic handled in mousedown now
  }, [draggingNodeId]); 

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
       if (rafRef.current) return;

       const clientX = e.clientX;
       const clientY = e.clientY;

       rafRef.current = requestAnimationFrame(() => {
           // Selection Box
           if (selectionBox) {
               const rect = containerRef.current?.getBoundingClientRect();
               if (rect) {
                   setSelectionBox(prev => prev ? ({ ...prev, end: { x: clientX - rect.left, y: clientY - rect.top } }) : null);
               }
           }
           // Dragging Nodes
           else if (draggingNodeId && initialNodesRef.current.length > 0) {
              const dx = (clientX - dragStartRef.current.x) / transform.scale;
              const dy = (clientY - dragStartRef.current.y) / transform.scale;

              // Move all selected nodes if dragging one of them
              const isDraggingSelection = selectedNodeIds.has(draggingNodeId);
              const nodesToMove = isDraggingSelection ? Array.from(selectedNodeIds) : [draggingNodeId];
              
              setNodes(prev => prev.map(n => {
                  if (nodesToMove.includes(n.id)) {
                      const start = initialNodesRef.current.find(sn => sn.id === n.id);
                      if (start) return { ...n, x: start.x + dx, y: start.y + dy };
                  }
                  // Move children of groups if group is moved
                  const parentInSelection = nodesToMove.includes(n.parentId || '');
                  if (parentInSelection) {
                       const start = initialNodesRef.current.find(sn => sn.id === n.id);
                       if (start) return { ...n, x: start.x + dx, y: start.y + dy };
                  }
                  
                  return n;
              }));
           } 
           // Panning
           else if (isPanning) {
               const dx = clientX - dragStartRef.current.x;
               const dy = clientY - dragStartRef.current.y;
               setTransform(prev => ({
                 ...prev,
                 x: itemStartRef.current.x + dx,
                 y: itemStartRef.current.y + dy
               }));
           } 
           // Connection Line
           else if (connectionStart && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const mousePos = { x: clientX - rect.left, y: clientY - rect.top };
              const worldPos = screenToWorld(mousePos, transform);
              setTempConnectionEnd(worldPos);

              const nearest = getNearestHandle(worldPos, nodes, connectionStart.nodeId, 50);
              if (nearest) {
                  setSnapPreview(nearest);
              } else {
                  setSnapPreview(null);
              }
           }
           rafRef.current = null;
       });

  }, [draggingNodeId, draggedChildrenIds, isPanning, connectionStart, transform, nodes, selectionBox, selectedNodeIds]);

  const handleMouseUp = useCallback(() => {
    if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }

    // Finish Selection Box
    if (selectionBox) {
        const x1 = Math.min(selectionBox.start.x, selectionBox.end.x);
        const y1 = Math.min(selectionBox.start.y, selectionBox.end.y);
        const x2 = Math.max(selectionBox.start.x, selectionBox.end.x);
        const y2 = Math.max(selectionBox.start.y, selectionBox.end.y);

        const p1 = screenToWorld({x: x1, y: y1}, transform);
        const p2 = screenToWorld({x: x2, y: y2}, transform);
        
        const minWX = Math.min(p1.x, p2.x);
        const minWY = Math.min(p1.y, p2.y);
        const maxWX = Math.max(p1.x, p2.x);
        const maxWY = Math.max(p1.y, p2.y);

        const selected = new Set<string>();
        nodes.forEach(n => {
            if (n.x >= minWX && n.x + n.width <= maxWX && n.y >= minWY && n.y + n.height <= maxWY) {
                selected.add(n.id);
            }
        });
        
        if (selected.size > 0) {
            setSelectedNodeIds(selected);
        }
        setSelectionBox(null);
    }

    if (connectionStart && snapPreview) {
        createConnection(snapPreview.nodeId, snapPreview.handle);
    }

    if (draggingNodeId) {
        setNodes(prev => {
            const isDraggingSelection = selectedNodeIds.has(draggingNodeId);
            const nodesToCheck = isDraggingSelection ? Array.from(selectedNodeIds) : [draggingNodeId];
            
            let current = prev;
            if (nodesToCheck.length === 1) {
                 current = updateParentIds(current, nodesToCheck[0]);
            }
            return recalculateGroupBounds(current);
        });
    }

    setIsPanning(false);
    setDraggingNodeId(null);
    setDraggedChildrenIds([]);
    setConnectionStart(null);
    setTempConnectionEnd(null);
    setSnapPreview(null);
  }, [connectionStart, snapPreview, edges, draggingNodeId, selectionBox, transform, nodes, selectedNodeIds]); 

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleGlobalMouseMove, handleMouseUp]);


  // --- Logic Helpers ---
  const updateParentIds = (currentNodes: MindMapNode[], specificNodeId?: string): MindMapNode[] => {
      return currentNodes.map(node => {
          if (node.type === 'group') return node; 
          if (specificNodeId && node.id !== specificNodeId) return node;

          const center = getCenter(node);
          const targetGroup = currentNodes.find(g => 
              g.type === 'group' && 
              g.id !== node.id && 
              center.x >= g.x && center.x <= g.x + g.width &&
              center.y >= g.y && center.y <= g.y + g.height
          );

          if (targetGroup) {
              return { ...node, parentId: targetGroup.id };
          } else {
              return { ...node, parentId: undefined };
          }
      });
  };

  const recalculateGroupBounds = (currentNodes: MindMapNode[]): MindMapNode[] => {
    return currentNodes.map(node => {
        if (node.type === 'group') {
            const children = currentNodes.filter(n => n.parentId === node.id);
            if (children.length === 0) return node; 

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            children.forEach(child => {
                minX = Math.min(minX, child.x);
                minY = Math.min(minY, child.y);
                maxX = Math.max(maxX, child.x + child.width);
                maxY = Math.max(maxY, child.y + child.height);
            });

            const PADDING = 30;
            const TITLE_OFFSET = 40;

            const newX = minX - PADDING;
            const newY = minY - PADDING - TITLE_OFFSET;
            const newWidth = (maxX - minX) + (PADDING * 2);
            const newHeight = (maxY - minY) + (PADDING * 2) + TITLE_OFFSET;
            
            if (Math.abs(newX - node.x) < 1 && Math.abs(newWidth - node.width) < 1 && Math.abs(newHeight - node.height) < 1) {
                return node;
            }

            return {
                ...node,
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight
            };
        }
        return node;
    });
  };

  const updateNodeData = (id: string, title: string, content: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, title, content } : n));
  };
  
  const updateNodeResize = (id: string, width: number, height: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, width, height } : n));
  };

  const updateNodeColor = (id: string, color: NodeColor) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, color } : n));
  };

  const updateEdge = (id: string, updates: Partial<MindMapEdge>) => {
      setEdges(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(edge => edge.from !== id && edge.to !== id));
    if (selectedNodeIds.has(id)) {
        const next = new Set(selectedNodeIds);
        next.delete(id);
        setSelectedNodeIds(next);
    }
  };
  
  const deleteSelected = () => {
      if (selectedNodeIds.size > 0) {
          setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
          setEdges(prev => prev.filter(e => !selectedNodeIds.has(e.from) && !selectedNodeIds.has(e.to)));
          setSelectedNodeIds(new Set());
      }
      if (selectedEdgeId) {
          setEdges(prev => prev.filter(e => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
      }
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
              deleteSelected();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, selectedEdgeId]);

  const handleAiExpand = async () => {
    if (selectedNodeIds.size !== 1 || isAiLoading) return;
    const selectedId = Array.from(selectedNodeIds)[0];
    
    const node = nodes.find(n => n.id === selectedId);
    if (!node || !node.title.trim()) {
      return;
    }

    if (!settings.aiApiKey) {
        if (onShowMessage) {
            onShowMessage("Please set your Gemini API Key in the Mindo settings first.");
        } else {
            alert("Please set your Gemini API Key in the Mindo settings first.");
        }
        return;
    }

    setIsAiLoading(true);
    try {
      const suggestions = await expandIdea(node.title, settings.aiApiKey, settings.aiModel);
      
      const newNodes: MindMapNode[] = [];
      const newEdges: MindMapEdge[] = [];
      const radius = 350; 
      
      suggestions.forEach((text, index) => {
        const fanAngle = (index - (suggestions.length - 1) / 2) * (Math.PI / 4); 

        const newNodeId = generateId();
        newNodes.push({
          id: newNodeId,
          type: 'node',
          title: text,
          content: '',
          x: node.x + radius * Math.cos(fanAngle) + 100, 
          y: node.y + radius * Math.sin(fanAngle),
          width: 200,
          height: 80, 
          color: node.color === 'gray' ? 'blue' : node.color,
          parentId: node.id
        });

        newEdges.push({
          id: generateId(),
          from: node.id,
          to: newNodeId,
          fromHandle: 'right',
          toHandle: 'left',
          style: 'solid',
          arrow: 'to',
          color: darkMode ? '#a3a3a3' : '#94a3b8'
        });
      });

      setNodes(prev => [...prev, ...newNodes]);
      setEdges(prev => [...prev, ...newEdges]);
    } catch (e) {
      console.error(e);
      if (onShowMessage) {
          onShowMessage("AI generation failed. Check console for details.");
      } else {
          alert("AI generation failed. Check console for details.");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExportImage = useCallback(async () => {
    if (canvasContentRef.current === null) {
      return;
    }
    try {
        const dataUrl = await htmlToImage.toPng(canvasContentRef.current, {
            backgroundColor: darkMode ? '#111827' : '#ffffff',
        });
        const link = document.createElement('a');
        link.download = `${fileName || 'mindmap'}.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Export failed', err);
    }
  }, [darkMode, fileName]);

  const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type === 'group' && b.type !== 'group') return -1;
      if (a.type !== 'group' && b.type === 'group') return 1;
      return 0;
  });
  
  const selectedEdgeObj = edges.find(e => e.id === selectedEdgeId);
  const edgeMenuPos: Position | null = selectedEdgeObj && selectedEdgeId ? (() => {
      const source = nodes.find(n => n.id === selectedEdgeObj.from);
      const target = nodes.find(n => n.id === selectedEdgeObj.to);
      if(!source || !target) return null;
      
      const s = getHandlePosition(source, selectedEdgeObj.fromHandle);
      const e = getHandlePosition(target, selectedEdgeObj.toHandle);
      const breakpoints = selectedEdgeObj.breakpoints || (selectedEdgeObj.controlPoint ? [selectedEdgeObj.controlPoint] : []);
      const mid = getBezierMidpoint(s, e, selectedEdgeObj.fromHandle, selectedEdgeObj.toHandle, selectedEdgeObj.controlPoint, selectedEdgeObj.type, breakpoints);
      
      return {
          x: mid.x * transform.scale + transform.x,
          y: mid.y * transform.scale + transform.y
      };
  })() : null;

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full overflow-hidden relative font-sans select-none ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}
      onWheel={handleWheel}
      style={{ isolation: 'isolate' }}
    >
      <div 
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `radial-gradient(${darkMode ? '#fff' : '#000'} 1px, transparent 1px)`,
          backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`
        }}
      />

      <div 
        className="w-full h-full absolute top-0 left-0 outline-none"
        onMouseDown={handleMouseDownCanvas}
        onDoubleClick={handleDoubleClickCanvas}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        <div 
          ref={canvasContentRef}
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: '100%', 
            height: '100%',
            position: 'relative'
          }}
          className="relative w-full h-full"
        >
          <svg className="overflow-visible absolute top-0 left-0 pointer-events-none w-1 h-1 z-0">
            {edges.map(edge => {
              const source = nodes.find(n => n.id === edge.from);
              const target = nodes.find(n => n.id === edge.to);
              if (!source || !target) return null;
              
              return (
                <EdgeComponent
                  key={edge.id}
                  edge={edge}
                  sourceNode={source}
                  targetNode={target}
                  isSelected={selectedEdgeId === edge.id}
                  onSelect={handleEdgeSelect}
                  onDelete={() => setEdges(prev => prev.filter(e => e.id !== edge.id))}
                  onUpdate={updateEdge}
                  transform={transform}
                />
              );
            })}
            
            {connectionStart && tempConnectionEnd && (
                <>
                <path
                    d={(() => {
                        const source = nodes.find(n => n.id === connectionStart.nodeId);
                        if (!source) return '';
                        const start = getHandlePosition(source, connectionStart.handle);
                        const end = snapPreview 
                            ? getHandlePosition(nodes.find(n => n.id === snapPreview.nodeId)!, snapPreview.handle)
                            : tempConnectionEnd;
                        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
                    })()}
                    stroke={snapPreview ? "#10b981" : "#3b82f6"} 
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    className="opacity-60 transition-colors"
                />
                </>
            )}
          </svg>

          {sortedNodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              scale={transform.scale}
              isSelected={selectedNodeIds.has(node.id)}
              isDragging={draggingNodeId === node.id || (selectedNodeIds.has(node.id) && !!draggingNodeId)}
              onMouseDown={handleNodeMouseDown}
              onMouseUp={handleMouseUp}
              onConnectStart={handleConnectStart}
              onConnectEnd={handleConnectEnd}
              onUpdate={updateNodeData}
              onResize={updateNodeResize}
              onDelete={deleteNode}
              onColorChange={updateNodeColor}
            />
          ))}

          {/* Selection Box */}
          {selectionBox && (
              <div 
                  className="absolute bg-blue-500/20 border border-blue-500/50 pointer-events-none z-50"
                  style={{
                      left: Math.min(selectionBox.start.x, selectionBox.end.x) / transform.scale - transform.x / transform.scale,
                      top: Math.min(selectionBox.start.y, selectionBox.end.y) / transform.scale - transform.y / transform.scale,
                      width: Math.abs(selectionBox.end.x - selectionBox.start.x) / transform.scale,
                      height: Math.abs(selectionBox.end.y - selectionBox.start.y) / transform.scale
                  }}
              />
          )}
        </div>
      </div>
      
      {/* Edge Context Menu */}
      {selectedEdgeId && selectedEdgeObj && edgeMenuPos && (
          <EdgeMenu 
              edge={selectedEdgeObj} 
              position={edgeMenuPos} 
              onUpdate={updateEdge}
              onDelete={() => setEdges(prev => prev.filter(e => e.id !== selectedEdgeObj.id))}
          />
      )}

      <Toolbar
        scale={transform.scale}
        onZoomIn={() => setTransform(t => ({ ...t, scale: Math.min(t.scale + 0.2, 5) }))}
        onZoomOut={() => setTransform(t => ({ ...t, scale: Math.max(t.scale - 0.2, 0.1) }))}
        onFitView={() => {
            if (containerRef.current) {
                setTransform({ 
                    x: containerRef.current.clientWidth/2 - (nodes[0]?.x || 0), 
                    y: containerRef.current.clientHeight/2 - (nodes[0]?.y || 0), 
                    scale: 1 
                });
            }
        }}
        onReset={() => { 
            // setNodes(INITIAL_NODES); 
            // setEdges([]); 
            // Reset logic for file based approach? Just reset view transform?
            if (containerRef.current) {
                 setTransform({ x: containerRef.current.clientWidth/2 - 100, y: containerRef.current.clientHeight/2 - 50, scale: 1 });
            }
        }}
        onAiExpand={handleAiExpand}
        onAddGroup={handleCreateGroup}
        onExportImage={handleExportImage}
        isAiLoading={isAiLoading}
        canGroup={selectedNodeIds.size > 1}
      />
    </div>
  );
};

export default App;
