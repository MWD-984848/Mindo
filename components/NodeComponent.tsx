
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { MindMapNode, NODE_STYLES, NodeColor, HandlePosition } from '../types';
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
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: NodeColor) => void;
  scale: number;
}

const Handles: React.FC<{ 
    onStart: (e: React.MouseEvent, h: HandlePosition) => void;
    onEnd: (e: React.MouseEvent, h: HandlePosition) => void;
}> = ({ onStart, onEnd }) => {
    
    const handleMouseDown = (e: React.MouseEvent, h: HandlePosition) => {
        e.stopPropagation();
        e.preventDefault();
        onStart(e, h);
    };

    const handleMouseUp = (e: React.MouseEvent, h: HandlePosition) => {
        e.stopPropagation();
        e.preventDefault();
        onEnd(e, h);
    };

    return (
        <>
            <div className={`mindo-handle mindo-handle-top`} onMouseDown={(e) => handleMouseDown(e, 'top')} onMouseUp={(e) => handleMouseUp(e, 'top')} />
            <div className={`mindo-handle mindo-handle-right`} onMouseDown={(e) => handleMouseDown(e, 'right')} onMouseUp={(e) => handleMouseUp(e, 'right')} />
            <div className={`mindo-handle mindo-handle-bottom`} onMouseDown={(e) => handleMouseDown(e, 'bottom')} onMouseUp={(e) => handleMouseUp(e, 'bottom')} />
            <div className={`mindo-handle mindo-handle-left`} onMouseDown={(e) => handleMouseDown(e, 'left')} onMouseUp={(e) => handleMouseUp(e, 'left')} />
        </>
    );
};

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
  onDelete,
  onColorChange,
  scale,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<'title' | 'content'>('title');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const themeClass = NODE_STYLES[node.color].className;
  const isGroup = node.type === 'group';

  useLayoutEffect(() => {
      if (nodeRef.current && !isGroup) {
          const obs = new ResizeObserver(entries => {
              for (const entry of entries) {
                  const el = nodeRef.current;
                  if (el && (Math.abs(el.offsetWidth - node.width) > 2 || Math.abs(el.offsetHeight - node.height) > 2)) {
                      onResize(node.id, el.offsetWidth, el.offsetHeight);
                  }
              }
          });
          obs.observe(nodeRef.current);
          return () => obs.disconnect();
      }
  }, [node.id, node.width, node.height, onResize, isGroup]);

  useEffect(() => {
    if (isEditing) {
        setTimeout(() => {
            if (editTarget === 'title' && titleInputRef.current) {
                titleInputRef.current.focus();
                if (node.title === 'New Node' || node.title === 'New Group') {
                    titleInputRef.current.select();
                }
            } else if (editTarget === 'content' && contentInputRef.current) {
                contentInputRef.current.focus();
                const val = contentInputRef.current.value;
                contentInputRef.current.setSelectionRange(val.length, val.length);
            }
        }, 10);
    }
  }, [isEditing, editTarget]);

  const saveChanges = () => {
    const newTitle = titleInputRef.current?.value ?? node.title;
    const newContent = contentInputRef.current?.value ?? node.content ?? "";
    onUpdate(node.id, newTitle, newContent);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest('.mindo-node-content')) {
        setEditTarget('content');
    } else {
        setEditTarget('title');
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

  const showContent = isEditing || (node.content && node.content.trim().length > 0);

  // Group Rendering Logic
  if (isGroup) {
      return (
        <div
          ref={nodeRef}
          className={`mindo-node mindo-group
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
                    placeholder="Group Name"
                    className="mindo-input-reset"
                    style={{ width: '6rem', color: 'inherit', padding: 0, margin: 0 }}
                    onKeyDown={handleKeyDown}
                    onMouseDown={stopProp}
                />
                ) : (
                <div style={{ userSelect: 'none' }}>
                    {node.title || "Group"}
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
                    {(['yellow', 'green', 'blue', 'gray'] as NodeColor[]).map((c) => (
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

  // Standard Node Rendering
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
        minHeight: 50,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseUp={(e) => onMouseUp(e, node.id)}
      onDoubleClick={handleDoubleClick}
      tabIndex={-1} 
      onBlur={handleBlur}
    >
      <div className={`mindo-node-header ${showContent ? 'has-content' : ''}`}>
        {isEditing && editTarget === 'title' ? (
          <input
            ref={titleInputRef}
            defaultValue={node.title}
            placeholder="Title"
            className="mindo-input-reset"
            style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', padding: 0, margin: 0, color: 'inherit' }}
            onKeyDown={handleKeyDown}
            onMouseDown={stopProp}
          />
        ) : (
          <div style={{ userSelect: 'none' }}>
            {node.title || "Untitled"}
          </div>
        )}
      </div>

      {showContent && (
        <div className="mindo-node-content">
             {isEditing && editTarget === 'content' ? (
                <textarea
                    ref={contentInputRef}
                    defaultValue={node.content}
                    placeholder="Description..."
                    className="mindo-input-reset"
                    style={{ width: '100%', height: '100%', resize: 'none', color: 'inherit', padding: 0, margin: 0 }}
                    onKeyDown={handleKeyDown}
                    onMouseDown={stopProp}
                />
            ) : (
                <div style={{ userSelect: 'none' }}>
                    {node.content}
                </div>
            )}
        </div>
      )}

      <Handles 
        onStart={(e, h) => onConnectStart(e, node.id, h)} 
        onEnd={(e, h) => onConnectEnd(e, node.id, h)} 
      />

      {isSelected && !isDragging && !isEditing && (
        <div 
            className="mindo-node-tools"
            onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { stopProp(e); onDelete(node.id); }}
            className="mindo-tool-btn"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <div style={{ width: 1, height: '1rem', backgroundColor: '#e5e7eb', margin: '0 0.25rem' }} />
          {(['yellow', 'green', 'blue', 'red', 'purple', 'gray'] as NodeColor[]).map((c) => (
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
