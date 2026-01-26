/**
 * API Client for Fault.ai Backend
 *
 * This module provides typed API functions for communicating with
 * the Python backend (INGD and future CMEA/CCRE components).
 */

// Backend base URL - will be provided by Tauri command
const BACKEND_URL = "http://127.0.0.1:8765";

// Types for API responses

export interface RootCause {
  node_id: number;
  node_name: string;
  confidence: number;
  rank: number;
  anomaly_score: number;
  causal_score: number;
  cascade_score: number;
  details: {
    affects: Array<{ name: string; strength: number }>;
    affected_by: Array<{ name: string; strength: number }>;
    cascades: Array<{
      id: string;
      path: string[];
      size: number;
      weight: number;
    }>;
    total_cascade_impact: number;
  };
}

export interface CausalGraphNode {
  id: number;
  name: string;
}

export interface CausalGraphEdge {
  source: number;
  target: number;
  source_name: string;
  target_name: string;
  weight: number;
}

export interface CausalGraph {
  nodes: CausalGraphNode[];
  edges: CausalGraphEdge[];
}

export interface HypergraphNode {
  id: number;
  name: string;
}

export interface HypergraphEdge {
  id: string;
  nodes: number[];
  source: number;
  weight: number;
  path: number[];
}

export interface Hypergraph {
  nodes: HypergraphNode[];
  hyperedges: HypergraphEdge[];
}

export interface AnalysisResult {
  success: boolean;
  root_causes: RootCause[];
  causal_graph: CausalGraph;
  hypergraph: Hypergraph;
  metadata: {
    metric_names: string[];
    num_metrics: number;
    time_steps: number;
    input_mode: string;
    anomalous_metrics: number;
    ground_truth?: string;
    fault_type?: string;
    num_subsets?: number;
    edge_count?: number;
    density?: number;
  };
}

export interface DatasetInfo {
  name: string;
  num_cases: number;
  cases: string[];
}

export interface CaseInfo {
  case_id: string;
  num_metrics: number;
  num_timesteps: number;
  metric_names: string[];
  ground_truth: string | null;
  fault_type: string | null;
}

export interface HealthStatus {
  status: string;
  service: string;
}

// API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

// API fetch helper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BACKEND_URL}/api/v1${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.detail || `Request failed with status ${response.status}`,
        response.status,
        errorData.detail
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    // Network or other errors
    throw new APIError(
      error instanceof Error ? error.message : "Network error",
      0
    );
  }
}

// API Functions

/**
 * Check if the backend is healthy
 */
export async function checkHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}

/**
 * List available datasets
 */
export async function listDatasets(): Promise<DatasetInfo[]> {
  return apiFetch<DatasetInfo[]>("/datasets");
}

/**
 * Get information about a specific case
 */
export async function getCaseInfo(
  dataset: string,
  caseId: string
): Promise<CaseInfo> {
  return apiFetch<CaseInfo>(`/datasets/${dataset}/cases/${caseId}`);
}

/**
 * Run INGD analysis on a benchmark dataset case
 */
export async function analyzeDataset(
  dataset: string,
  caseId: string,
  topK: number = 5
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>("/analyze", {
    method: "POST",
    body: JSON.stringify({
      dataset,
      case_id: caseId,
      top_k: topK,
    }),
  });
}

/**
 * Run INGD analysis on provided metrics data
 */
export async function analyzeMetrics(
  metrics: number[][],
  metricNames?: string[],
  topK: number = 5
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>("/analyze/metrics", {
    method: "POST",
    body: JSON.stringify({
      metrics,
      metric_names: metricNames,
      top_k: topK,
    }),
  });
}

/**
 * Get the latest analysis result
 */
export async function getLatestResult(): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>("/results/latest");
}

/**
 * Get just the causal graph from latest analysis
 */
export async function getCausalGraph(): Promise<CausalGraph> {
  return apiFetch<CausalGraph>("/results/causal-graph");
}

/**
 * Get just the hypergraph from latest analysis
 */
export async function getHypergraph(): Promise<Hypergraph> {
  return apiFetch<Hypergraph>("/results/hypergraph");
}

/**
 * Get root causes from latest analysis
 */
export async function getRootCauses(): Promise<{ root_causes: RootCause[] }> {
  return apiFetch<{ root_causes: RootCause[] }>("/results/root-causes");
}

/**
 * Get model status
 */
export async function getModelStatus(): Promise<{
  initialized: boolean;
  device: string;
  config: Record<string, unknown> | null;
}> {
  return apiFetch("/model/status");
}

/**
 * Reset the model and clear cached results
 */
export async function resetModel(): Promise<{ status: string; message: string }> {
  return apiFetch("/model/reset", { method: "POST" });
}

// Polling helper for backend readiness
export async function waitForBackend(
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await checkHealth();
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}
