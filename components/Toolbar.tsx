
import React, { useState } from 'react';
import { Minus, Plus, Maximize, Sparkles, RefreshCcw, Image as ImageIcon, BoxSelect, AlignCenterHorizontal, AlignCenterVertical, ChevronDown } from 'lucide-react';

interface ToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
  onAiExpand: () => void;
  onAddGroup: () => void;
  onExportImage: (pixelRatio: number) => void;
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
  const [exportRes, setExportRes] = useState('2');

  return (
    <div className="mindo-toolbar">
      
      {/* Left: Image Export */}
      <div className="mindo-toolbar-section">
        <button 
            onClick={() => onExportImage(parseInt(exportRes))} 
            className="mindo-toolbar-btn" 
            title="导出图片"
        >
            <ImageIcon size={18} />
        </button>
        
        <div className="mindo-select-container">
             <span className="mindo-select-label">{exportRes}x</span>
             <ChevronDown size={12} className="mindo-select-arrow" />
             <select 
                value={exportRes} 
                onChange={(e) => setExportRes(e.target.value)}
                className="mindo-hidden-select"
                title="导出清晰度"
            >
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
            </select>
        </div>
      </div>

      <div className="mindo-toolbar-divider" />

      {/* Middle-Left: Group & Align */}
      <button 
        onClick={onAddGroup} 
        className={`mindo-toolbar-btn ${!canGroup ? 'disabled' : ''}`} 
        title="编组"
        disabled={!canGroup}
      >
          <BoxSelect size={18} style={{ strokeDasharray: '4 2', opacity: canGroup ? 1 : 0.5 }} />
      </button>

      {canAlign && onAlign && (
          <>
            <button onClick={() => onAlign('horizontal')} className="mindo-toolbar-btn" title="水平对齐">
                <AlignCenterVertical size={18} />
            </button>
            <button onClick={() => onAlign('vertical')} className="mindo-toolbar-btn" title="垂直对齐">
                <AlignCenterHorizontal size={18} />
            </button>
          </>
      )}

      {/* Center: AI Expand */}
      <div className="mindo-toolbar-divider" />

      <button
        onClick={onAiExpand}
        className="mindo-ai-btn"
        disabled={isAiLoading}
      >
        <Sparkles size={16} className={isAiLoading ? 'animate-spin' : ''} />
        <span>AI 扩展</span>
      </button>

      <div className="mindo-toolbar-divider" />

      {/* Middle-Right: Zoom */}
      <button onClick={onZoomOut} className="mindo-toolbar-btn" title="缩小">
        <Minus size={16} />
      </button>
      
      <span className="mindo-zoom-text">
        {Math.round(scale * 100)}%
      </span>

      <button onClick={onZoomIn} className="mindo-toolbar-btn" title="放大">
        <Plus size={16} />
      </button>

      {/* Right: View Controls */}
      <div className="mindo-toolbar-divider" />

      <button onClick={onFitView} className="mindo-toolbar-btn" title="适应视图">
        <Maximize size={16} />
      </button>
      <button onClick={onReset} className="mindo-toolbar-btn" title="重置画布">
        <RefreshCcw size={16} />
      </button>
      
    </div>
  );
};
