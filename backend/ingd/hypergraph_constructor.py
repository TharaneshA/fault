"""
Hypergraph Constructor for Multi-Way Cascade Modeling.

This module constructs hypergraphs from causal structure to capture
multi-way cascading failures that pairwise edges cannot represent.

Reference: Zheng et al., "CHASE: Root Cause Analysis via Heterogeneous
Graph Learning and Causal Hypergraph", arXiv 2024
"""
import numpy as np
import networkx as nx
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass
from loguru import logger

from config import HypergraphConfig


@dataclass
class Hyperedge:
    """
    Represents a hyperedge connecting multiple nodes.

    In the context of RCA, a hyperedge represents a cascade path
    where a failure in the source propagates through intermediate
    nodes to affect all nodes in the hyperedge.
    """
    id: str
    nodes: List[int]  # All nodes involved in this cascade
    source: int  # Root cause node
    weight: float  # Strength/confidence of this cascade
    path: List[int]  # Ordered path from source through cascade

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        if isinstance(other, Hyperedge):
            return self.id == other.id
        return False


class Hypergraph:
    """
    Hypergraph data structure for representing multi-way relationships.

    Unlike regular graphs where edges connect exactly two nodes,
    hyperedges can connect any number of nodes, enabling representation
    of complex cascade patterns.
    """

    def __init__(self, node_names: Optional[List[str]] = None):
        """
        Initialize hypergraph.

        Args:
            node_names: Names of nodes (metrics/services)
        """
        self.nodes: Set[int] = set()
        self.node_names: Dict[int, str] = {}
        self.hyperedges: Dict[str, Hyperedge] = {}
        self.node_to_hyperedges: Dict[int, Set[str]] = {}

        if node_names:
            for i, name in enumerate(node_names):
                self.add_node(i, name)

    def add_node(self, node_id: int, name: Optional[str] = None):
        """Add a node to the hypergraph."""
        self.nodes.add(node_id)
        self.node_names[node_id] = name or f"node_{node_id}"
        if node_id not in self.node_to_hyperedges:
            self.node_to_hyperedges[node_id] = set()

    def add_hyperedge(self, hyperedge: Hyperedge):
        """Add a hyperedge to the hypergraph."""
        self.hyperedges[hyperedge.id] = hyperedge

        # Update node-to-hyperedge mapping
        for node in hyperedge.nodes:
            if node not in self.node_to_hyperedges:
                self.node_to_hyperedges[node] = set()
            self.node_to_hyperedges[node].add(hyperedge.id)

    def get_hyperedges_for_node(self, node_id: int) -> List[Hyperedge]:
        """Get all hyperedges containing a given node."""
        edge_ids = self.node_to_hyperedges.get(node_id, set())
        return [self.hyperedges[eid] for eid in edge_ids]

    def get_source_hyperedges(self, node_id: int) -> List[Hyperedge]:
        """Get all hyperedges where the node is the source (root cause)."""
        return [
            edge for edge in self.hyperedges.values()
            if edge.source == node_id
        ]

    def compute_node_influence(self, node_id: int) -> float:
        """
        Compute the influence of a node based on hyperedge participation.

        Nodes that are sources of large, high-weight hyperedges
        have higher influence scores.
        """
        source_edges = self.get_source_hyperedges(node_id)

        if not source_edges:
            return 0.0

        # Sum of (hyperedge_size * weight) for all source hyperedges
        influence = sum(
            len(edge.nodes) * edge.weight
            for edge in source_edges
        )

        return influence

    def compute_incidence_matrix(self) -> np.ndarray:
        """
        Compute the incidence matrix H.

        H[i, j] = 1 if node i is in hyperedge j, else 0.

        Returns:
            Incidence matrix of shape (num_nodes, num_hyperedges)
        """
        num_nodes = len(self.nodes)
        num_edges = len(self.hyperedges)

        if num_edges == 0:
            return np.zeros((num_nodes, 0))

        H = np.zeros((num_nodes, num_edges))

        node_list = sorted(self.nodes)
        node_to_idx = {n: i for i, n in enumerate(node_list)}

        for j, edge in enumerate(self.hyperedges.values()):
            for node in edge.nodes:
                if node in node_to_idx:
                    H[node_to_idx[node], j] = 1

        return H

    def to_dict(self) -> Dict[str, Any]:
        """Convert hypergraph to dictionary for serialization."""
        return {
            "nodes": [
                {"id": int(n), "name": self.node_names.get(n, f"node_{n}")}
                for n in sorted(self.nodes)
            ],
            "hyperedges": [
                {
                    "id": edge.id,
                    "nodes": [int(n) for n in edge.nodes],
                    "source": int(edge.source),
                    "weight": float(edge.weight),
                    "path": [int(n) for n in edge.path]
                }
                for edge in self.hyperedges.values()
            ]
        }


