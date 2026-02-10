import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MindMapNode, MindMapEdge, ViewportTransform, Position, HandlePosition, MindoSettings, NodeColor } from './types';
import { generateId, screenToWorld, getHandlePosition, getNearestHandle, getCenter, getBezierMidpoint } from './utils/geometry';
import { NodeComponent } from './components/NodeComponent';
import { EdgeComponent, EdgeMenu, EdgeLabel } from './components/EdgeComponent';
import { Toolbar } from './components/Toolbar';
import { expandIdea, AiResult } from './services/aiService';
import { generateMarkdown } from './utils/markdownExport';
import * as htmlToImage from 'html-to-image';
import './styles.css';

interface AppProps {
    initialData?: { nodes: MindMapNode[], edges: MindMapEdge[], transform?: ViewportTransform };
    onSave: (data: string) => void;
    fileName: string;
    settings: MindoSettings;
    onShowMessage?: (message: string) => void;
    onRenderMarkdown?: (content: string, el: HTMLElement) => void;
    onSaveAsset?: (file: File) => Promise<string>; // Returns vault path
    onResolveResource?: (path: string) => string; // Returns displayable URL
    onSaveMarkdown?: (filename: string, content: string) => void;
}

const DEFAULT_INITIAL_NODES: MindMapNode[] = [
  { id: 'root', title: 'Mindo', content: '中心主题', x: 0, y: 0, width: 150, height: 100, color: 'yellow' }
];

interface HistoryState {
    nodes: MindMapNode[];
    edges: MindMapEdge[];
}

