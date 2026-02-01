/**
 * Transaction Graph Module
 * 
 * Provides data structures and algorithms for analyzing transaction relationships
 * and account linkages across the Solana network.
 */

/**
 * Node types in the transaction graph
 */
export type NodeType = 'transaction' | 'account' | 'program' | 'token';

/**
 * Edge types representing relationships
 */
export type EdgeType = 
    | 'signed'        // Account signed a transaction
    | 'participated'  // Account was involved in transaction
    | 'funded'        // Account funded another
    | 'transferred'   // Asset transfer between accounts
    | 'swapped'       // Swap relationship
    | 'minted'        // Token mint relationship
    | 'burned';       // Token burn relationship

/**
 * Node in the transaction graph
 */
export interface TransactionNode {
    readonly id: string;
    readonly type: NodeType;
    readonly label: string;
    readonly metadata: Record<string, unknown>;
}

/**
 * Edge in the transaction graph
 */
export interface TransactionEdge {
    readonly source: string;
    readonly target: string;
    readonly type: EdgeType;
    readonly weight: number;
    readonly metadata?: Record<string, unknown>;
}

/**
 * Path through the graph
 */
export interface GraphPath {
    readonly nodes: readonly string[];
    readonly edges: readonly TransactionEdge[];
    readonly totalWeight: number;
    readonly hopCount: number;
}

/**
 * Cluster of related nodes
 */
export interface NodeCluster {
    readonly id: string;
    readonly nodes: readonly string[];
    readonly cohesion: number;
    readonly label: string;
}

/**
 * Graph analysis metrics
 */
export interface GraphMetrics {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly density: number;
    readonly averageDegree: number;
    readonly connectedComponents: number;
    readonly largestComponentSize: number;
}

/**
 * TransactionGraph - Graph structure for transaction analysis
 * 
 * Used for:
 * - Tracking account relationships
 * - Finding shortest paths between addresses
 * - Identifying clusters of related accounts
 * - Detecting privacy leaks through graph analysis
 */
export class TransactionGraph {
    private nodes: Map<string, TransactionNode> = new Map();
    private edges: TransactionEdge[] = [];
    private adjacencyList: Map<string, Set<string>> = new Map();
    private reverseAdjacency: Map<string, Set<string>> = new Map();

