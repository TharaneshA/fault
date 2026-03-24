import { useCallback, useState, useEffect, useMemo, useRef, Component, type ReactNode } from "react"
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Target,
  Map as MapIcon,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip-simple"

// Error boundary to prevent causal graph crashes from blanking the app
class GraphErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: "" }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error: Error) {
    console.error("[CausalGraph] Render error:", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-lg border border-app bg-app-surface">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          <p className="text-[13px] font-medium text-app">Graph rendering failed</p>
          <p className="text-[11px] text-app-muted max-w-sm text-center">{this.state.error}</p>
        </div>
      )
    }
    return this.props.children
  }
}

interface BackendGraphData {
  nodes: Array<{ id: number; name: string }>
  edges: Array<{ source: number; target: number; source_name: string; target_name: string; weight: number }>
}

interface CausalGraphProps {
  highlightedService?: string | null
  backendData?: BackendGraphData
  rootCauses?: Array<{ service: string; confidence: number; rank: number }>
}

// Custom node component for services
function ServiceNode({
  data,
}: {
  data: {
    label: string
    isRootCause: boolean
    confidence?: number
    isHighlighted?: boolean
    isDimmed?: boolean
    isDark?: boolean
  }
}) {
  const isDark = data.isDark ?? true
  return (
    <div
      className={cn(
        "min-w-[120px] rounded-lg border px-3 py-2 text-center shadow-lg transition-all duration-200",
        data.isHighlighted
          ? "border-blue-500 bg-blue-500/20 shadow-blue-500/40 ring-2 ring-blue-500/50"
          : data.isRootCause
            ? "border-red-500/50 bg-red-500/10 shadow-red-500/20"
            : isDark
              ? "border-white/10 bg-[#151518] shadow-black/20"
              : "border-black/10 bg-white shadow-black/10"
      )}
      style={{
        opacity: data.isDimmed ? 0.15 : 1,
        ...(data.isHighlighted ? {
          boxShadow: "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)"
        } : {}),
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          "!h-2 !w-2 !border-2",
          isDark ? "!border-[#0a0a0b] !bg-white/30" : "!border-white !bg-black/20"
        )}
      />
      <div
        className={cn(
          "font-mono text-[11px]",
          data.isHighlighted
            ? "text-blue-500 font-bold"
            : data.isRootCause
              ? "text-red-500"
              : isDark ? "text-white/80" : "text-black/80"
        )}
      >
        {data.label}
      </div>
      {data.confidence !== undefined && (
        <div
          className={cn(
            "mt-0.5 text-[10px] tabular-nums",
            data.confidence >= 0.9
              ? "text-emerald-500"
              : data.confidence >= 0.7
                ? "text-yellow-500"
                : isDark ? "text-white/40" : "text-black/40"
          )}
        >
          {(data.confidence * 100).toFixed(0)}%
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "!h-2 !w-2 !border-2",
          isDark ? "!border-[#0a0a0b] !bg-white/30" : "!border-white !bg-black/20"
        )}
      />
    </div>
  )
}

const nodeTypes = {
  service: ServiceNode,
}

