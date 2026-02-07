
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
    const commonClass = "absolute w-4 h-4 bg-white dark:bg-gray-700 border-2 border-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-crosshair hover:bg-blue-100 dark:hover:bg-blue-900 hover:scale-125 z-50 pointer-events-auto flex items-center justify-center shadow-sm";
    
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
            <div className={`${commonClass} -top-2 left-1/2 -translate-x-1/2`} onMouseDown={(e) => handleMouseDown(e, 'top')} onMouseUp={(e) => handleMouseUp(e, 'top')} />
            <div className={`${commonClass} top-1/2 -translate-y-1/2 -right-2`} onMouseDown={(e) => handleMouseDown(e, 'right')} onMouseUp={(e) => handleMouseUp(e, 'right')} />
            <div className={`${commonClass} -bottom-2 left-1/2 -translate-x-1/2`} onMouseDown={(e) => handleMouseDown(e, 'bottom')} onMouseUp={(e) => handleMouseUp(e, 'bottom')} />
            <div className={`${commonClass} top-1/2 -translate-y-1/2 -left-2`} onMouseDown={(e) => handleMouseDown(e, 'left')} onMouseUp={(e) => handleMouseUp(e, 'left')} />
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

  const style = NODE_STYLES[node.color];
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
        // Delay focus slightly to ensure render is complete and prevent race conditions with click events
        setTimeout(() => {
            if (editTarget === 'title' && titleInputRef.current) {
                titleInputRef.current.focus();
                if (node.title === 'New Node' || node.title === 'New Group') {
                    titleInputRef.current.select();
                }
            } else if (editTarget === 'content' && contentInputRef.current) {
                contentInputRef.current.focus();
                // Cursor at end
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
    
    // Determine which part was clicked to set focus correctly
    const target = e.target as HTMLElement;
    if (target.closest('.node-content')) {
        setEditTarget('content');
    } else {
        setEditTarget('title');
    }
    
    setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the focus is moving to another element inside this node component (e.g. from title to content)
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
      // e.preventDefault(); // Removed preventDefault to allow text selection and focus
  }

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
          className={`absolute flex flex-col group
            bg-white/50 dark:bg-gray-800/30 border-dashed
            ${isDragging ? '' : 'transition-all duration-200'}
            ${isSelected ? `ring-2 ${style.selection} dark:ring-blue-500 z-10` : 'z-0 border-gray-300 dark:border-gray-600'}
            ${isDragging ? 'cursor-grabbing opacity-90' : 'cursor-grab'}
            rounded-xl border-2
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
             <div className={`px-2 py-1 relative rounded-t-[9px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 w-fit self-start m-2 rounded-lg opacity-80`}>
                {isEditing ? (
                <input
                    ref={titleInputRef}
                    defaultValue={node.title}
                    placeholder="Group Name"
                    className="bg-transparent font-bold outline-none w-24 text-inherit"
                    onKeyDown={handleKeyDown}
                    onMouseDown={stopProp}
                />
                ) : (
                <div className="font-bold select-none text-sm">
                    {node.title || "Group"}
                </div>
                )}
            </div>
            
            <div 
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 dark:bg-gray-600 rounded-tl-lg opacity-0 group-hover:opacity-100"
                onMouseDown={handleResizeMouseDown}
            />
             
             {isSelected && !isDragging && (
                <div 
                  className="absolute -top-10 left-0 flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-full shadow border border-gray-100 dark:border-gray-700"
                  onMouseDown={(e) => e.stopPropagation()} 
                >
                    <button onClick={(e) => { stopProp(e); onDelete(node.id); }} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-full">
                        <Trash2 size={14} />
                    </button>
                    {(['yellow', 'green', 'blue', 'gray'] as NodeColor[]).map((c) => (
                        <button
                        key={c}
                        onClick={(e) => { stopProp(e); onColorChange(node.id, c); }}
                        className={`w-3 h-3 rounded-full border border-gray-200 dark:border-gray-600 ${NODE_STYLES[c].bg}`}
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
      className={`absolute flex flex-col group
        bg-white dark:bg-gray-800
        ${isDragging ? '' : 'transition-all duration-200'}
        ${isSelected ? `ring-2 ${style.selection} dark:ring-blue-500 shadow-xl z-20` : 'shadow-md hover:shadow-lg z-10'}
        ${isDragging ? 'cursor-grabbing opacity-90' : 'cursor-grab'}
        rounded-xl
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
      <div className={`p-3 relative rounded-t-[9px] ${style.bg} ${style.text} dark:brightness-90 ${showContent ? `border-b ${style.border} dark:border-gray-700` : 'rounded-b-[9px]'}`}>
        {isEditing ? (
          <input
            ref={titleInputRef}
            defaultValue={node.title}
            placeholder="Title"
            className={`w-full bg-transparent font-bold outline-none text-center placeholder-${node.color}-300 dark:text-gray-900`}
            onKeyDown={handleKeyDown}
            onMouseDown={stopProp}
          />
        ) : (
          <div className="font-bold text-center select-none whitespace-pre-wrap leading-tight dark:text-gray-900">
            {node.title || "Untitled"}
          </div>
        )}
      </div>

      {showContent && (
        <div className="p-3 bg-white dark:bg-gray-800 rounded-b-[9px] flex-grow min-h-[60px] node-content">
             {isEditing ? (
                <textarea
                    ref={contentInputRef}
                    defaultValue={node.content}
                    placeholder="Description..."
                    className="w-full h-full bg-transparent resize-none outline-none text-sm min-h-[60px] text-gray-700 dark:text-gray-300"
                    onKeyDown={handleKeyDown}
                    onMouseDown={stopProp}
                />
            ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap select-none leading-relaxed">
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
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-gray-800 p-1.5 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 scale-100 transition-transform origin-bottom z-30"
            onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { stopProp(e); onDelete(node.id); }}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-full transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />
          {(['yellow', 'green', 'blue', 'red', 'purple', 'gray'] as NodeColor[]).map((c) => (
            <button
              key={c}
              onClick={(e) => { stopProp(e); onColorChange(node.id, c); }}
              className={`w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 ${NODE_STYLES[c].bg} hover:scale-125 transition-transform`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