    /**
     * Add a node to the graph
     */
    public addNode(node: TransactionNode): void {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
            this.adjacencyList.set(node.id, new Set());
            this.reverseAdjacency.set(node.id, new Set());
        }
    }

    /**
     * Add an edge to the graph
     */
    public addEdge(edge: TransactionEdge): void {
        // Ensure nodes exist
        if (!this.nodes.has(edge.source)) {
            this.addNode({
                id: edge.source,
                type: 'account',
                label: 'unknown',
                metadata: {}
            });
        }
        if (!this.nodes.has(edge.target)) {
            this.addNode({
                id: edge.target,
                type: 'account',
                label: 'unknown',
                metadata: {}
            });
        }

        this.edges.push(edge);
        this.adjacencyList.get(edge.source)?.add(edge.target);
        this.reverseAdjacency.get(edge.target)?.add(edge.source);
    }

    /**
     * Get a node by ID
     */
    public getNode(id: string): TransactionNode | undefined {
        return this.nodes.get(id);
    }

    /**
     * Get all nodes
     */
    public getNodes(): TransactionNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get all edges
     */
    public getEdges(): TransactionEdge[] {
        return [...this.edges];
    }

    /**
     * Get edges from a specific node
     */
    public getOutgoingEdges(nodeId: string): TransactionEdge[] {
        return this.edges.filter(e => e.source === nodeId);
    }

    /**
     * Get edges to a specific node
     */
    public getIncomingEdges(nodeId: string): TransactionEdge[] {
        return this.edges.filter(e => e.target === nodeId);
    }

    /**
     * Get neighbors of a node
     */
    public getNeighbors(nodeId: string): string[] {
        const outgoing = this.adjacencyList.get(nodeId) ?? new Set();
        const incoming = this.reverseAdjacency.get(nodeId) ?? new Set();
        return [...new Set([...outgoing, ...incoming])];
    }

    /**
     * Find shortest path between two nodes using BFS
     */
    public findShortestPath(source: string, target: string): GraphPath | null {
        if (!this.nodes.has(source) || !this.nodes.has(target)) {
            return null;
        }

        if (source === target) {
            return {
                nodes: [source],
                edges: [],
                totalWeight: 0,
                hopCount: 0
            };
        }

        const visited = new Set<string>();
        const queue: { node: string; path: string[]; edges: TransactionEdge[] }[] = [];
        queue.push({ node: source, path: [source], edges: [] });
        visited.add(source);

        while (queue.length > 0) {
            const current = queue.shift()!;
            const neighbors = this.getNeighbors(current.node);

            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) continue;

                const edge = this.edges.find(
                    e => (e.source === current.node && e.target === neighbor) ||
                         (e.target === current.node && e.source === neighbor)
                );

                const newPath = [...current.path, neighbor];
                const newEdges = edge ? [...current.edges, edge] : current.edges;

                if (neighbor === target) {
                    const totalWeight = newEdges.reduce((sum, e) => sum + e.weight, 0);
                    return {
                        nodes: newPath,
                        edges: newEdges,
                        totalWeight,
                        hopCount: newPath.length - 1
                    };
                }

                visited.add(neighbor);
                queue.push({ node: neighbor, path: newPath, edges: newEdges });
            }
        }

        return null;
    }

    /**
     * Find all paths between two nodes up to a maximum depth
     */
    public findAllPaths(source: string, target: string, maxDepth: number = 5): GraphPath[] {
        const paths: GraphPath[] = [];
        
        const dfs = (
            current: string,
            visited: Set<string>,
            path: string[],
            edges: TransactionEdge[]
        ): void => {
            if (path.length > maxDepth) return;

            if (current === target) {
                const totalWeight = edges.reduce((sum, e) => sum + e.weight, 0);
                paths.push({
                    nodes: [...path],
                    edges: [...edges],
                    totalWeight,
                    hopCount: path.length - 1
                });
                return;
            }

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) continue;

                const edge = this.edges.find(
                    e => (e.source === current && e.target === neighbor) ||
                         (e.target === current && e.source === neighbor)
                );

                visited.add(neighbor);
                path.push(neighbor);
                if (edge) edges.push(edge);

                dfs(neighbor, visited, path, edges);

                visited.delete(neighbor);
                path.pop();
                if (edge) edges.pop();
            }
        };

        const visited = new Set<string>([source]);
        dfs(source, visited, [source], []);

        return paths;
    }

    /**
     * Get degree (number of connections) for a node
     */
    public getDegree(nodeId: string): number {
        const outDegree = this.adjacencyList.get(nodeId)?.size ?? 0;
        const inDegree = this.reverseAdjacency.get(nodeId)?.size ?? 0;
        return outDegree + inDegree;
    }

    /**
     * Find connected components using BFS
     */
    public findConnectedComponents(): string[][] {
        const visited = new Set<string>();
        const components: string[][] = [];

        for (const nodeId of this.nodes.keys()) {
            if (visited.has(nodeId)) continue;

            const component: string[] = [];
            const queue = [nodeId];
            visited.add(nodeId);

            while (queue.length > 0) {
                const current = queue.shift()!;
                component.push(current);

                for (const neighbor of this.getNeighbors(current)) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            components.push(component);
        }

        return components;
    }

    /**
     * Identify clusters of related accounts
     */
    public identifyClusters(): NodeCluster[] {
        const components = this.findConnectedComponents();
        
        return components.map((nodes, index) => {
            // Calculate cohesion as edge count / possible edges
            const internalEdges = this.edges.filter(
                e => nodes.includes(e.source) && nodes.includes(e.target)
            ).length;
            const possibleEdges = (nodes.length * (nodes.length - 1)) / 2;
            const cohesion = possibleEdges > 0 ? internalEdges / possibleEdges : 0;

            return {
                id: `cluster-${index}`,
                nodes,
                cohesion,
                label: `Cluster ${index + 1} (${nodes.length} accounts)`
            };
        });
    }

    /**
     * Calculate graph metrics
     */
    public getMetrics(): GraphMetrics {
        const nodeCount = this.nodes.size;
        const edgeCount = this.edges.length;
        
        // Density = E / (V * (V - 1))
        const possibleEdges = nodeCount * (nodeCount - 1);
        const density = possibleEdges > 0 ? edgeCount / possibleEdges : 0;

        // Average degree
        let totalDegree = 0;
        for (const nodeId of this.nodes.keys()) {
            totalDegree += this.getDegree(nodeId);
        }
        const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;

        // Connected components
        const components = this.findConnectedComponents();
        const largestComponentSize = Math.max(...components.map(c => c.length), 0);

        return {
            nodeCount,
            edgeCount,
            density,
            averageDegree,
            connectedComponents: components.length,
            largestComponentSize
        };
    }

    /**
     * Find high-centrality nodes (potential privacy hubs)
     */
    public findHighCentralityNodes(topN: number = 10): { nodeId: string; centrality: number }[] {
        const centralities: { nodeId: string; centrality: number }[] = [];

        for (const nodeId of this.nodes.keys()) {
            // Use degree centrality as a simple measure
            const degree = this.getDegree(nodeId);
            const centrality = this.nodes.size > 1 ? degree / (this.nodes.size - 1) : 0;
            centralities.push({ nodeId, centrality });
        }

        return centralities
            .sort((a, b) => b.centrality - a.centrality)
            .slice(0, topN);
    }

    /**
     * Detect potential privacy leaks through graph analysis
     */
    public detectPrivacyLeaks(walletAddress: string): {
        directLinks: string[];
        shortPaths: GraphPath[];
        centralHubs: string[];
    } {
        // Find direct connections
        const directLinks = this.getNeighbors(walletAddress);

        // Find short paths to high-centrality nodes (CEX, DEX, etc.)
        const centralNodes = this.findHighCentralityNodes(5).map(n => n.nodeId);
        const shortPaths: GraphPath[] = [];
        
        for (const central of centralNodes) {
            if (central === walletAddress) continue;
            const path = this.findShortestPath(walletAddress, central);
            if (path && path.hopCount <= 3) {
                shortPaths.push(path);
            }
        }

        return {
            directLinks,
            shortPaths,
            centralHubs: centralNodes
        };
    }

    /**
     * Export graph to DOT format for visualization
     */
    public toDot(): string {
        let dot = 'digraph TransactionGraph {\n';
        dot += '  rankdir=LR;\n';
        dot += '  node [shape=box];\n\n';

        // Add nodes
        for (const node of this.nodes.values()) {
            const color = node.type === 'transaction' ? 'lightblue' :
                          node.type === 'account' ? 'lightgreen' :
                          node.type === 'program' ? 'lightyellow' : 'white';
            dot += `  "${node.id.slice(0, 8)}" [label="${node.label}" fillcolor="${color}" style="filled"];\n`;
        }

        dot += '\n';

        // Add edges
        for (const edge of this.edges) {
            const style = edge.type === 'signed' ? 'bold' :
                          edge.type === 'transferred' ? 'dashed' : 'solid';
            dot += `  "${edge.source.slice(0, 8)}" -> "${edge.target.slice(0, 8)}" [style="${style}" label="${edge.type}"];\n`;
        }

        dot += '}\n';
        return dot;
    }

    /**
     * Clear the graph
     */
    public clear(): void {
        this.nodes.clear();
        this.edges = [];
        this.adjacencyList.clear();
        this.reverseAdjacency.clear();
    }

    /**
     * Merge another graph into this one
     */
    public merge(other: TransactionGraph): void {
        for (const node of other.getNodes()) {
            this.addNode(node);
        }
        for (const edge of other.getEdges()) {
            this.addEdge(edge);
        }
    }

    /**
     * Create a subgraph containing only nodes within N hops of a source
     */
    public subgraph(sourceId: string, maxHops: number): TransactionGraph {
        const subgraph = new TransactionGraph();
        const visited = new Set<string>();
        const queue: { nodeId: string; depth: number }[] = [{ nodeId: sourceId, depth: 0 }];

        while (queue.length > 0) {
            const { nodeId, depth } = queue.shift()!;
            
            if (visited.has(nodeId) || depth > maxHops) continue;
            visited.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node) {
                subgraph.addNode(node);
            }

            if (depth < maxHops) {
                for (const neighbor of this.getNeighbors(nodeId)) {
                    if (!visited.has(neighbor)) {
                        queue.push({ nodeId: neighbor, depth: depth + 1 });
                    }
                }
            }
        }

        // Add edges between visited nodes
        for (const edge of this.edges) {
            if (visited.has(edge.source) && visited.has(edge.target)) {
                subgraph.addEdge(edge);
            }
        }

        return subgraph;
    }
}