// Transform backend causal graph into a readable tree layout sized to container
// Each root cause forms a column with its affected services below it
function buildBackendGraph(
  data: BackendGraphData,
  rootCauses: Array<{ service: string; confidence: number; rank: number }>,
  containerW: number,
  containerH: number,
): { nodes: Node[]; edges: Edge[] } {
  try {
    if (!data?.nodes?.length) {
      return { nodes: [], edges: [] }
    }

    // Use container aspect ratio for layout (default to 16:9 landscape)
    const W = Math.max(containerW, 800)
    const H = Math.max(containerH, 500)

    const nodeNameById = new Map(data.nodes.map((n) => [n.id, n.name]))
    const nodeIdByName = new Map(data.nodes.map((n) => [n.name, n.id]))
    const confidenceMap = new Map<string, number>(rootCauses.map((rc) => [rc.service, rc.confidence]))

    const validEdges = data.edges
      .filter((e) => e.source !== e.target && (e.weight || 0) > 0.1)
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))

    // Limit to top 3 root causes for readability
    const MAX_ROOTS = 3
    const MAX_CHILDREN = 4
    const topRoots = rootCauses.slice(0, MAX_ROOTS)
    const rootCauseNames = new Set(topRoots.map((rc) => rc.service))
    const rootIds = new Set<number>()
    const usedChildIds = new Set<number>()

    // Build columns: each root cause + its direct targets
    type Column = {
      rootId: number
      rootName: string
      confidence: number
      children: number[]
      edges: typeof validEdges
    }
    const columns: Column[] = []

    for (const rc of topRoots) {
      const rootId = nodeIdByName.get(rc.service)
      if (rootId === undefined) continue
      rootIds.add(rootId)

      const children: number[] = []
      const colEdges: typeof validEdges = []

      for (const e of validEdges) {
        if (children.length >= MAX_CHILDREN) break
        if (e.source === rootId && !rootCauseNames.has(e.target_name) && !usedChildIds.has(e.target)) {
          children.push(e.target)
          usedChildIds.add(e.target)
          colEdges.push(e)
        }
      }

      columns.push({ rootId, rootName: rc.service, confidence: rc.confidence, children, edges: colEdges })
    }

    if (columns.length === 0) {
      return { nodes: [], edges: [] }
    }

    const PADDING = 80
    const usableW = W - PADDING * 2
    const colWidth = usableW / columns.length
    const ROOT_Y = PADDING
    const CHILD_Y_START = H * 0.45
    const CHILD_Y_STAGGER = 50 // alternate Y to reduce overlap
    const NODE_W = 140 // approximate node width for centering

    const nodes: Node[] = []
    const allEdges: typeof validEdges = []

    // Helper for deterministic pseudo-random visual variance
    const getJitter = (id: number, amplitude: number) => {
      const hash = Math.sin(id * 123.456) * 10000;
      return (hash - Math.floor(hash) - 0.5) * amplitude;
    }

    columns.forEach((col, colIdx) => {
      const rootJitterX = getJitter(col.rootId, 60)
      const rootJitterY = getJitter(col.rootId, 30)
      const colCenterX = PADDING + colIdx * colWidth + colWidth / 2 - NODE_W / 2 + rootJitterX

      // Root cause at top-center of its column (with organic jitter)
      nodes.push({
        id: String(col.rootId),
        type: "service",
        position: { x: colCenterX, y: ROOT_Y + rootJitterY },
        data: { label: col.rootName, isRootCause: true, confidence: col.confidence },
      })

      // Children spread evenly within the column
      const childSpacing = colWidth / (col.children.length + 1)
      col.children.forEach((childId, childIdx) => {
        const childJitterX = getJitter(childId, 45)
        const childJitterY = getJitter(childId + col.rootId, 60)

        const childX = PADDING + colIdx * colWidth + childSpacing * (childIdx + 1) - NODE_W / 2 + childJitterX
        const childY = CHILD_Y_START + (childIdx % 2) * CHILD_Y_STAGGER + childJitterY
        const name = nodeNameById.get(childId) || `node-${childId}`
        nodes.push({
          id: String(childId),
          type: "service",
          position: { x: childX, y: childY },
          data: { label: name, isRootCause: false, confidence: confidenceMap.get(name) },
        })
      })

      allEdges.push(...col.edges)
    })

    // Add strong cross-column edges between visible nodes
    const visibleIds = new Set(nodes.map((n) => n.id))
    for (const e of validEdges.slice(0, 40)) {
      if (
        visibleIds.has(String(e.source)) && visibleIds.has(String(e.target))
        && !allEdges.find((ae) => ae.source === e.source && ae.target === e.target)
      ) {
        allEdges.push(e)
      }
    }

    // Add root-to-root edges
    for (const e of validEdges) {
      if (rootIds.has(e.source) && rootIds.has(e.target) && e.weight > 0.3) {
        if (!allEdges.find((ae) => ae.source === e.source && ae.target === e.target)) {
          allEdges.push(e)
        }
      }
    }

    console.log(`[CausalGraph] Tree layout: ${columns.length} columns, ${nodes.length} nodes, ${allEdges.length} edges (container ${W}x${H})`)

    // Style edges by causal strength (labels hidden by default, shown on hover)
    const maxWeight = allEdges[0]?.weight || 1
    const edges: Edge[] = allEdges.map((e, i) => {
      const weight = e.weight || 0
      const strength = weight / maxWeight

      let stroke: string
      let strokeWidth: number
      if (strength > 0.7) {
        stroke = "#ef4444"
        strokeWidth = 2.5
      } else if (strength > 0.4) {
        stroke = "#f97316"
        strokeWidth = 1.8
      } else {
        stroke = "rgba(255,255,255,0.15)"
        strokeWidth = 1
      }

      const fromRoot = rootIds.has(e.source)

      return {
        id: `e-${e.source}-${e.target}-${i}`,
        source: String(e.source),
        target: String(e.target),
        animated: fromRoot && strength > 0.5,
        data: { weightLabel: `${(weight * 100).toFixed(0)}%`, strokeColor: stroke },
        style: { stroke, strokeWidth },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 14,
          height: 14,
        },
      }
    })

    return { nodes, edges }
  } catch (err) {
    console.error("[CausalGraph] Failed to build backend graph:", err)
    return { nodes: [], edges: [] }
  }
}

