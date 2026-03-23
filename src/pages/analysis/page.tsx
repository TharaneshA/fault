import { useState, useMemo, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Download,
  Share2,
  GitBranch,
  Clock,
  Cpu,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileText,
  ExternalLink,
  Target,
  Filter,
  ArrowUpDown,
  Search,
  Loader2,
  AlertOctagon,
} from "lucide-react"
import { CausalGraph } from "./components/causal-graph"
import { TopologyView } from "./components/topology-view"
import { TimelineView } from "./components/timeline-view"
import { ExplanationView } from "./components/explanation-view"
import { SlidePanel } from "@/components/ui/slide-panel"
import { analyzeDataset, type AnalysisResult, type CausalGraph as CausalGraphData } from "@/lib/api"

const analysisData = {
  id: "RE2-047",
  service: "ts-order-service",
  faultType: "CPU Stress",
  timestamp: "Jan 15, 2024 14:32:05",
  duration: "3m 42s",
  rootCauses: [
    { service: "ts-order-service", confidence: 0.94, rank: 1 },
    { service: "ts-travel-service", confidence: 0.78, rank: 2 },
    { service: "ts-config-service", confidence: 0.65, rank: 3 },
    { service: "ts-station-service", confidence: 0.52, rank: 4 },
    { service: "ts-route-service", confidence: 0.41, rank: 5 },
  ],
  affectedServices: 12,
  totalNodes: 45,
}

// Detailed affected services data
const affectedServicesList: AffectedService[] = [
  { name: "ts-order-service", status: "critical", latency: "+340%", errors: 127, type: "Root Cause" },
  { name: "ts-travel-service", status: "error", latency: "+180%", errors: 45, type: "Downstream" },
  { name: "ts-config-service", status: "error", latency: "+95%", errors: 23, type: "Downstream" },
  { name: "ts-station-service", status: "warning", latency: "+67%", errors: 12, type: "Downstream" },
  { name: "ts-route-service", status: "warning", latency: "+52%", errors: 8, type: "Downstream" },
  { name: "ts-gateway", status: "warning", latency: "+45%", errors: 6, type: "Upstream" },
  { name: "ts-payment-service", status: "warning", latency: "+38%", errors: 4, type: "Downstream" },
  { name: "ts-seat-service", status: "degraded", latency: "+22%", errors: 2, type: "Downstream" },
  { name: "ts-user-service", status: "degraded", latency: "+18%", errors: 1, type: "Downstream" },
  { name: "ts-price-service", status: "degraded", latency: "+15%", errors: 0, type: "Downstream" },
  { name: "ts-food-service", status: "degraded", latency: "+12%", errors: 0, type: "Downstream" },
  { name: "ts-notification-service", status: "degraded", latency: "+8%", errors: 0, type: "Downstream" },
]

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "graph", label: "Causal Graph" },
  { id: "topology", label: "Topology" },
  { id: "timeline", label: "Timeline" },
  { id: "logs", label: "Logs" },
  { id: "traces", label: "Traces" },
  { id: "explanation", label: "Explanation" },
]

