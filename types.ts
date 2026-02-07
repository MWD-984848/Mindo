
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

export const NODE_STYLES: Record<NodeColor, { bg: string; border: string; text: string; selection: string; headerBg: string; picker: string }> = {
  yellow: { 
      bg: 'bg-yellow-50 dark:bg-[#423e2a]', 
      headerBg: 'bg-yellow-100 dark:bg-[#5c5428]',
      border: 'border-yellow-200 dark:border-yellow-700', 
      text: 'text-yellow-900 dark:text-yellow-100', 
      selection: 'ring-yellow-400',
      picker: '#facc15'
  },
  green: { 
      bg: 'bg-green-50 dark:bg-[#1e3a29]', 
      headerBg: 'bg-green-100 dark:bg-[#275236]',
      border: 'border-green-200 dark:border-green-700', 
      text: 'text-green-900 dark:text-green-100', 
      selection: 'ring-green-400',
      picker: '#4ade80'
  },
  blue: { 
      bg: 'bg-blue-50 dark:bg-[#1e2a3a]', 
      headerBg: 'bg-blue-100 dark:bg-[#274060]',
      border: 'border-blue-200 dark:border-blue-700', 
      text: 'text-blue-900 dark:text-blue-100', 
      selection: 'ring-blue-400',
      picker: '#60a5fa'
  },
  purple: { 
      bg: 'bg-purple-50 dark:bg-[#34243e]', 
      headerBg: 'bg-purple-100 dark:bg-[#4d3260]',
      border: 'border-purple-200 dark:border-purple-700', 
      text: 'text-purple-900 dark:text-purple-100', 
      selection: 'ring-purple-400',
      picker: '#c084fc'
  },
  red: { 
      bg: 'bg-red-50 dark:bg-[#3e2424]', 
      headerBg: 'bg-red-100 dark:bg-[#603232]',
      border: 'border-red-200 dark:border-red-700', 
      text: 'text-red-900 dark:text-red-100', 
      selection: 'ring-red-400',
      picker: '#f87171'
  },
  gray: { 
      bg: 'bg-gray-50 dark:bg-[#2a2a2a]', 
      headerBg: 'bg-gray-100 dark:bg-[#404040]',
      border: 'border-gray-200 dark:border-gray-600', 
      text: 'text-gray-900 dark:text-gray-100', 
      selection: 'ring-gray-400',
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