// Mock causal graph data
const initialNodes: Node[] = [
  {
    id: "gateway",
    type: "service",
    position: { x: 250, y: 0 },
    data: { label: "ts-gateway", isRootCause: false },
  },
  {
    id: "order",
    type: "service",
    position: { x: 100, y: 100 },
    data: { label: "ts-order-service", isRootCause: true, confidence: 0.94 },
  },
  {
    id: "travel",
    type: "service",
    position: { x: 400, y: 100 },
    data: { label: "ts-travel-service", isRootCause: false, confidence: 0.78 },
  },
  {
    id: "config",
    type: "service",
    position: { x: 0, y: 200 },
    data: { label: "ts-config-service", isRootCause: false, confidence: 0.65 },
  },
  {
    id: "station",
    type: "service",
    position: { x: 200, y: 200 },
    data: { label: "ts-station-service", isRootCause: false, confidence: 0.52 },
  },
  {
    id: "route",
    type: "service",
    position: { x: 400, y: 200 },
    data: { label: "ts-route-service", isRootCause: false, confidence: 0.41 },
  },
  {
    id: "price",
    type: "service",
    position: { x: 580, y: 200 },
    data: { label: "ts-price-service", isRootCause: false },
  },
  {
    id: "seat",
    type: "service",
    position: { x: 100, y: 300 },
    data: { label: "ts-seat-service", isRootCause: false },
  },
  {
    id: "user",
    type: "service",
    position: { x: 300, y: 300 },
    data: { label: "ts-user-service", isRootCause: false },
  },
  {
    id: "payment",
    type: "service",
    position: { x: 500, y: 300 },
    data: { label: "ts-payment-service", isRootCause: false },
  },
]