class HypergraphConstructor:
    """
    Constructs hypergraphs from causal structure.

    Transforms pairwise causal edges into hyperedges that capture
    entire cascade paths, enabling more accurate root cause analysis.
    """

    def __init__(self, config: Optional[HypergraphConfig] = None):
        """
        Initialize the hypergraph constructor.

        Args:
            config: Hypergraph configuration
        """
        self.config = config or HypergraphConfig()

    def construct(
        self,
        causal_matrix: np.ndarray,
        node_names: Optional[List[str]] = None,
        anomaly_mask: Optional[np.ndarray] = None
    ) -> Hypergraph:
        """
        Construct hypergraph from causal adjacency matrix.

        Args:
            causal_matrix: Causal weight matrix of shape (n, n)
            node_names: Names of nodes
            anomaly_mask: Boolean mask indicating which nodes are anomalous

        Returns:
            Constructed Hypergraph
        """
        num_nodes = causal_matrix.shape[0]
        node_names = node_names or [f"node_{i}" for i in range(num_nodes)]

        # Create directed graph from causal matrix
        G = self._matrix_to_graph(causal_matrix)

        # Initialize hypergraph
        hypergraph = Hypergraph(node_names)

        # Find cascade paths and convert to hyperedges
        hyperedges = self._extract_cascade_hyperedges(G, causal_matrix, anomaly_mask)

        for edge in hyperedges:
            hypergraph.add_hyperedge(edge)

        logger.info(f"Constructed hypergraph with {len(hypergraph.nodes)} nodes "
                   f"and {len(hypergraph.hyperedges)} hyperedges")

        return hypergraph

    def _matrix_to_graph(self, causal_matrix: np.ndarray) -> nx.DiGraph:
        """Convert causal matrix to directed graph."""
        G = nx.DiGraph()
        num_nodes = causal_matrix.shape[0]

        for i in range(num_nodes):
            G.add_node(i)

        for i in range(num_nodes):
            for j in range(num_nodes):
                if i != j and causal_matrix[i, j] > self.config.edge_weight_threshold:
                    G.add_edge(i, j, weight=causal_matrix[i, j])

        return G

    def _extract_cascade_hyperedges(
        self,
        G: nx.DiGraph,
        causal_matrix: np.ndarray,
        anomaly_mask: Optional[np.ndarray] = None
    ) -> List[Hyperedge]:
        """
        Extract cascade paths and convert to hyperedges.

        A cascade hyperedge captures an entire failure propagation path
        from a root cause through downstream services.
        """
        hyperedges = []
        edge_id_counter = 0

        # Find all nodes with high out-degree (potential root causes)
        out_degrees = dict(G.out_degree())
        potential_sources = [
            n for n, d in out_degrees.items()
            if d > 0
        ]

        # If anomaly mask provided, prioritize anomalous nodes
        if anomaly_mask is not None:
            anomalous_nodes = set(np.where(anomaly_mask)[0])
            potential_sources = [
                n for n in potential_sources
                if n in anomalous_nodes
            ] or potential_sources

        # For each potential source, find cascade paths
        for source in potential_sources:
            paths = self._find_cascade_paths(G, source)

            for path in paths:
                if len(path) < self.config.min_cascade_length:
                    continue

                # Compute hyperedge weight as product of edge weights along path
                path_weight = 1.0
                for i in range(len(path) - 1):
                    edge_weight = causal_matrix[path[i], path[i + 1]]
                    path_weight *= edge_weight

                # All nodes in the cascade are part of the hyperedge
                hyperedge = Hyperedge(
                    id=f"cascade_{edge_id_counter}",
                    nodes=path,
                    source=source,
                    weight=path_weight,
                    path=path
                )

                hyperedges.append(hyperedge)
                edge_id_counter += 1

        # Merge overlapping cascades into larger hyperedges
        merged_hyperedges = self._merge_overlapping_cascades(hyperedges)

        return merged_hyperedges

    def _find_cascade_paths(
        self,
        G: nx.DiGraph,
        source: int
    ) -> List[List[int]]:
        """
        Find cascade paths originating from a source node.

        Uses DFS to explore paths up to max_cascade_length.
        Limited to max_paths_per_source for performance.
        """
        paths = []
        max_paths = getattr(self.config, 'max_paths_per_source', 20)

        def dfs(current: int, path: List[int], visited: Set[int]):
            # Stop if we have enough paths
            if len(paths) >= max_paths:
                return

            if len(path) >= self.config.max_cascade_length:
                if len(path) >= self.config.min_cascade_length:
                    paths.append(path.copy())
                return

            # Get successors
            successors = list(G.successors(current))

            if not successors:
                # End of path
                if len(path) >= self.config.min_cascade_length:
                    paths.append(path.copy())
                return

            for next_node in successors:
                if len(paths) >= max_paths:
                    return
                if next_node not in visited:
                    path.append(next_node)
                    visited.add(next_node)
                    dfs(next_node, path, visited)
                    path.pop()
                    visited.remove(next_node)

            # Also record current path if it meets minimum length
            if len(path) >= self.config.min_cascade_length and len(paths) < max_paths:
                paths.append(path.copy())

        # Start DFS from source
        dfs(source, [source], {source})

        # Remove duplicate paths
        unique_paths = []
        seen = set()
        for path in paths:
            path_tuple = tuple(path)
            if path_tuple not in seen:
                seen.add(path_tuple)
                unique_paths.append(path)

        return unique_paths

    def _merge_overlapping_cascades(
        self,
        hyperedges: List[Hyperedge]
    ) -> List[Hyperedge]:
        """
        Merge cascades that share the same source and significant overlap.

        This reduces redundancy and creates more comprehensive hyperedges.
        """
        if not hyperedges:
            return []

        # Group by source
        source_groups: Dict[int, List[Hyperedge]] = {}
        for edge in hyperedges:
            if edge.source not in source_groups:
                source_groups[edge.source] = []
            source_groups[edge.source].append(edge)

        merged = []
        merge_id = 0

        for source, edges in source_groups.items():
            if len(edges) == 1:
                merged.append(edges[0])
                continue

            # Sort by size (descending)
            edges.sort(key=lambda e: len(e.nodes), reverse=True)

            # Greedy merging
            used = set()
            for i, edge1 in enumerate(edges):
                if i in used:
                    continue

                merged_nodes = set(edge1.nodes)
                merged_weight = edge1.weight
                merged_path = edge1.path

                for j, edge2 in enumerate(edges[i + 1:], start=i + 1):
                    if j in used:
                        continue

                    # Check overlap
                    overlap = len(set(edge2.nodes) & merged_nodes)
                    overlap_ratio = overlap / len(edge2.nodes)

                    if overlap_ratio > 0.5:
                        # Merge
                        merged_nodes.update(edge2.nodes)
                        merged_weight = max(merged_weight, edge2.weight)
                        used.add(j)

                # Create merged hyperedge
                merged_edge = Hyperedge(
                    id=f"merged_cascade_{merge_id}",
                    nodes=sorted(merged_nodes),
                    source=source,
                    weight=merged_weight,
                    path=merged_path
                )
                merged.append(merged_edge)
                merge_id += 1
                used.add(i)

        return merged

    def compute_hypergraph_features(
        self,
        hypergraph: Hypergraph,
        anomaly_scores: Optional[np.ndarray] = None
    ) -> Dict[int, Dict[str, float]]:
        """
        Compute node features from hypergraph structure.

        Features include:
        - influence: How many cascades originate from this node
        - participation: How many hyperedges contain this node
        - centrality: Weighted centrality in hypergraph
        - cascade_impact: Total impact of cascades from this node

        Args:
            hypergraph: Constructed hypergraph
            anomaly_scores: Pre-computed anomaly scores

        Returns:
            Dictionary mapping node_id to feature dictionary
        """
        features = {}

        for node in hypergraph.nodes:
            # Get hyperedges for this node
            node_edges = hypergraph.get_hyperedges_for_node(node)
            source_edges = hypergraph.get_source_hyperedges(node)

            # Influence: number of cascades this node causes
            influence = len(source_edges)

            # Participation: number of cascades this node is part of
            participation = len(node_edges)

            # Cascade impact: total size of cascades originating from this node
            cascade_impact = sum(len(e.nodes) for e in source_edges)

            # Weighted centrality
            total_weight = sum(e.weight for e in node_edges) if node_edges else 0

            features[node] = {
                "influence": float(influence),
                "participation": float(participation),
                "cascade_impact": float(cascade_impact),
                "centrality": float(total_weight),
                "anomaly_score": float(anomaly_scores[node]) if anomaly_scores is not None else 0.0
            }

        return features
