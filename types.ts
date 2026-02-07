
export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type NodeColor = 'yellow' | 'green' | 'blue' | 'purple' | 'red' | 'gray';
export type HandlePosition = 'top' | 'right' | 'bottom' | 'left';
export type EdgeStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeArrow = 'none' | 'to' | 'from' | 'both';
export type EdgeType = 'bezier' | 'straight' | 'step';

export interface MindoSettings {
  aiProvider: 'gemini' | 'openai';
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}

export interface MindMapNode {
  id: string;
  type?: 'node' | 'group'; // Distinguish between standard nodes and groups
  title: string;
  content?: string; // Optional body content
  x: number;
  y: number;
  width: number;
  height: number;
  color: NodeColor;
  parentId?: string; // For tree structure logic
}

export interface MindMapEdge {
  id: string;
  from: string;
  to: string;
  fromHandle: HandlePosition;
  toHandle: HandlePosition;
  // New features
  label?: string;
  style?: EdgeStyle;
  color?: string; // Hex code or standard color name
  arrow?: EdgeArrow;
  type?: EdgeType; // bezier, straight, step
  breakpoints?: Position[]; // List of intermediate control points
  controlPoint?: Position; // Deprecated in favor of breakpoints, kept for backward compat or single bezier control
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export const NODE_STYLES: Record<NodeColor, { className: string; picker: string }> = {
  yellow: { 
      className: 'mindo-theme-yellow',
      picker: '#facc15'
  },
  green: { 
      className: 'mindo-theme-green',
      picker: '#4ade80'
  },
  blue: { 
      className: 'mindo-theme-blue',
      picker: '#60a5fa'
  },
  purple: { 
      className: 'mindo-theme-purple',
      picker: '#c084fc'
  },
  red: { 
      className: 'mindo-theme-red',
      picker: '#f87171'
  },
  gray: { 
      className: 'mindo-theme-gray',
      picker: '#9ca3af'
  },
};

export const COLOR_PALETTE: NodeColor[] = ['yellow', 'green', 'blue', 'purple', 'red', 'gray'];

export const EDGE_COLORS = [
    '#94a3b8', // Slate (Default)
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#171717', // Black
];