const initialEdges: Edge[] = [
  {
    id: "e-gateway-order",
    source: "gateway",
    target: "order",
    animated: true,
    style: { stroke: "#ef4444", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
  },
  {
    id: "e-gateway-travel",
    source: "gateway",
    target: "travel",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
  {
    id: "e-order-config",
    source: "order",
    target: "config",
    animated: true,
    style: { stroke: "#ef4444", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
  },
  {
    id: "e-order-station",
    source: "order",
    target: "station",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
  {
    id: "e-travel-route",
    source: "travel",
    target: "route",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
  {
    id: "e-travel-price",
    source: "travel",
    target: "price",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
  {
    id: "e-station-seat",
    source: "station",
    target: "seat",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
  {
    id: "e-route-user",
    source: "route",
    target: "user",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
  {
    id: "e-price-payment",
    source: "price",
    target: "payment",
    style: { stroke: "rgba(255,255,255,0.2)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.3)" },
  },
]

function GraphControls({
  isFullscreen,
  onToggleFullscreen,
  showMinimap,
  onToggleMinimap,
  isDark,
}: {
  isFullscreen: boolean
  onToggleFullscreen: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
  isDark: boolean
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className={cn(
      "absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border p-1 backdrop-blur-xl",
      isDark ? "border-white/10 bg-[#0a0a0b]/90" : "border-black/10 bg-white/90"
    )}>
      <Tooltip content="Zoom in">
        <button
          onClick={() => zoomIn()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/10 hover:text-black"
          )}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Zoom out">
        <button
          onClick={() => zoomOut()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/10 hover:text-black"
          )}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Fit view">
        <button
          onClick={() => fitView({ padding: 0.2 })}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/10 hover:text-black"
          )}
        >
          <Target className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <div className={cn("mx-1 h-4 w-px", isDark ? "bg-white/10" : "bg-black/10")} />
      <Tooltip content={showMinimap ? "Hide minimap" : "Show minimap"}>
        <button
          onClick={onToggleMinimap}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            showMinimap
              ? isDark ? "bg-white/10 text-white" : "bg-black/10 text-black"
              : isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/10 hover:text-black"
          )}
        >
          <MapIcon className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
        <button
          onClick={onToggleFullscreen}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/10 hover:text-black"
          )}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
      </Tooltip>
    </div>
  )
}

function GraphLegend({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      "absolute right-4 top-4 z-10 flex items-center gap-4 rounded-lg border px-3 py-2 text-[11px] backdrop-blur-xl",
      isDark ? "border-white/10 bg-[#0a0a0b]/90" : "border-black/10 bg-white/90"
    )}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Root Cause</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-red-500" />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Strong (&gt;70%)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-orange-500" />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Moderate</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-0.5 w-4", isDark ? "bg-white/20" : "bg-black/20")} />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Weak</span>
      </div>
      <div className={cn("mx-1 h-3 w-px", isDark ? "bg-white/10" : "bg-black/10")} />
      <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-black/30")}>
        Hover node to focus &middot; F fullscreen
      </span>
    </div>
  )
}

