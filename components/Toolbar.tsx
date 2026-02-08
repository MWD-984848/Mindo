
import React from 'react';
import { Minus, Plus, Maximize, Sparkles, RefreshCcw, Image as ImageIcon, BoxSelect, AlignCenterHorizontal, AlignCenterVertical } from 'lucide-react';

interface ToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
  onAiExpand: () => void;
  onAddGroup: () => void;
  onExportImage: () => void;
  onAlign?: (direction: 'horizontal' | 'vertical') => void;
  isAiLoading: boolean;
  canGroup: boolean;
  canAlign?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onFitView,
  onReset,
  onAiExpand,
  onAddGroup,
  onExportImage,
  onAlign,
  isAiLoading,
  canGroup,
  canAlign
}) => {
  return (
    <div className="mindo-toolbar">
      {/* File Operations */}
      <div className="mindo-toolbar-group">
        <button onClick={onExportImage} className="mindo-toolbar-btn" title="Export as Image">
            <ImageIcon size={18} />
        </button>
      </div>

      {/* Main Controls */}
      <div className="mindo-toolbar-group">
        
        {canGroup ? (
             <button onClick={onAddGroup} className="mindo-toolbar-btn mindo-group-btn" title="Group Selected">
                <BoxSelect size={18} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>Group</span>
            </button>
        ) : (
            <button className="mindo-toolbar-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Select multiple to group">
                <BoxSelect size={18} />
            </button>
        )}

        {canAlign && onAlign && (
            <>
                <div className="mindo-toolbar-separator" />
                <button onClick={() => onAlign('horizontal')} className="mindo-toolbar-btn" title="Align Horizontally">
                    <AlignCenterVertical size={18} />
                </button>
                <button onClick={() => onAlign('vertical')} className="mindo-toolbar-btn" title="Align Vertically">
                    <AlignCenterHorizontal size={18} />
                </button>
            </>
        )}

        <div className="mindo-toolbar-separator" />

        <button
          onClick={onAiExpand}
          className="mindo-ai-btn"
          disabled={isAiLoading}
        >
          <Sparkles size={16} className={isAiLoading ? 'animate-spin' : ''} />
          {isAiLoading ? 'Thinking...' : 'Expand'}
        </button>

        <div className="mindo-toolbar-separator" />

        <button onClick={onZoomOut} className="mindo-toolbar-btn" title="Zoom Out">
          <Minus size={18} />
        </button>
        
        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af', width: '3rem', textAlign: 'center', userSelect: 'none' }}>
          {Math.round(scale * 100)}%
        </span>

        <button onClick={onZoomIn} className="mindo-toolbar-btn" title="Zoom In">
          <Plus size={18} />
        </button>
      </div>

      <div className="mindo-toolbar-group">
        <button onClick={onFitView} className="mindo-toolbar-btn" title="Fit to View">
          <Maximize size={18} />
        </button>
        <button onClick={onReset} className="mindo-toolbar-btn" title="Reset Canvas">
          <RefreshCcw size={18} />
        </button>
      </div>
    </div>
  );
};
