import { MindMapNode, MindMapEdge } from '../types';

export const generateMarkdown = (nodes: MindMapNode[], edges: MindMapEdge[]): string => {
    // 1. Build Adjacency List (Parent -> Children)
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    nodes.forEach(n => {
        adj.set(n.id, []);
        inDegree.set(n.id, 0);
    });

    edges.forEach(e => {
        if (adj.has(e.from)) {
            adj.get(e.from)?.push(e.to);
            inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
        }
    });

    // 2. Identify Root Nodes (In-degree 0)
    // Filter out group nodes from being strictly "content roots", 
    // unless they contain nodes, but usually we just want the content structure.
    // However, if a node is inside a group (parentId), it is visually a child of that group.
    // For markdown export, let's treat visual connection (edges) as the primary hierarchy.
    // If a node has no incoming edges, it's a root.
    
    const roots = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);

    // Sort roots by Y position (top to bottom)
    roots.sort((a, b) => a.y - b.y);

    let markdownOutput = "";

    // 3. DFS Traversal to build Markdown
    const visited = new Set<string>();

    const processNode = (nodeId: string, depth: number) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // Skip Images or Groups in text export if desired, or just export title
        if (node.type === 'image') {
            // Optional: Export image as markdown image?
            // Since imageUrl is dataURL, it might be huge. Let's skip or just put title.
            // markdownOutput += `${"#".repeat(depth + 1)} Image: ${node.title}\n\n`;
            return;
        }

        // Heading formatting
        // Level 1 (#), Level 2 (##), etc.
        const headingPrefix = "#".repeat(Math.min(depth + 1, 6)); 
        
        // If depth > 5, maybe use bullet points? 
        // For now, let's stick to headings for structure, or bullet points for deep nesting.
        
        if (depth < 6) {
            markdownOutput += `${headingPrefix} ${node.title}\n`;
        } else {
            markdownOutput += `${"  ".repeat(depth - 6)}- **${node.title}**\n`;
        }

        if (node.content && node.content.trim()) {
            markdownOutput += `\n${node.content.trim()}\n`;
        }
        
        markdownOutput += "\n";

        // Get children
        const childrenIds = adj.get(nodeId) || [];
        // Sort children by Y position (or X if same Y)
        const childrenNodes = childrenIds
            .map(id => nodes.find(n => n.id === id))
            .filter((n): n is MindMapNode => !!n)
            .sort((a, b) => a.y - b.y || a.x - b.x);

        childrenNodes.forEach(child => {
            processNode(child.id, depth + 1);
        });
    };

    roots.forEach(root => {
        processNode(root.id, 0);
        markdownOutput += "---\n\n"; // Separator for unconnected trees
    });

    return markdownOutput.trim();
};