function CausalGraphInner({ highlightedService, backendData, rootCauses }: CausalGraphProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Measure container to size graph layout
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 600 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: rect.width, h: rect.height })
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Build graph data with theme-aware colors, sized to container
  const graphData = useMemo(() => {
    let baseNodes: Node[]
    let baseEdges: Edge[]

    if (backendData && rootCauses) {
      const built = buildBackendGraph(backendData, rootCauses, containerSize.w, containerSize.h)
      baseNodes = built.nodes
      baseEdges = built.edges
    } else {
      baseNodes = initialNodes
      baseEdges = initialEdges
    }

    // Apply theme to all nodes upfront
    const themedNodes = baseNodes.map((node) => ({
      ...node,
      data: { ...node.data, isDark, isHighlighted: false },
    }))

    // Apply theme to non-critical edges upfront
    const themedEdges = baseEdges.map((edge) => {
      const isCriticalPath = edge.style?.stroke === "#ef4444" || edge.style?.stroke === "#f97316"
      if (isCriticalPath) return edge
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
        },
      }
    })

    return { nodes: themedNodes, edges: themedEdges }
  }, [backendData, rootCauses, isDark, containerSize])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const { fitView, setCenter } = useReactFlow()

  // Sync graphData → ReactFlow state whenever data or theme changes
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setNodes(graphData.nodes)
      setEdges(graphData.edges)
      // Fit view after nodes are placed
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    }
  }, [graphData, setNodes, setEdges, fitView])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // F key toggles fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleFullscreen])

  // Hover-to-focus: hovering a node shows only its connections with % labels
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    const nodeId = node.id

    // Find all edges connected to this node
    const connectedEdgeIds = new Set<string>()
    const connectedNodeIds = new Set([nodeId])
    graphData.edges.forEach((e) => {
      if (e.source === nodeId || e.target === nodeId) {
        connectedEdgeIds.add(e.id)
        connectedNodeIds.add(e.source)
        connectedNodeIds.add(e.target)
      }
    })

    // Dim non-connected nodes, highlight the hovered node
    setNodes(graphData.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isDark,
        isHighlighted: n.id === nodeId,
        isDimmed: !connectedNodeIds.has(n.id),
      },
    })))

    // Dim non-connected edges, show labels + animate connected edges
    setEdges(graphData.edges.map((e) => {
      const isConnected = connectedEdgeIds.has(e.id)
      const edgeData = e.data as Record<string, unknown> | undefined
      if (isConnected) {
        const strokeColor = String(edgeData?.strokeColor ?? "#ef4444")
        return {
          ...e,
          animated: true,
          label: String(edgeData?.weightLabel ?? ""),
          labelStyle: { fontSize: 11, fill: strokeColor, fontWeight: 700 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: isDark ? "#0a0a0b" : "#f8f9fa", fillOpacity: 0.9 },
          style: { ...e.style, opacity: 1 },
        }
      }
      return {
        ...e,
        animated: false,
        label: undefined,
        style: { ...e.style, opacity: 0.06 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "transparent" },
      }
    }))
  }, [graphData, isDark, setNodes, setEdges])

  const onNodeMouseLeave = useCallback(() => {
    // Restore from graphData (normal state, no labels, no dimming)
    setNodes(graphData.nodes)
    setEdges(graphData.edges)
  }, [graphData, setNodes, setEdges])

  // Handle highlighting when a service is selected from the affected panel
  useEffect(() => {
    if (!highlightedService) return

    const serviceNameLower = highlightedService.toLowerCase()

    const matchedNode = graphData.nodes.find((node) => {
      const nodeLabel = String((node.data as Record<string, unknown>).label ?? "").toLowerCase()
      return nodeLabel.includes(serviceNameLower.replace("ts-", "").replace("-service", ""))
        || serviceNameLower.includes(nodeLabel.replace("ts-", "").replace("-service", ""))
    })

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const nodeLabel = String((node.data as Record<string, unknown>).label ?? "").toLowerCase()
        const isMatch = nodeLabel.includes(serviceNameLower.replace("ts-", "").replace("-service", ""))
          || serviceNameLower.includes(nodeLabel.replace("ts-", "").replace("-service", ""))

        return {
          ...node,
          data: {
            ...node.data,
            isHighlighted: isMatch,
            isDark,
          },
        }
      })
    )

    if (matchedNode) {
      setTimeout(() => {
        setCenter(matchedNode.position.x + 60, matchedNode.position.y + 30, { zoom: 1.2, duration: 500 })
      }, 100)
    }
  }, [highlightedService, setNodes, setCenter, isDark, graphData.nodes])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-lg border border-app",
        isDark ? "bg-[#0a0a0b]" : "bg-[#f8f9fa]",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "h-full min-h-[400px]"
      )}
    >
      {nodes.length === 0 ? (
        <div className="flex h-full min-h-[400px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-app-muted mb-2" />
            <p className="text-[12px] text-app-muted">Loading graph...</p>
          </div>
        </div>
      ) : (
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            className={isDark ? "bg-[#0a0a0b]" : "bg-[#f8f9fa]"}
          >
            <Background color={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} gap={24} size={1} />
            {showMinimap && (
              <MiniMap
                nodeColor={(node) =>
                  node.data.isRootCause ? "#ef4444" : isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"
                }
                maskColor={isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)"}
                className={cn(
                  "!bottom-4 !right-4 !h-24 !w-36 !rounded-lg !border",
                  isDark ? "!border-white/10 !bg-[#0a0a0b]/90" : "!border-black/10 !bg-white/90"
                )}
              />
            )}
          </ReactFlow>
          <GraphControls
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            showMinimap={showMinimap}
            onToggleMinimap={() => setShowMinimap(!showMinimap)}
            isDark={isDark}
          />
          <GraphLegend isDark={isDark} />
        </>
      )}
    </div>
  )
}

export function CausalGraph({ highlightedService, backendData, rootCauses }: CausalGraphProps) {
  return (
    <GraphErrorBoundary>
      <ReactFlowProvider>
        <CausalGraphInner highlightedService={highlightedService} backendData={backendData} rootCauses={rootCauses} />
      </ReactFlowProvider>
    </GraphErrorBoundary>
  )
}
