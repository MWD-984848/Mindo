
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

// Broken down styles for more granular control (Title bar vs Border vs Content)
export const NODE_STYLES: Record<NodeColor, { bg: string; border: string; text: string; selection: string }> = {
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-200', text: 'text-yellow-900', selection: 'ring-yellow-400' },
  green: { bg: 'bg-green-100', border: 'border-green-200', text: 'text-green-900', selection: 'ring-green-400' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-900', selection: 'ring-blue-400' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-900', selection: 'ring-purple-400' },
  red: { bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-900', selection: 'ring-red-400' },
  gray: { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-900', selection: 'ring-gray-400' },
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
