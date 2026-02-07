
import React from 'react';
import { Minus, Plus, Maximize, Sparkles, RefreshCcw, Download, Image as ImageIcon, Layout, BoxSelect } from 'lucide-react';

interface ToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
  onAiExpand: () => void;
  onAddGroup: () => void;
  onExportImage: () => void;
  isAiLoading: boolean;
  canGroup: boolean;
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
  isAiLoading,
  canGroup
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
      {/* File Operations */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl border border-gray-200 dark:border-gray-700 rounded-2xl p-2 flex items-center gap-1">
        <button onClick={onExportImage} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300" title="Export as Image">
            <ImageIcon size={18} />
        </button>
      </div>

      {/* Main Controls */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl border border-gray-200 dark:border-gray-700 rounded-2xl p-2 flex items-center gap-1">
        
        {canGroup && (
             <button onClick={onAddGroup} className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-blue-600 dark:text-blue-300 flex items-center gap-1 animate-in fade-in" title="Group Selected">
                <BoxSelect size={18} />
                <span className="text-xs font-semibold hidden sm:inline">Group</span>
            </button>
        )}
        
        {!canGroup && (
            <button className="p-2 rounded-xl text-gray-300 dark:text-gray-600 cursor-not-allowed flex items-center gap-1" title="Select multiple to group">
                <BoxSelect size={18} />
            </button>
        )}

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        <button
          onClick={onAiExpand}
          className={`px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all
            ${isAiLoading ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-md hover:scale-105'}
          `}
          disabled={isAiLoading}
        >
          <Sparkles size={16} className={isAiLoading ? 'animate-spin' : ''} />
          {isAiLoading ? 'Thinking...' : 'Expand'}
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        <button onClick={onZoomOut} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300" title="Zoom Out">
          <Minus size={18} />
        </button>
        
        <span className="text-xs font-mono text-gray-400 w-12 text-center select-none">
          {Math.round(scale * 100)}%
        </span>

        <button onClick={onZoomIn} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300" title="Zoom In">
          <Plus size={18} />
        </button>
      </div>

      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl border border-gray-200 dark:border-gray-700 rounded-2xl p-2 flex items-center gap-1">
        <button onClick={onFitView} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300" title="Fit to View">
          <Maximize size={18} />
        </button>
        <button onClick={onReset} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300" title="Reset Canvas">
          <RefreshCcw size={18} />
        </button>
      </div>
    </div>
  );
};