export default function AnalysisPage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("overview")
  const [isAffectedPanelOpen, setIsAffectedPanelOpen] = useState(false)
  const [highlightedService, setHighlightedService] = useState<string | null>(null)

  // Backend integration state
  const isLiveCase = caseId?.startsWith("LIVE-") ?? false
  const [liveResult, setLiveResult] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [analysisTime, setAnalysisTime] = useState<number | null>(null)

  // Fetch from backend when navigating to a live case
  useEffect(() => {
    if (!isLiveCase) return
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    const start = performance.now()

    analyzeDataset("synthetic", "default", 5)
      .then((result) => {
        if (cancelled) return
        setLiveResult(result)
        setAnalysisTime(Math.round(performance.now() - start))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message || "Failed to connect to backend")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [isLiveCase])

  // Transform backend data into UI format
  const currentAnalysis = useMemo(() => {
    if (!isLiveCase || !liveResult) {
      return { data: analysisData, services: affectedServicesList, causalGraphData: undefined }
    }

    const rc = liveResult.root_causes
    const topCause = rc[0]
    const faultLabel = liveResult.metadata.fault_type
      ? liveResult.metadata.fault_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Unknown"

    const data = {
      id: caseId || "LIVE-001",
      service: liveResult.metadata.ground_truth || topCause?.node_name || "unknown",
      faultType: faultLabel,
      timestamp: new Date().toLocaleString(),
      duration: analysisTime ? `${(analysisTime / 1000).toFixed(1)}s` : "—",
      rootCauses: rc.map((r) => ({
        service: r.node_name,
        confidence: r.confidence,
        rank: r.rank,
      })),
      affectedServices: rc.length,
      totalNodes: liveResult.causal_graph.nodes.length,
    }

    const statusOrder: ServiceStatus[] = ["critical", "error", "warning", "degraded"]
    const services: AffectedService[] = rc.map((r, i) => ({
      name: r.node_name,
      status: statusOrder[Math.min(i, statusOrder.length - 1)],
      latency: `+${Math.round(r.anomaly_score * 100)}%`,
      errors: Math.round(r.cascade_score * 50),
      type: i === 0 ? "Root Cause" : "Downstream",
    }))

    // Add more affected services from the causal graph (direct neighbors of root cause)
    if (topCause?.details?.affects) {
      for (const aff of topCause.details.affects.slice(0, 7)) {
        if (!services.find((s) => s.name === aff.name)) {
          services.push({
            name: aff.name,
            status: aff.strength > 0.5 ? "warning" : "degraded",
            latency: `+${Math.round(aff.strength * 100)}%`,
            errors: 0,
            type: "Downstream",
          })
        }
      }
    }

    return { data, services, causalGraphData: liveResult.causal_graph as CausalGraphData }
  }, [isLiveCase, liveResult, caseId, analysisTime])

  // Clear highlight after 2 seconds
  useEffect(() => {
    if (highlightedService) {
      const timer = setTimeout(() => {
        setHighlightedService(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [highlightedService])

  const handleFocusInGraph = useCallback((serviceName: string) => {
    setIsAffectedPanelOpen(false)
    setActiveTab("graph")
    setHighlightedService(serviceName)
  }, [])

  const handleViewInTopology = useCallback((serviceName: string) => {
    setIsAffectedPanelOpen(false)
    setActiveTab("topology")
    if (serviceName) {
      setHighlightedService(serviceName)
    }
  }, [])

  const handleViewTimeline = useCallback((serviceName: string) => {
    setIsAffectedPanelOpen(false)
    setActiveTab("timeline")
    if (serviceName) {
      setHighlightedService(serviceName)
    }
  }, [])

  const [isLogsOpen, setIsLogsOpen] = useState(false)
  const [selectedLogService, setSelectedLogService] = useState<string | null>(null)

  const [isTracesOpen, setIsTracesOpen] = useState(false)
  const [selectedTraceService, setSelectedTraceService] = useState<string | null>(null)

  const handleViewLogs = useCallback((serviceName: string) => {
    setIsAffectedPanelOpen(false)
    setSelectedLogService(serviceName)
    setIsLogsOpen(true)
  }, [])

  const handleOpenTraces = useCallback((serviceName: string) => {
    setIsAffectedPanelOpen(false)
    setSelectedTraceService(serviceName)
    setIsTracesOpen(true)
  }, [])

  const displayData = currentAnalysis.data
  const displayServices = currentAnalysis.services

  // Loading state for live cases
  if (isLiveCase && isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <div className="text-center">
          <p className="text-[14px] font-medium text-app">Running INGD Analysis...</p>
          <p className="text-[12px] text-app-muted mt-1">
            Analyzing synthetic dataset through Neural Granger causal discovery
          </p>
        </div>
      </div>
    )
  }

  // Error state for live cases
  if (isLiveCase && loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <AlertOctagon className="h-8 w-8 text-red-500" />
        <div className="text-center">
          <p className="text-[14px] font-medium text-app">Backend Error</p>
          <p className="text-[12px] text-app-muted mt-1">{loadError}</p>
          <p className="text-[11px] text-app-muted mt-0.5">
            Make sure the backend is running on port 8765
          </p>
        </div>
        <button
          onClick={() => navigate("/cases")}
          className="mt-2 rounded-md bg-app-tertiary px-4 py-2 text-[12px] font-medium text-app-secondary transition-colors hover:text-app"
        >
          Back to Cases
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-app px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/cases")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-tertiary hover:text-app-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-black tracking-normal text-app">
                  {caseId || displayData.id}
                </h1>
                {isLiveCase && (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                    LIVE
                  </span>
                )}
                <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-500">
                  {displayData.faultType}
                </span>
              </div>
              <p className="text-[12px] text-app-muted">
                {displayData.service} · {displayData.timestamp}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
              <Share2 className="h-3 w-3" />
              Share
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
              <Download className="h-3 w-3" />
              Export
            </button>
          </div>
        </div>

        {/* Inline Stats */}
        <div className="mt-4 flex items-center gap-6 text-[12px]">
          <span className="flex items-center gap-1.5 text-app-muted">
            <Cpu className="h-3.5 w-3.5 text-emerald-500" />
            Root cause:{" "}
            <span className="font-mono font-medium text-app">
              {displayData.rootCauses[0].service}
            </span>
            <span className="text-emerald-500">
              ({(displayData.rootCauses[0].confidence * 100).toFixed(0)}%)
            </span>
          </span>
          <button
            onClick={() => setIsAffectedPanelOpen(true)}
            className="flex items-center gap-1.5 text-app-muted transition-colors hover:text-app-secondary group"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span className="font-medium text-app">{displayData.affectedServices}</span>{" "}
            <span className="underline decoration-dotted underline-offset-2">affected services</span>
            <ChevronRight className="h-3 w-3 opacity-0 -ml-1 transition-all group-hover:opacity-100 group-hover:ml-0" />
          </button>
          <span className="flex items-center gap-1.5 text-app-muted">
            <Clock className="h-3.5 w-3.5" />
            {displayData.duration} processing
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-3 py-2 text-[13px] font-medium transition-colors",
                activeTab === tab.id
                  ? "text-app"
                  : "text-app-muted hover:text-app-secondary"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "overview" && <OverviewContent data={displayData} />}
        {activeTab === "graph" && (
          <div className="h-full p-6">
            <CausalGraph highlightedService={highlightedService} backendData={currentAnalysis.causalGraphData} rootCauses={displayData.rootCauses} />
          </div>
        )}
        {activeTab === "topology" && (
          <div className="h-full p-6">
            <TopologyView highlightedService={highlightedService} />
          </div>
        )}
        {activeTab === "timeline" && (
          <div className="p-6">
            <TimelineView highlightedService={highlightedService} />
          </div>
        )}
        {activeTab === "logs" && (
          <div className="p-6">
            <LogsTabContent />
          </div>
        )}
        {activeTab === "traces" && (
          <div className="p-6">
            <TracesTabContent />
          </div>
        )}
        {activeTab === "explanation" && (
          <div className="p-6">
            <ExplanationView analysisReady={!!liveResult} />
          </div>
        )}
      </div>

      {/* Affected Services Panel */}
      <AffectedServicesPanel
        isOpen={isAffectedPanelOpen}
        onClose={() => setIsAffectedPanelOpen(false)}
        services={displayServices}
        onFocusInGraph={handleFocusInGraph}
        onViewTopology={handleViewInTopology}
        onViewTimeline={handleViewTimeline}
        onViewLogs={handleViewLogs}
        onOpenTraces={handleOpenTraces}
      />

      {/* Logs Panel */}
      <LogsPanel
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        serviceName={selectedLogService}
      />

      {/* Traces Panel */}
      <TracesPanel
        isOpen={isTracesOpen}
        onClose={() => setIsTracesOpen(false)}
        serviceName={selectedTraceService}
      />
    </div>
  )
}

function OverviewContent({ data }: { data: typeof analysisData }) {
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2">
      {/* Root Cause Ranking */}
      <div className="rounded-lg border border-app bg-app-surface">
        <div className="border-b border-app px-4 py-3">
          <h2 className="text-[13px] font-medium text-app">Root Cause Ranking</h2>
          <p className="text-[11px] text-app-muted">Top 5 candidates by confidence</p>
        </div>
        <div className="p-4 space-y-2">
          {data.rootCauses.map((rc) => (
            <div
              key={rc.service}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-app-tertiary"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold",
                  rc.rank === 1
                    ? "bg-emerald-500/20 text-emerald-500"
                    : rc.rank === 2
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "bg-app-tertiary text-app-muted"
                )}
              >
                {rc.rank}
              </span>
              <span className="flex-1 font-mono text-[12px] text-app">{rc.service}</span>
              <div className="flex items-center gap-2">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-app-tertiary">
                  <div
                    className={cn(
                      "h-full",
                      rc.rank === 1
                        ? "bg-emerald-500"
                        : rc.rank === 2
                          ? "bg-yellow-500"
                          : "bg-app-muted"
                    )}
                    style={{ width: `${rc.confidence * 100}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[12px] font-medium tabular-nums",
                    rc.confidence >= 0.9
                      ? "text-emerald-500"
                      : rc.confidence >= 0.7
                        ? "text-yellow-500"
                        : "text-app-muted"
                  )}
                >
                  {(rc.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="space-y-6">
        {/* Component Contribution */}
        <div className="rounded-lg border border-app bg-app-surface">
          <div className="border-b border-app px-4 py-3">
            <h2 className="text-[13px] font-medium text-app">Modal Contribution</h2>
          </div>
          <div className="p-4 space-y-3">
            <ContributionRow label="Metrics (CMEA)" value={42} color="bg-blue-500" />
            <ContributionRow label="Traces (INGD)" value={35} color="bg-emerald-500" />
            <ContributionRow label="Logs (CCRE)" value={23} color="bg-violet-500" />
          </div>
        </div>

        {/* Key Indicators */}
        <div className="rounded-lg border border-app bg-app-surface">
          <div className="border-b border-app px-4 py-3">
            <h2 className="text-[13px] font-medium text-app">Key Indicators</h2>
          </div>
          <div className="p-4 space-y-2 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-red-500" />
              <span className="text-app-secondary">CPU usage spike to</span>
              <span className="font-medium text-red-500">98.7%</span>
              <span className="text-app-muted">at 14:32:05</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-orange-500" />
              <span className="text-app-secondary">Response latency increased</span>
              <span className="font-medium text-orange-500">340%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-yellow-500" />
              <span className="text-app-secondary">Error logs:</span>
              <span className="font-medium text-yellow-500">127</span>
              <span className="text-app-muted">in 30s window</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-violet-500" />
              <span className="text-app-secondary">Trace anomaly score:</span>
              <span className="font-medium text-violet-500">0.89</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContributionRow({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-app-secondary">{label}</span>
        <span className="font-medium tabular-nums text-app">{value}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-app-tertiary">
        <div className={cn("h-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// Enhanced Affected Services Panel
type ServiceStatus = "critical" | "error" | "warning" | "degraded"
type SortField = "severity" | "latency" | "errors" | "name"

interface AffectedService {
  name: string
  status: ServiceStatus
  latency: string
  errors: number
  type: string
}

interface AffectedServicesPanelProps {
  isOpen: boolean
  onClose: () => void
  services: AffectedService[]
  onFocusInGraph: (serviceName: string) => void
  onViewTopology: (serviceName: string) => void
  onViewTimeline: (serviceName: string) => void
  onViewLogs: (serviceName: string) => void
  onOpenTraces: (serviceName: string) => void
}

const statusPriority: Record<ServiceStatus, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  degraded: 3,
}

function AffectedServicesPanel({
  isOpen,
  onClose,
  services,
  onFocusInGraph,
  onViewTopology,
  onViewTimeline,
  onViewLogs,
  onOpenTraces,
}: AffectedServicesPanelProps) {
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "all">("all")
  const [sortField, setSortField] = useState<SortField>("severity")
  const [sortAsc, setSortAsc] = useState(false)

  const filteredAndSortedServices = useMemo(() => {
    let result = [...services]

    // Filter by search
    if (searchQuery) {
      result = result.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "severity":
          comparison = statusPriority[a.status] - statusPriority[b.status]
          break
        case "latency":
          comparison = parseInt(a.latency) - parseInt(b.latency)
          break
        case "errors":
          comparison = b.errors - a.errors
          break
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
      }
      return sortAsc ? comparison : -comparison
    })

    return result
  }, [services, searchQuery, statusFilter, sortField, sortAsc])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Affected Services"
      subtitle={`${services.length} services impacted by this incident`}
      width="lg"
    >
      {/* Search and filters */}
      <div className="border-b border-app px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-muted" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-app bg-app-surface py-1.5 pl-9 pr-3 text-[12px] text-app placeholder:text-app-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filters and sort */}
        <div className="flex items-center justify-between">
          {/* Status filter pills */}
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-app-muted mr-1" />
            {(["all", "critical", "error", "warning", "degraded"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                  statusFilter === status
                    ? status === "all"
                      ? "bg-app-tertiary text-app"
                      : status === "critical"
                        ? "bg-red-500/20 text-red-500"
                        : status === "error"
                          ? "bg-orange-500/20 text-orange-500"
                          : status === "warning"
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-blue-500/20 text-blue-500"
                    : "text-app-muted hover:text-app-secondary"
                )}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== "all" && (
                  <span className="ml-1 opacity-70">
                    ({services.filter((s) => s.status === status).length})
                  </span>
                )}
              </button>
            ))}
          </div>

        </div>

        {/* Sort options - separate row for clarity */}
        <div className="flex items-center gap-3 pt-2 border-t border-app mt-2">
          <span className="text-[10px] text-app-muted flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" />
            Sort:
          </span>
          <div className="flex items-center gap-1">
            {(["severity", "latency", "errors", "name"] as SortField[]).map((field) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  sortField === field
                    ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                    : "text-app-muted hover:text-app-secondary hover:bg-app-tertiary border border-transparent"
                )}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortField === field && (
                  <span className={cn(
                    "text-[9px] px-1 py-0.5 rounded bg-blue-500/30",
                    sortAsc ? "" : ""
                  )}>
                    {sortAsc ? "ASC" : "DESC"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Services list */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filteredAndSortedServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-app-muted mb-2" />
            <p className="text-[13px] text-app-secondary">No services found</p>
            <p className="text-[11px] text-app-muted">Try adjusting your filters</p>
          </div>
        ) : (
          filteredAndSortedServices.map((service, index) => {
            const isExpanded = expandedService === service.name

            return (
              <div
                key={service.name}
                className={cn(
                  "rounded-lg border transition-all",
                  service.status === "critical"
                    ? "border-red-500/30 bg-red-500/5"
                    : service.status === "error"
                      ? "border-orange-500/20 bg-orange-500/5"
                      : service.status === "warning"
                        ? "border-yellow-500/20 bg-yellow-500/5"
                        : "border-app bg-app-surface"
                )}
              >
                {/* Main row - clickable */}
                <button
                  onClick={() => setExpandedService(isExpanded ? null : service.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-app-tertiary/50"
                >
                  {/* Expand icon */}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-app-muted transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />

                  {/* Status icon */}
                  {service.status === "critical" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  ) : service.status === "error" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-orange-500" />
                  ) : service.status === "warning" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-app-muted" />
                  )}

                  {/* Service info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-medium text-app truncate">
                        {service.name}
                      </span>
                      {service.type === "Root Cause" && (
                        <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-medium text-red-500">
                          ROOT CAUSE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-app-muted">
                      <span>
                        Latency: <span className="text-app-secondary">{service.latency}</span>
                      </span>
                      {service.errors > 0 && (
                        <span>
                          Errors: <span className="text-red-500">{service.errors}</span>
                        </span>
                      )}
                      <span className="text-app-muted">{service.type}</span>
                    </div>
                  </div>

                  {/* Rank number */}
                  <span className="shrink-0 text-[11px] font-mono text-app-muted">
                    #{index + 1}
                  </span>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-app px-4 py-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Metrics row */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="rounded-md bg-app-tertiary p-2.5">
                        <div className="text-[10px] text-app-muted mb-0.5">Latency Impact</div>
                        <div className="text-[14px] font-semibold text-app">{service.latency}</div>
                      </div>
                      <div className="rounded-md bg-app-tertiary p-2.5">
                        <div className="text-[10px] text-app-muted mb-0.5">Error Count</div>
                        <div className={cn("text-[14px] font-semibold", service.errors > 0 ? "text-red-500" : "text-app")}>
                          {service.errors}
                        </div>
                      </div>
                      <div className="rounded-md bg-app-tertiary p-2.5">
                        <div className="text-[10px] text-app-muted mb-0.5">Relationship</div>
                        <div className="text-[14px] font-semibold text-app">{service.type}</div>
                      </div>
                      <div className="rounded-md bg-app-tertiary p-2.5">
                        <div className="text-[10px] text-app-muted mb-0.5">Status</div>
                        <div className={cn(
                          "text-[14px] font-semibold capitalize",
                          service.status === "critical" ? "text-red-500" :
                          service.status === "error" ? "text-orange-500" :
                          service.status === "warning" ? "text-yellow-500" : "text-blue-500"
                        )}>
                          {service.status}
                        </div>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onFocusInGraph(service.name)
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app"
                      >
                        <Target className="h-3.5 w-3.5" />
                        Focus in Graph
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewTimeline(service.name)
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app"
                      >
                        <Activity className="h-3.5 w-3.5" />
                        View Timeline
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewLogs(service.name)
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Logs
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenTraces(service.name)
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Traces
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-app px-4 py-3">
        <button
          onClick={() => onViewTopology("")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-app-tertiary px-3 py-2 text-[12px] font-medium text-app-secondary transition-colors hover:bg-app-surface-hover hover:text-app"
        >
          <GitBranch className="h-3.5 w-3.5" />
          View All in Topology
        </button>
      </div>
    </SlidePanel>
  )
}

// Mock logs data
const mockLogs = [
  { timestamp: "14:32:05.234", level: "ERROR", message: "Connection timeout to downstream service", source: "OrderHandler.java:156" },
  { timestamp: "14:32:05.456", level: "ERROR", message: "Failed to complete order transaction", source: "TransactionManager.java:89" },
  { timestamp: "14:32:04.123", level: "WARN", message: "High latency detected: 2340ms", source: "MetricsCollector.java:45" },
  { timestamp: "14:32:03.987", level: "WARN", message: "Thread pool exhausted, queuing requests", source: "ThreadPoolExecutor.java:234" },
  { timestamp: "14:32:03.654", level: "INFO", message: "Incoming request: POST /api/v1/orders", source: "RequestHandler.java:12" },
  { timestamp: "14:32:02.321", level: "ERROR", message: "Database connection pool exhausted", source: "ConnectionPool.java:78" },
  { timestamp: "14:32:01.890", level: "WARN", message: "Memory usage above 85%", source: "HealthCheck.java:34" },
  { timestamp: "14:32:00.567", level: "INFO", message: "Service health check passed", source: "HealthCheck.java:22" },
  { timestamp: "14:31:59.234", level: "DEBUG", message: "Processing batch of 50 items", source: "BatchProcessor.java:67" },
  { timestamp: "14:31:58.901", level: "INFO", message: "Cache refresh completed", source: "CacheManager.java:123" },
]

interface LogsPanelProps {
  isOpen: boolean
  onClose: () => void
  serviceName: string | null
}

function LogsPanel({ isOpen, onClose, serviceName }: LogsPanelProps) {
  const [filter, setFilter] = useState<"all" | "error" | "warn" | "info">("all")

  const filteredLogs = mockLogs.filter((log) => {
    if (filter === "all") return true
    return log.level.toLowerCase() === filter
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case "ERROR":
        return "text-red-500 bg-red-500/10"
      case "WARN":
        return "text-yellow-500 bg-yellow-500/10"
      case "INFO":
        return "text-blue-500 bg-blue-500/10"
      case "DEBUG":
        return "text-gray-400 bg-gray-500/10"
      default:
        return "text-app-muted bg-app-tertiary"
    }
  }

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`Logs: ${serviceName || "Unknown Service"}`}
      subtitle="Real-time log stream"
      width="xl"
    >
      {/* Filter bar */}
      <div className="border-b border-app px-4 py-3 flex items-center gap-2">
        <span className="text-[11px] text-app-muted">Filter:</span>
        {(["all", "error", "warn", "info"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
              filter === level
                ? level === "all"
                  ? "bg-app-tertiary text-app"
                  : level === "error"
                    ? "bg-red-500/20 text-red-500"
                    : level === "warn"
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "bg-blue-500/20 text-blue-500"
                : "text-app-muted hover:text-app-secondary"
            )}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-app-muted">{filteredLogs.length} logs</span>
      </div>

      {/* Logs list */}
      <div className="flex-1 overflow-auto p-4 font-mono text-[11px]">
        <div className="space-y-1">
          {filteredLogs.map((log, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-app-tertiary transition-colors"
            >
              <span className="shrink-0 text-app-muted">{log.timestamp}</span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium",
                  getLevelColor(log.level)
                )}
              >
                {log.level}
              </span>
              <span className="flex-1 text-app-secondary">{log.message}</span>
              <span className="shrink-0 text-app-muted">{log.source}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-app px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] text-app-muted">Showing last 10 log entries</span>
        <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
          <Download className="h-3.5 w-3.5" />
          Export Logs
        </button>
      </div>
    </SlidePanel>
  )
}

// Mock traces data
const mockTraces = [
  {
    traceId: "abc123def456",
    name: "POST /api/v1/orders",
    duration: "2340ms",
    status: "error",
    spans: 12,
    timestamp: "14:32:05",
    services: ["ts-gateway", "ts-order-service", "ts-payment-service"],
  },
  {
    traceId: "xyz789ghi012",
    name: "GET /api/v1/travel/query",
    duration: "890ms",
    status: "success",
    spans: 8,
    timestamp: "14:32:04",
    services: ["ts-gateway", "ts-travel-service", "ts-route-service"],
  },
  {
    traceId: "mno345pqr678",
    name: "POST /api/v1/orders/confirm",
    duration: "1560ms",
    status: "error",
    spans: 10,
    timestamp: "14:32:03",
    services: ["ts-gateway", "ts-order-service", "ts-seat-service"],
  },
  {
    traceId: "stu901vwx234",
    name: "GET /api/v1/config",
    duration: "45ms",
    status: "success",
    spans: 3,
    timestamp: "14:32:02",
    services: ["ts-gateway", "ts-config-service"],
  },
  {
    traceId: "yza567bcd890",
    name: "GET /api/v1/user/profile",
    duration: "234ms",
    status: "success",
    spans: 5,
    timestamp: "14:32:01",
    services: ["ts-gateway", "ts-user-service"],
  },
]

interface TracesPanelProps {
  isOpen: boolean
  onClose: () => void
  serviceName: string | null
}

function TracesPanel({ isOpen, onClose, serviceName }: TracesPanelProps) {
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`Traces: ${serviceName || "Unknown Service"}`}
      subtitle="Distributed trace analysis"
      width="xl"
    >
      {/* Traces list */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {mockTraces.map((trace) => (
            <div
              key={trace.traceId}
              className={cn(
                "rounded-lg border transition-all cursor-pointer",
                selectedTrace === trace.traceId
                  ? "border-blue-500/50 bg-blue-500/5"
                  : trace.status === "error"
                    ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
                    : "border-app bg-app-surface hover:border-app-light"
              )}
              onClick={() => setSelectedTrace(selectedTrace === trace.traceId ? null : trace.traceId)}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status indicator */}
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    trace.status === "error" ? "bg-red-500" : "bg-emerald-500"
                  )}
                />

                {/* Trace info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-medium text-app truncate">
                      {trace.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-app-muted">
                    <span>ID: {trace.traceId}</span>
                    <span>{trace.timestamp}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-[11px]">
                  <div className="text-right">
                    <div className="text-app-muted">Duration</div>
                    <div
                      className={cn(
                        "font-mono font-medium",
                        parseInt(trace.duration) > 1000 ? "text-red-500" : "text-app"
                      )}
                    >
                      {trace.duration}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-app-muted">Spans</div>
                    <div className="font-mono font-medium text-app">{trace.spans}</div>
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {selectedTrace === trace.traceId && (
                <div className="border-t border-app px-4 py-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="text-[11px] text-app-muted mb-2">Service path:</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {trace.services.map((service, i) => (
                      <div key={service} className="flex items-center gap-2">
                        <span className="rounded bg-app-tertiary px-2 py-1 font-mono text-[10px] text-app-secondary">
                          {service}
                        </span>
                        {i < trace.services.length - 1 && (
                          <ChevronRight className="h-3 w-3 text-app-muted" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Waterfall preview placeholder */}
                  <div className="mt-4 rounded-md border border-app bg-app-tertiary p-4">
                    <div className="space-y-2">
                      {trace.services.map((service, i) => (
                        <div key={service} className="flex items-center gap-2">
                          <span className="w-32 text-[10px] text-app-muted truncate">{service}</span>
                          <div className="flex-1 h-4 bg-app-surface rounded overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded",
                                service.includes("order")
                                  ? "bg-red-500/50"
                                  : "bg-blue-500/30"
                              )}
                              style={{
                                width: `${100 - i * 20}%`,
                                marginLeft: `${i * 10}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-app-muted w-16 text-right">
                            {Math.round(parseInt(trace.duration) * (1 - i * 0.2))}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-app px-4 py-3 flex items-center justify-between">
        <span className="text-[11px] text-app-muted">
          {mockTraces.filter((t) => t.status === "error").length} errors in{" "}
          {mockTraces.length} traces
        </span>
        <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Jaeger
        </button>
      </div>
    </SlidePanel>
  )
}

// Logs Tab Content - Full page logs viewer
function LogsTabContent() {
  const [filter, setFilter] = useState<"all" | "error" | "warn" | "info" | "debug">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedService, setSelectedService] = useState<string>("all")

  const services = ["all", ...new Set(affectedServicesList.map(s => s.name))]

  const allLogs = [
    ...mockLogs,
    { timestamp: "14:31:57.123", level: "INFO", message: "Order validation started", source: "ValidationService.java:45" },
    { timestamp: "14:31:56.456", level: "DEBUG", message: "Parsing order payload", source: "OrderParser.java:23" },
    { timestamp: "14:31:55.789", level: "INFO", message: "Rate limiter check passed", source: "RateLimiter.java:67" },
    { timestamp: "14:31:54.012", level: "WARN", message: "Slow query detected: 450ms", source: "QueryExecutor.java:89" },
    { timestamp: "14:31:53.345", level: "DEBUG", message: "Cache miss for key: order_config_v2", source: "CacheManager.java:156" },
  ]

  const filteredLogs = allLogs.filter((log) => {
    if (filter !== "all" && log.level.toLowerCase() !== filter) return false
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case "ERROR": return "text-red-500 bg-red-500/10"
      case "WARN": return "text-yellow-500 bg-yellow-500/10"
      case "INFO": return "text-blue-500 bg-blue-500/10"
      case "DEBUG": return "text-gray-400 bg-gray-500/10"
      default: return "text-app-muted bg-app-tertiary"
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-medium text-app">Log Explorer</h2>
          <p className="text-[11px] text-app-muted">
            Aggregated logs from all affected services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg border border-app bg-app-surface p-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-muted" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-app bg-app-tertiary py-1.5 pl-9 pr-3 text-[12px] text-app placeholder:text-app-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Service filter */}
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="rounded-md border border-app bg-app-tertiary px-3 py-1.5 text-[11px] text-app focus:border-blue-500 focus:outline-none"
        >
          {services.map((service) => (
            <option key={service} value={service}>
              {service === "all" ? "All Services" : service}
            </option>
          ))}
        </select>

        {/* Level filters */}
        <div className="flex items-center gap-1">
          {(["all", "error", "warn", "info", "debug"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                filter === level
                  ? level === "all"
                    ? "bg-app-tertiary text-app"
                    : level === "error"
                      ? "bg-red-500/20 text-red-500"
                      : level === "warn"
                        ? "bg-yellow-500/20 text-yellow-500"
                        : level === "info"
                          ? "bg-blue-500/20 text-blue-500"
                          : "bg-gray-500/20 text-gray-400"
                  : "text-app-muted hover:text-app-secondary"
              )}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Logs table */}
      <div className="rounded-lg border border-app bg-app-surface overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-app-tertiary border-b border-app">
              <tr className="text-[10px] text-app-muted uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">Timestamp</th>
                <th className="text-left px-4 py-2 font-medium">Level</th>
                <th className="text-left px-4 py-2 font-medium">Message</th>
                <th className="text-left px-4 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px]">
              {filteredLogs.map((log, index) => (
                <tr key={index} className="border-b border-app hover:bg-app-tertiary/50 transition-colors">
                  <td className="px-4 py-2 text-app-muted whitespace-nowrap">{log.timestamp}</td>
                  <td className="px-4 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", getLevelColor(log.level))}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-app-secondary">{log.message}</td>
                  <td className="px-4 py-2 text-app-muted">{log.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-[11px] text-app-muted">
        <span>Showing <span className="font-medium text-app-secondary">{filteredLogs.length}</span> of {allLogs.length} logs</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {allLogs.filter(l => l.level === "ERROR").length} errors
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
          {allLogs.filter(l => l.level === "WARN").length} warnings
        </span>
      </div>
    </div>
  )
}

// Traces Tab Content - Full page traces viewer
function TracesTabContent() {
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "error" | "slow">("all")

  const filteredTraces = mockTraces.filter((trace) => {
    if (filter === "all") return true
    if (filter === "error") return trace.status === "error"
    if (filter === "slow") return parseInt(trace.duration) > 1000
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-medium text-app">Distributed Traces</h2>
          <p className="text-[11px] text-app-muted">
            End-to-end request tracing across services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Jaeger
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-app-muted">Filter:</span>
        {(["all", "error", "slow"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              filter === f
                ? f === "all"
                  ? "bg-app-tertiary text-app"
                  : f === "error"
                    ? "bg-red-500/20 text-red-500"
                    : "bg-yellow-500/20 text-yellow-500"
                : "text-app-muted hover:text-app-secondary"
            )}
          >
            {f === "all" ? "All Traces" : f === "error" ? "Errors Only" : "Slow (>1s)"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-app-muted">
          {filteredTraces.length} traces
        </span>
      </div>

      {/* Traces list */}
      <div className="space-y-2">
        {filteredTraces.map((trace) => (
          <div
            key={trace.traceId}
            className={cn(
              "rounded-lg border transition-all cursor-pointer",
              selectedTrace === trace.traceId
                ? "border-blue-500/50 bg-blue-500/5"
                : trace.status === "error"
                  ? "border-red-500/20 bg-app-surface hover:border-red-500/30"
                  : "border-app bg-app-surface hover:border-app-light"
            )}
            onClick={() => setSelectedTrace(selectedTrace === trace.traceId ? null : trace.traceId)}
          >
            {/* Main row */}
            <div className="flex items-center gap-4 px-4 py-3">
              {/* Status */}
              <span className={cn(
                "h-2.5 w-2.5 rounded-full",
                trace.status === "error" ? "bg-red-500" : "bg-emerald-500"
              )} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[12px] font-medium text-app">{trace.name}</div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-app-muted">
                  <span>ID: {trace.traceId}</span>
                  <span>{trace.timestamp}</span>
                  <span>{trace.services.length} services</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 text-[11px]">
                <div className="text-right">
                  <div className="text-app-muted">Duration</div>
                  <div className={cn(
                    "font-mono font-medium",
                    parseInt(trace.duration) > 1000 ? "text-red-500" : "text-app"
                  )}>
                    {trace.duration}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-app-muted">Spans</div>
                  <div className="font-mono font-medium text-app">{trace.spans}</div>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-app-muted transition-transform",
                  selectedTrace === trace.traceId && "rotate-180"
                )} />
              </div>
            </div>

            {/* Expanded waterfall */}
            {selectedTrace === trace.traceId && (
              <div className="border-t border-app px-4 py-4 animate-in slide-in-from-top-2 duration-200">
                <div className="text-[11px] text-app-muted mb-3">Waterfall View</div>
                <div className="space-y-1.5">
                  {trace.services.map((service, i) => {
                    const duration = Math.round(parseInt(trace.duration) * (1 - i * 0.15))
                    const offset = i * 8
                    return (
                      <div key={service} className="flex items-center gap-3">
                        <span className="w-36 text-[11px] text-app-muted font-mono truncate">{service}</span>
                        <div className="flex-1 h-5 bg-app-tertiary rounded-md relative overflow-hidden">
                          <div
                            className={cn(
                              "absolute h-full rounded-md",
                              service.includes("order") ? "bg-red-500/60" : "bg-blue-500/40"
                            )}
                            style={{
                              width: `${Math.max(20, 100 - i * 15)}%`,
                              left: `${offset}%`,
                            }}
                          >
                            <span className="absolute inset-0 flex items-center px-2 text-[9px] font-medium text-white truncate">
                              {service.replace("ts-", "")}
                            </span>
                          </div>
                        </div>
                        <span className="w-16 text-right text-[10px] text-app-muted font-mono">
                          {duration}ms
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-app">
                  <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-tertiary px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:text-app">
                    <FileText className="h-3.5 w-3.5" />
                    View Logs
                  </button>
                  <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-tertiary px-2.5 py-1.5 text-[11px] font-medium text-app-secondary transition-colors hover:text-app">
                    <Activity className="h-3.5 w-3.5" />
                    View Metrics
                  </button>
                  <button className="ml-auto flex items-center gap-1.5 rounded-md bg-blue-500/20 px-2.5 py-1.5 text-[11px] font-medium text-blue-500 transition-colors hover:bg-blue-500/30">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Full Details
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-[11px] text-app-muted pt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {mockTraces.filter(t => t.status === "error").length} failed traces
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
          {mockTraces.filter(t => parseInt(t.duration) > 1000).length} slow traces
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {mockTraces.filter(t => t.status === "success" && parseInt(t.duration) <= 1000).length} healthy traces
        </span>
      </div>
    </div>
  )
}