const App: React.FC<AppProps> = ({ 
    initialData, 
    onSave, 
    fileName, 
    settings, 
    onShowMessage, 
    onRenderMarkdown,
    onSaveAsset,
    onResolveResource,
    onSaveMarkdown
}) => {
  // --- State ---
  const [nodes, setNodes] = useState<MindMapNode[]>(initialData?.nodes || DEFAULT_INITIAL_NODES);
  const [edges, setEdges] = useState<MindMapEdge[]>(initialData?.edges || []);
  const [transform, setTransform] = useState<ViewportTransform>(initialData?.transform || { x: 0, y: 0, scale: 1 });
  
  // History State
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

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

  // Reconnection State
  const [reconnectingEdge, setReconnectingEdge] = useState<{ edgeId: string, which: 'from' | 'to' } | null>(null);

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
  const initialNodesRef = useRef<MindMapNode[]>([]);
  
  // State Refs for Event Handlers (Prevent Stale Closures without re-binding)
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const transformRef = useRef(transform);
  transformRef.current = transform;

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  const draggingNodeIdRef = useRef(draggingNodeId);
  draggingNodeIdRef.current = draggingNodeId;

  const connectionStartRef = useRef(connectionStart);
  connectionStartRef.current = connectionStart;
  
  const reconnectingEdgeRef = useRef(reconnectingEdge);
  reconnectingEdgeRef.current = reconnectingEdge;

  const isPanningRef = useRef(isPanning);
  isPanningRef.current = isPanning;

  const selectionBoxRef = useRef(selectionBox);
  selectionBoxRef.current = selectionBox;
  
  // Data Sync Refs
  const lastSavedData = useRef<string>("");

  // Handler Refs (defined early to be available in callbacks)
  const snapPreviewRef = useRef(snapPreview);
  snapPreviewRef.current = snapPreview;

  const mouseMoveHandlerRef = useRef<(e: MouseEvent) => void>(() => {});
  const mouseUpHandlerRef = useRef<() => void>(() => {});

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

  // Sync with Prop Updates & Resolve Asset Paths
  useEffect(() => {
    if (initialData) {
        let loadedNodes = initialData.nodes || DEFAULT_INITIAL_NODES;

        // Resolve asset paths to display URLs
        if (onResolveResource) {
            loadedNodes = loadedNodes.map(node => {
                if (node.type === 'image' && node.assetPath) {
                    return { ...node, imageUrl: onResolveResource(node.assetPath) };
                }
                return node;
            });
        }

        const incomingData = {
            nodes: loadedNodes,
            edges: initialData.edges || [],
            transform: initialData.transform || { x: 0, y: 0, scale: 1 },
            version: 1
        };
        const incomingString = JSON.stringify(incomingData, null, 2);

        setNodes(incomingData.nodes);
        setEdges(incomingData.edges);
        setTransform(incomingData.transform);
    }
  }, [initialData, onResolveResource]);

  // Initial Center
  useEffect(() => {
    if ((!initialData || !initialData.nodes) && containerRef.current && !hasCentered.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setTransform({
            x: clientWidth / 2 - 150, // Adjusted for new width
            y: clientHeight / 2 - 50,
            scale: 1
        });
        hasCentered.current = true;
    }
  }, [initialData]);

  // Auto Save
  useEffect(() => {
      const currentData = { nodes, edges, transform, version: 1 };
      const dataString = JSON.stringify(currentData, null, 2);

      if (dataString === lastSavedData.current) return;

      const timer = setTimeout(() => {
          lastSavedData.current = dataString;
          onSave(dataString);
      }, 500); 

      return () => clearTimeout(timer);
  }, [nodes, edges, transform, onSave]);


  // --- History Management ---
  const saveHistory = useCallback(() => {
      setPast(prev => [...prev, { nodes, edges }]);
      setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      setFuture(prev => [{ nodes, edges }, ...prev]);
      
      setNodes(previous.nodes);
      setEdges(previous.edges);
      setPast(newPast);
  }, [past, nodes, edges]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      
      const next = future[0];
      const newFuture = future.slice(1);
      
      setPast(prev => [...prev, { nodes, edges }]);
      
      setNodes(next.nodes);
      setEdges(next.edges);
      setFuture(newFuture);
  }, [future, nodes, edges]);


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
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
        setIsPanning(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        itemStartRef.current = { x: transform.x, y: transform.y };
        return;
    }

    if (e.button === 0) {
        if (!e.shiftKey) {
            setSelectedNodeIds(new Set());
            setSelectedEdgeId(null);
        }
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const startPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setSelectionBox({ start: startPos, end: startPos });
        }
    }
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent) => {
    saveHistory(); // History: Node Add
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = screenToWorld(mousePos, transform);
    const newNode: MindMapNode = {
      id: generateId(),
      title: '新节点',
      content: '',
      x: worldPos.x - 50, 
      y: worldPos.y - 40,
      width: 100, 
      height: 80, 
      color: 'blue',
      type: 'node'
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeIds(new Set([newNode.id]));
    setSelectedEdgeId(null);
  };

  // ... (processImageFile and handlePaste unchanged)
  const processImageFile = async (file: File, x: number, y: number, index: number) => {
    if (onSaveAsset && onResolveResource) {
        try {
            const assetPath = await onSaveAsset(file);
            const imageUrl = onResolveResource(assetPath);
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 300;
                const ratio = img.width / img.height;
                const width = Math.min(img.width, MAX_WIDTH);
                const HEADER_HEIGHT = 44; 
                const imageHeight = width / ratio;
                const height = imageHeight + HEADER_HEIGHT;
                const newNode: MindMapNode = {
                    id: generateId(),
                    type: 'image',
                    title: file.name,
                    content: '',
                    imageUrl: imageUrl,
                    assetPath: assetPath, 
                    x: x + (index * 20),
                    y: y + (index * 20),
                    width: width,
                    height: height, 
                    color: 'gray'
                };
                setNodes(prev => [...prev, newNode]);
            };
            img.src = imageUrl;
        } catch (e) {
            console.error("Failed to save image asset", e);
            if (onShowMessage) onShowMessage("图片保存失败");
        }
    } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            if (result) {
                const img = new Image();
                img.onload = () => {
                    const MAX_WIDTH = 300;
                    const ratio = img.width / img.height;
                    const width = Math.min(img.width, MAX_WIDTH);
                    const HEADER_HEIGHT = 44; 
                    const imageHeight = width / ratio;
                    const height = imageHeight + HEADER_HEIGHT;
                    const newNode: MindMapNode = {
                        id: generateId(),
                        type: 'image',
                        title: file.name,
                        content: '',
                        imageUrl: result,
                        x: x + (index * 20),
                        y: y + (index * 20),
                        width: width,
                        height: height, 
                        color: 'gray'
                    };
                    setNodes(prev => [...prev, newNode]);
                };
                img.src = result;
            }
        };
        reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
            return;
        }

        if (e.clipboardData && e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files) as File[];
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (imageFiles.length === 0) return;
            e.preventDefault();
            saveHistory(); 
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const centerScreen = { x: rect.width / 2, y: rect.height / 2 };
            const worldPos = screenToWorld(centerScreen, transformRef.current);
            imageFiles.forEach((file, index) => {
                processImageFile(file, worldPos.x, worldPos.y, index);
            });
        }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [saveHistory, onSaveAsset, onResolveResource]); 

  // ... (handleCreateGroup, handleAlign, update logic helpers unchanged)
  const handleCreateGroup = () => {
    if (selectedNodeIds.size === 0) return;
    saveHistory(); 
    const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
    if (selectedNodes.length === 0) return;
    selectedNodes.sort((a, b) => a.y - b.y || a.x - b.x);
    const columns = Math.ceil(Math.sqrt(selectedNodes.length));
    const GAP = 20;
    let currentX = 0;
    let currentY = 0;
    let rowMaxHeight = 0;
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
    let updatedNodes = nodes.map(n => {
        if (layoutMap.has(n.id)) {
            const pos = layoutMap.get(n.id)!;
            return { ...n, x: pos.x, y: pos.y };
        }
        return n;
    });
    const newGroupId = generateId();
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
        title: '新分组',
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

  const handleAlign = (direction: 'horizontal' | 'vertical') => {
    if (selectedNodeIds.size < 2) return;
    saveHistory(); 
    const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id));
    if (selectedNodes.length === 0) return;
    if (direction === 'horizontal') {
        const totalY = selectedNodes.reduce((sum, n) => sum + (n.y + n.height/2), 0);
        const avgY = totalY / selectedNodes.length;
        setNodes(prev => prev.map(n => {
            if (selectedNodeIds.has(n.id)) return { ...n, y: avgY - n.height/2 };
            return n;
        }));
    } else {
        const totalX = selectedNodes.reduce((sum, n) => sum + (n.x + n.width/2), 0);
        const avgX = totalX / selectedNodes.length;
        setNodes(prev => prev.map(n => {
            if (selectedNodeIds.has(n.id)) return { ...n, x: avgX - n.width/2 };
            return n;
        }));
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent native drag
    
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
      initialNodesRef.current = nodes; 
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
  const handleEdgeReconnectStart = (e: React.MouseEvent, edgeId: string, which: 'from' | 'to') => {
      e.stopPropagation();
      e.preventDefault();
      const edge = edges.find(ed => ed.id === edgeId);
      if(!edge) return;
      setReconnectingEdge({ edgeId, which });
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
          saveHistory(); 
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

  // --- Optimized Event Handlers using Refs to prevent re-binding ---
  
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
       if (rafRef.current) return;
       const clientX = e.clientX;
       const clientY = e.clientY;
       
       rafRef.current = requestAnimationFrame(() => {
         try {
           const isPanning = isPanningRef.current;
           const selectionBox = selectionBoxRef.current;
           const draggingNodeId = draggingNodeIdRef.current;
           const connectionStart = connectionStartRef.current;
           const reconnectingEdge = reconnectingEdgeRef.current;
           
           const currentTransform = transformRef.current;
           const currentNodes = nodesRef.current;

           if (isPanning) {
               const dx = clientX - dragStartRef.current.x;
               const dy = clientY - dragStartRef.current.y;
               setTransform(prev => ({
                 ...prev,
                 x: itemStartRef.current.x + dx,
                 y: itemStartRef.current.y + dy
               }));
           } 
           else if (selectionBox) {
               const rect = containerRef.current?.getBoundingClientRect();
               if (rect) {
                   setSelectionBox(prev => prev ? ({ ...prev, end: { x: clientX - rect.left, y: clientY - rect.top } }) : null);
               }
           }
           else if (draggingNodeId && initialNodesRef.current.length > 0) {
              const dx = (clientX - dragStartRef.current.x) / currentTransform.scale;
              const dy = (clientY - dragStartRef.current.y) / currentTransform.scale;
              
              const isDraggingSelection = selectedNodeIdsRef.current.has(draggingNodeId);
              const nodesToMove = isDraggingSelection ? Array.from(selectedNodeIdsRef.current) : [draggingNodeId];
              
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
           else if (connectionStart && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const mousePos = { x: clientX - rect.left, y: clientY - rect.top };
              const worldPos = screenToWorld(mousePos, currentTransform);
              setTempConnectionEnd(worldPos);
              const nearest = getNearestHandle(worldPos, currentNodes, connectionStart.nodeId, 50);
              setSnapPreview(nearest);
           }
           else if (reconnectingEdge && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const mousePos = { x: clientX - rect.left, y: clientY - rect.top };
              const worldPos = screenToWorld(mousePos, currentTransform);
              setTempConnectionEnd(worldPos);
              const edge = edgesRef.current.find(ed => ed.id === reconnectingEdge.edgeId);
              const excludeNodeId = edge ? (reconnectingEdge.which === 'from' ? edge.to : edge.from) : '';
              const nearest = getNearestHandle(worldPos, currentNodes, excludeNodeId, 50);
              setSnapPreview(nearest);
           }
         } finally {
            rafRef.current = null;
         }
       });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }

    const selectionBox = selectionBoxRef.current;
    if (selectionBox) {
        const x1 = Math.min(selectionBox.start.x, selectionBox.end.x);
        const y1 = Math.min(selectionBox.start.y, selectionBox.end.y);
        const x2 = Math.max(selectionBox.start.x, selectionBox.end.x);
        const y2 = Math.max(selectionBox.start.y, selectionBox.end.y);

        const currentTransform = transformRef.current;
        const currentNodes = nodesRef.current;

        const p1 = screenToWorld({x: x1, y: y1}, currentTransform);
        const p2 = screenToWorld({x: x2, y: y2}, currentTransform);
        
        const minWX = Math.min(p1.x, p2.x);
        const minWY = Math.min(p1.y, p2.y);
        const maxWX = Math.max(p1.x, p2.x);
        const maxWY = Math.max(p1.y, p2.y);

        const selected = new Set<string>();
        currentNodes.forEach(n => {
            if (n.x >= minWX && n.x + n.width <= maxWX && n.y >= minWY && n.y + n.height <= maxWY) {
                selected.add(n.id);
            }
        });
        
        if (selected.size > 0) setSelectedNodeIds(selected);
        setSelectionBox(null);
    }

    const connectionStart = connectionStartRef.current;
    const reconnectingEdge = reconnectingEdgeRef.current;
    const snap = snapPreviewRef.current; // Use Ref
    const draggingId = draggingNodeIdRef.current;

    if (connectionStart && snap) {
         setEdges(prev => {
            const exists = prev.some(edge => 
                (edge.from === connectionStart.nodeId && edge.to === snap.nodeId) ||
                (edge.from === snap.nodeId && edge.to === connectionStart.nodeId)
            );
            if (!exists) {
                setPast(p => [...p, { nodes: nodesRef.current, edges: edgesRef.current }]);
                setFuture([]);
                
                return [...prev, {
                    id: generateId(),
                    from: connectionStart.nodeId,
                    to: snap.nodeId,
                    fromHandle: connectionStart.handle,
                    toHandle: snap.handle,
                    style: 'solid',
                    arrow: 'to',
                    color: darkMode ? '#a3a3a3' : '#94a3b8'
                }];
            }
            return prev;
         });
    }

    if (reconnectingEdge && snap) {
        setPast(p => [...p, { nodes: nodesRef.current, edges: edgesRef.current }]);
        setFuture([]);
        setEdges(prev => prev.map(e => {
            if (e.id === reconnectingEdge.edgeId) {
                if (reconnectingEdge.which === 'from') return { ...e, from: snap.nodeId, fromHandle: snap.handle };
                else return { ...e, to: snap.nodeId, toHandle: snap.handle };
            }
            return e;
        }));
    }

    if (draggingId) {
        // Logic for history on drag end
        const currentNodes = nodesRef.current;
        const hasMoved = currentNodes.some(n => {
             const init = initialNodesRef.current.find(i => i.id === n.id);
             return init && (init.x !== n.x || init.y !== n.y);
        });
        if (hasMoved) {
            // Push previous state
            setPast(p => [...p, { nodes: initialNodesRef.current, edges: edgesRef.current }]); 
            setFuture([]);
        }
        
        // Recalculate groups
        setNodes(prev => {
            const isDraggingSelection = selectedNodeIdsRef.current.has(draggingId);
            const nodesToCheck = isDraggingSelection ? Array.from(selectedNodeIdsRef.current) : [draggingId];
            let current = prev;
            if (nodesToCheck.length === 1) current = updateParentIds(current, nodesToCheck[0]);
            return recalculateGroupBounds(current);
        });
    }

    setIsPanning(false);
    setDraggingNodeId(null);
    setDraggedChildrenIds([]);
    setConnectionStart(null);
    setTempConnectionEnd(null);
    setSnapPreview(null);
    setReconnectingEdge(null);
  }, [darkMode]);

  // Sync handlers to refs
  useEffect(() => {
      mouseMoveHandlerRef.current = handleGlobalMouseMove;
      mouseUpHandlerRef.current = handleMouseUp;
  }, [handleGlobalMouseMove, handleMouseUp]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => mouseMoveHandlerRef.current(e);
    const onUp = (e: MouseEvent) => mouseUpHandlerRef.current(); // Ignore event arg

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []); // Run ONCE


  // ... (updateParentIds, recalculateGroupBounds, updateNodeData, updateNodeResize, updateNodeColor, updateEdge, deleteNode, deleteSelected)
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
          if (targetGroup) return { ...node, parentId: targetGroup.id };
          else return { ...node, parentId: undefined };
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
            if (Math.abs(newX - node.x) < 1 && Math.abs(newWidth - node.width) < 1 && Math.abs(newHeight - node.height) < 1) return node;
            return { ...node, x: newX, y: newY, width: newWidth, height: newHeight };
        }
        return node;
    });
  };
  const updateNodeData = (id: string, title: string, content: string) => {
    saveHistory(); 
    setNodes(prev => prev.map(n => n.id === id ? { ...n, title, content } : n));
  };
  const updateNodeResize = (id: string, width: number, height: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, width, height } : n));
  };
  const updateNodeColor = (id: string, color: NodeColor) => {
    saveHistory(); 
    setNodes(prev => prev.map(n => n.id === id ? { ...n, color } : n));
  };
  const updateEdge = (id: string, updates: Partial<MindMapEdge>) => {
      setEdges(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };
  const deleteNode = (id: string) => {
    saveHistory(); 
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(edge => edge.from !== id && edge.to !== id));
    if (selectedNodeIds.has(id)) {
        const next = new Set(selectedNodeIds);
        next.delete(id);
        setSelectedNodeIds(next);
    }
  };
  const deleteSelected = () => {
      saveHistory(); 
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

  const handleAiExpand = async () => {
    if (selectedNodeIds.size === 0) {
        if(onShowMessage) onShowMessage("请先选中一个主题节点以进行 AI 扩展。");
        return;
    }
    if (selectedNodeIds.size > 1) {
        if(onShowMessage) onShowMessage("AI 扩展仅支持单个节点。");
        return;
    }
    if (isAiLoading) return;

    const selectedId = Array.from(selectedNodeIds)[0];
    const node = nodes.find(n => n.id === selectedId);
    if (!node || !node.title.trim()) {
        if(onShowMessage) onShowMessage("节点标题不能为空。");
        return;
    }
    if (!settings.aiApiKey) {
        if (onShowMessage) onShowMessage("请先在 Mindo 设置中配置您的 AI API Key。");
        else alert("请先在 Mindo 设置中配置您的 AI API Key。");
        return;
    }
    setIsAiLoading(true);
    try {
      const suggestions: AiResult[] = await expandIdea(node.title, settings);
      saveHistory(); 
      const newNodes: MindMapNode[] = [];
      const newEdges: MindMapEdge[] = [];
      const radius = 350; 
      suggestions.forEach((item, index) => {
        const fanAngle = (index - (suggestions.length - 1) / 2) * (Math.PI / 4); 
        const newNodeId = generateId();
        newNodes.push({
          id: newNodeId,
          type: 'node',
          title: item.title,
          content: item.content, 
          x: node.x + radius * Math.cos(fanAngle) + 100, 
          y: node.y + radius * Math.sin(fanAngle),
          width: 120, 
          height: 120, 
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
    } catch (e: any) {
      console.error(e);
      const msg = e.message || "AI 生成失败，请检查控制台详情。";
      if (onShowMessage) onShowMessage(msg);
      else alert(msg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExportImage = useCallback(async (pixelRatio: number = 2) => {
    if (canvasContentRef.current === null) return;
    try {
        const dataUrl = await htmlToImage.toPng(canvasContentRef.current, {
            backgroundColor: darkMode ? '#111827' : '#ffffff',
            pixelRatio: pixelRatio 
        });
        const link = document.createElement('a');
        link.download = `${fileName || '思维导图'}.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Export failed', err);
    }
  }, [darkMode, fileName]);

  const handleExportMarkdown = useCallback(() => {
    const md = generateMarkdown(nodes, edges);
    if (onSaveMarkdown) {
        onSaveMarkdown(`${fileName || '思维导图'}.md`, md);
    } else {
        // Fallback for web
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName || '思维导图'}.md`;
        link.click();
        URL.revokeObjectURL(url);
    }
    if (onShowMessage) onShowMessage("已导出 Markdown 文件");
  }, [nodes, edges, fileName, onShowMessage, onSaveMarkdown]);

  const selectedEdgeObj = edges.find(e => e.id === selectedEdgeId);
  const groupNodes = nodes.filter(n => n.type === 'group');
  const standardNodes = nodes.filter(n => n.type !== 'group');

  return (
    <div 
      ref={containerRef}
      className="mindo-canvas-container"
      onWheel={handleWheel}
    >
      <div 
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, outline: 'none', cursor: isPanning ? 'grabbing' : 'default' }}
        onMouseDown={handleMouseDownCanvas}
        onDoubleClick={handleDoubleClickCanvas}
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
        >
          {groupNodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              scale={transform.scale}
              isSelected={selectedNodeIds.has(node.id)}
              isDragging={draggingNodeId === node.id || (selectedNodeIds.has(node.id) && !!draggingNodeId)}
              onMouseDown={handleNodeMouseDown}
              onMouseUp={handleMouseUp} // Use stable handler
              onConnectStart={handleConnectStart}
              onConnectEnd={handleConnectEnd}
              onUpdate={updateNodeData}
              onResize={updateNodeResize}
              onResizeStart={saveHistory} 
              onDelete={deleteNode}
              onColorChange={updateNodeColor}
              onRenderMarkdown={onRenderMarkdown}
            />
          ))}
          <svg style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '1px', height: '1px', zIndex: 10 }}>
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
                  onDelete={() => { saveHistory(); setEdges(prev => prev.filter(e => e.id !== edge.id)); }}
                  onUpdate={updateEdge}
                  onInteractStart={saveHistory} 
                  transform={transform}
                />
              );
            })}
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 15 }}>
            {edges.map(edge => {
              const source = nodes.find(n => n.id === edge.from);
              const target = nodes.find(n => n.id === edge.to);
              if (!source || !target) return null;
              return (
                <EdgeLabel
                  key={edge.id}
                  edge={edge}
                  sourceNode={source}
                  targetNode={target}
                  onSelect={handleEdgeSelect}
                />
              );
            })}
          </div>
          {standardNodes.map(node => (
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
              onResizeStart={saveHistory} 
              onDelete={deleteNode}
              onColorChange={updateNodeColor}
              onRenderMarkdown={onRenderMarkdown}
            />
          ))}
          <svg style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '1px', height: '1px', zIndex: 60 }}>
            {selectedEdgeObj && selectedEdgeId && (() => {
                const source = nodes.find(n => n.id === selectedEdgeObj.from);
                const target = nodes.find(n => n.id === selectedEdgeObj.to);
                if (!source || !target) return null;
                const start = getHandlePosition(source, selectedEdgeObj.fromHandle);
                const end = getHandlePosition(target, selectedEdgeObj.toHandle);
                const color = selectedEdgeObj.color || '#94a3b8';
                return (
                    <>
                         <circle
                            cx={start.x}
                            cy={start.y}
                            r={6}
                            fill="white"
                            stroke={color}
                            strokeWidth={2}
                            cursor="crosshair"
                            pointerEvents="auto"
                            onMouseDown={(e) => handleEdgeReconnectStart(e, selectedEdgeObj.id, 'from')}
                        />
                         <circle
                            cx={end.x}
                            cy={end.y}
                            r={6}
                            fill="white"
                            stroke={color}
                            strokeWidth={2}
                            cursor="crosshair"
                            pointerEvents="auto"
                            onMouseDown={(e) => handleEdgeReconnectStart(e, selectedEdgeObj.id, 'to')}
                        />
                    </>
                );
            })()}
            {(connectionStart || reconnectingEdge) && tempConnectionEnd && (
                <>
                <path
                    d={(() => {
                        let startPoint: Position;
                        if (reconnectingEdge) {
                            const edge = edges.find(e => e.id === reconnectingEdge.edgeId);
                            if (!edge) return '';
                            if (reconnectingEdge.which === 'to') {
                                const source = nodes.find(n => n.id === edge.from);
                                if (!source) return '';
                                startPoint = getHandlePosition(source, edge.fromHandle);
                            } else {
                                const target = nodes.find(n => n.id === edge.to);
                                if (!target) return '';
                                startPoint = getHandlePosition(target, edge.toHandle);
                            }
                        } else if (connectionStart) {
                             const source = nodes.find(n => n.id === connectionStart.nodeId);
                             if (!source) return '';
                             startPoint = getHandlePosition(source, connectionStart.handle);
                        } else {
                            return '';
                        }
                        const endPoint = snapPreview 
                            ? getHandlePosition(nodes.find(n => n.id === snapPreview.nodeId)!, snapPreview.handle)
                            : tempConnectionEnd;
                        return `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;
                    })()}
                    className={`mindo-connection-preview ${snapPreview ? 'snapping' : ''}`}
                />
                </>
            )}
          </svg>
          {selectionBox && (
              <div 
                  className="mindo-selection-box"
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
      {selectedEdgeId && selectedEdgeObj && (
          <EdgeMenu 
              edge={selectedEdgeObj} 
              onUpdate={(id, updates) => {
                  saveHistory(); 
                  updateEdge(id, updates);
              }}
              onDelete={(id) => {
                  saveHistory(); 
                  setEdges(prev => prev.filter(e => e.id !== selectedEdgeObj.id));
              }}
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
            if (containerRef.current) {
                 setTransform({ x: containerRef.current.clientWidth/2 - 150, y: containerRef.current.clientHeight/2 - 50, scale: 1 });
            }
        }}
        onAiExpand={handleAiExpand}
        onAddGroup={handleCreateGroup}
        onExportImage={handleExportImage}
        onExportMarkdown={handleExportMarkdown}
        onAlign={handleAlign}
        isAiLoading={isAiLoading}
        canGroup={selectedNodeIds.size > 1}
        canAlign={selectedNodeIds.size > 1}
        hasSingleSelection={selectedNodeIds.size === 1}
      />
    </div>
  );
};

export default App;