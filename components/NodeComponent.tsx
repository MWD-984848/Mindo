import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { MindMapNode, NODE_STYLES, NodeColor, HandlePosition, COLOR_PALETTE } from '../types';
import { Trash2 } from 'lucide-react';

interface NodeComponentProps {
  node: MindMapNode;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseUp: (e: React.MouseEvent, nodeId: string) => void;
  onConnectStart: (e: React.MouseEvent, nodeId: string, handle: HandlePosition) => void;
  onConnectEnd: (e: React.MouseEvent, nodeId: string, handle: HandlePosition) => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onResizeStart?: () => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: NodeColor) => void;
  scale: number;
  onRenderMarkdown?: (content: string, el: HTMLElement) => void;
}

export const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  isSelected,
  isDragging,
  onMouseDown,
  onMouseUp,
  onConnectStart,
  onConnectEnd,
  onUpdate,
  onResize,
  onResizeStart,
  onDelete,
  onColorChange,
  scale,
  onRenderMarkdown
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [focusTarget, setFocusTarget] = useState<'title' | 'content'>('title');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const markdownRef = useRef<HTMLDivElement>(null);

  const themeClass = NODE_STYLES[node.color]?.className || NODE_STYLES['gray'].className;
  const isGroup = node.type === 'group';
  const isImage = node.type === 'image';

  const hasContent = (node.content && node.content.trim().length > 0) || isImage;
  const showContent = isEditing || hasContent;

  useLayoutEffect(() => {
      if (nodeRef.current && !isGroup) {
          const obs = new ResizeObserver(entries => {
              for (const entry of entries) {
                  const el = nodeRef.current;
                  if (el && el.offsetWidth > 10 && el.offsetHeight > 10) {
                      if (Math.abs(el.offsetWidth - node.width) > 2 || Math.abs(el.offsetHeight - node.height) > 2) {
                          onResize(node.id, el.offsetWidth, el.offsetHeight);
                      }
                  }
              }
          });
          obs.observe(nodeRef.current);
          return () => obs.disconnect();
      }
  }, [node.id, node.width, node.height, onResize, isGroup]);

  useEffect(() => {
      if (!isEditing && markdownRef.current && onRenderMarkdown && node.content && !isImage) {
          markdownRef.current.innerHTML = '';
          onRenderMarkdown(node.content, markdownRef.current);
      }
  }, [isEditing, node.content, onRenderMarkdown, isImage]);

  const adjustTextareaHeight = () => {
    if (contentInputRef.current) {
        contentInputRef.current.style.height = 'auto';
        contentInputRef.current.style.height = contentInputRef.current.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    if (isEditing) {
        setTimeout(() => {
            if (focusTarget === 'title' && titleInputRef.current) {
                titleInputRef.current.focus();
                if (node.title === 'New Node' || node.title === '新节点' || node.title === 'New Group' || node.title === '新分组') {
                    titleInputRef.current.select();
                }
            } else if (focusTarget === 'content' && contentInputRef.current) {
                contentInputRef.current.focus();
                adjustTextareaHeight();
                const val = contentInputRef.current.value;
                contentInputRef.current.setSelectionRange(val.length, val.length);
            }
        }, 10);
    }
  }, [isEditing, focusTarget]);

  const saveChanges = () => {
    const newTitle = titleInputRef.current?.value ?? node.title;
    const newContent = contentInputRef.current?.value ?? node.content ?? "";
    onUpdate(node.id, newTitle, newContent);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    
    if (isImage) {
        setFocusTarget('title');
    } else {
        if (target.closest('.mindo-node-content')) {
            setFocusTarget('content');
        } else {
            setFocusTarget('title');
        }
    }
    setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (nodeRef.current && nodeRef.current.contains(e.relatedTarget as Node)) {
        return;
    }
    setIsEditing(false);
    saveChanges();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { 
       setIsEditing(false);
       saveChanges();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      saveChanges();
    }
  };

  const stopProp = (e: React.MouseEvent) => {
      e.stopPropagation();
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onResizeStart) onResizeStart();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = node.width;
      const startHeight = node.height;

      const handleMouseMove = (mv: MouseEvent) => {
          const dx = (mv.clientX - startX) / scale;
          const dy = (mv.clientY - startY) / scale;
          onResize(node.id, Math.max(100, startWidth + dx), Math.max(50, startHeight + dy));
      };
      const handleMouseUp = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  const handleHandleMouseDown = (e: React.MouseEvent, h: HandlePosition) => {
    e.stopPropagation();
    e.preventDefault();
    onConnectStart(e, node.id, h);
  };

  const handleHandleMouseUp = (e: React.MouseEvent, h: HandlePosition) => {
    e.stopPropagation();
    e.preventDefault();
    onConnectEnd(e, node.id, h);
  };

  // Group Rendering
  if (isGroup) {
      return (
        <div
          ref={nodeRef}
          className={`mindo-node mindo-group ${themeClass}
            ${isDragging ? 'dragging' : ''}
            ${isSelected ? 'selected' : ''}
          `}
          style={{
            transform: `translate(${node.x}px, ${node.y}px)`,
            width: node.width,
            height: node.height,
          }}
          onMouseDown={(e) => onMouseDown(e, node.id)}
          onMouseUp={(e) => onMouseUp(e, node.id)}
          onDoubleClick={handleDoubleClick}
          tabIndex={-1} 
          onBlur={handleBlur}
        >
             <div className="mindo-group-label">
                {isEditing ? (
                <input
                    ref={titleInputRef}
                    defaultValue={node.title}
                    placeholder="分组名称"
                    className="mindo-input-reset"
                    style={{ width: '6rem', color: 'inherit', padding: 0, margin: 0 }}
                    onKeyDown={handleKeyDown}
                    onMouseDown={stopProp}
                />
                ) : (
                <div style={{ userSelect: 'none' }}>
                    {node.title || "分组"}
                </div>
                )}
            </div>
            
            <div 
                className="mindo-resize-handle"
                onMouseDown={handleResizeMouseDown}
            />
             
             {isSelected && !isDragging && (
                <div 
                  className="mindo-group-tools"
                  onMouseDown={(e) => e.stopPropagation()} 
                >
                    <button onClick={(e) => { stopProp(e); onDelete(node.id); }} className="mindo-tool-btn">
                        <Trash2 size={14} />
                    </button>
                    {COLOR_PALETTE.map((c) => (
                        <button
                        key={c}
                        onClick={(e) => { stopProp(e); onColorChange(node.id, c); }}
                        className="mindo-color-btn"
                        style={{ backgroundColor: NODE_STYLES[c].picker }}
                        />
                    ))}
                </div>
            )}
        </div>
      );
  }

  return (
    <div
      ref={nodeRef}
      className={`mindo-node ${themeClass}
        ${isDragging ? 'dragging' : ''}
        ${isSelected ? 'selected' : ''}
      `}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: node.width,
        height: isImage ? node.height : 'auto',
        minHeight: isImage ? node.height : 'auto',
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseUp={(e) => onMouseUp(e, node.id)}
      onDoubleClick={handleDoubleClick}
      tabIndex={-1} 
      onBlur={handleBlur}
    >
      {/* Title */}
      <div className={`mindo-node-header ${showContent ? 'has-content' : ''}`}>
        {isEditing ? (
          <input
            ref={titleInputRef}
            defaultValue={node.title}
            placeholder="标题"
            className="mindo-input-reset"
            style={{ width: '100%', fontWeight: 'bold', padding: 0, margin: 0, color: 'inherit', textAlign: 'center' }}
            onKeyDown={handleKeyDown}
            onMouseDown={stopProp}
          />
        ) : (
          <div style={{ userSelect: 'none', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>
            {node.title || "未命名"}
          </div>
        )}
      </div>

      {/* Content */}
      {showContent && (
        <div className="mindo-node-content" style={{ height: isImage ? '100%' : 'auto' }}>
             {isImage ? (
                 <img 
                    src={node.imageUrl} 
                    alt={node.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', pointerEvents: 'none', display: 'block' }} 
                 />
             ) : (
                 <>
                    {isEditing ? (
                        <textarea
                            ref={contentInputRef}
                            defaultValue={node.content}
                            placeholder="描述..."
                            className="mindo-input-reset"
                            style={{ width: '100%', resize: 'none', color: 'inherit', padding: 0, margin: 0, overflow: 'hidden', height: 'auto', minHeight: '1.5em' }}
                            onInput={adjustTextareaHeight}
                            onKeyDown={handleKeyDown}
                            onMouseDown={stopProp}
                        />
                    ) : (
                        <div ref={markdownRef} className="mindo-markdown-content">
                            {!onRenderMarkdown && node.content}
                        </div>
                    )}
                </>
             )}
        </div>
      )}

      {showContent && (
        <div 
            className="mindo-resize-handle"
            onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* Handles */}
      <div className="mindo-handle mindo-handle-top" onMouseDown={(e) => handleHandleMouseDown(e, 'top')} onMouseUp={(e) => handleHandleMouseUp(e, 'top')} />
      <div className="mindo-handle mindo-handle-right" onMouseDown={(e) => handleHandleMouseDown(e, 'right')} onMouseUp={(e) => handleHandleMouseUp(e, 'right')} />
      <div className="mindo-handle mindo-handle-bottom" onMouseDown={(e) => handleHandleMouseDown(e, 'bottom')} onMouseUp={(e) => handleHandleMouseUp(e, 'bottom')} />
      <div className="mindo-handle mindo-handle-left" onMouseDown={(e) => handleHandleMouseDown(e, 'left')} onMouseUp={(e) => handleHandleMouseUp(e, 'left')} />

      {isSelected && !isDragging && !isEditing && (
        <div 
            className="mindo-node-tools"
            onMouseDown={(e) => e.stopPropagation()}
        >
          <button onClick={(e) => { stopProp(e); onDelete(node.id); }} className="mindo-tool-btn" title="删除">
            <Trash2 size={14} />
          </button>
          <div style={{ width: 1, height: '1rem', backgroundColor: '#e5e7eb', margin: '0 0.25rem' }} />
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={(e) => { stopProp(e); onColorChange(node.id, c); }}
              className="mindo-color-btn"
              style={{ backgroundColor: NODE_STYLES[c].picker }}
            />
          ))}
        </div>
      )}
    </div>
  );
};