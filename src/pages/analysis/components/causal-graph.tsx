import { useCallback, useState, useEffect, useMemo } from "react"
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
  Map,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip-simple"

interface CausalGraphProps {
  highlightedService?: string | null
}

// Custom node component for services
function ServiceNode({
  data,
}: {
  data: { label: string; isRootCause: boolean; confidence?: number; isHighlighted?: boolean; isDark?: boolean }
}) {
  const isDark = data.isDark ?? true
  return (
    <div
      className={cn(
        "min-w-[120px] rounded-lg border px-3 py-2 text-center shadow-lg transition-all",
        data.isHighlighted
          ? "border-blue-500 bg-blue-500/20 shadow-blue-500/40 ring-2 ring-blue-500/50 animate-pulse"
          : data.isRootCause
            ? "border-red-500/50 bg-red-500/10 shadow-red-500/20"
            : isDark
              ? "border-white/10 bg-[#151518] shadow-black/20"
              : "border-black/10 bg-white shadow-black/10"
      )}
      style={data.isHighlighted ? {
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)"
      } : undefined}
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
          <Map className="h-3.5 w-3.5" />
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
        <span className={isDark ? "text-white/50" : "text-black/60"}>Critical Path</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-0.5 w-4", isDark ? "bg-white/20" : "bg-black/20")} />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Dependency</span>
      </div>
    </div>
  )
}

function CausalGraphInner({ highlightedService }: CausalGraphProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const { fitView, setCenter } = useReactFlow()

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // Update edge colors when theme changes
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        // Keep critical path edges red, update dependency edges based on theme
        const isCriticalPath = edge.style?.stroke === "#ef4444"
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
    )
  }, [isDark, setEdges])

  // Handle highlighting when a service is selected and update isDark on nodes
  useEffect(() => {
    if (highlightedService) {
      // Find the node that matches the service name
      const serviceNameLower = highlightedService.toLowerCase()

      // Find matching node from the constant (positions don't change)
      const matchedNode = initialNodes.find((node) => {
        const nodeLabel = (node.data as { label: string }).label.toLowerCase()
        return nodeLabel.includes(serviceNameLower.replace("ts-", "").replace("-service", ""))
          || serviceNameLower.includes(nodeLabel.replace("ts-", "").replace("-service", ""))
      })

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const nodeLabel = (node.data as { label: string }).label.toLowerCase()
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

      // Center on the highlighted node
      if (matchedNode) {
        setTimeout(() => {
          setCenter(matchedNode.position.x + 60, matchedNode.position.y + 30, { zoom: 1.2, duration: 500 })
        }, 100)
      }
    } else {
      // Clear all highlights but keep isDark updated
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isHighlighted: false,
            isDark,
          },
        }))
      )
    }
  }, [highlightedService, setNodes, setCenter, isDark])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-app",
        isDark ? "bg-[#0a0a0b]" : "bg-[#f8f9fa]",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "h-full min-h-[400px]"
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
    </div>
  )
}

export function CausalGraph({ highlightedService }: CausalGraphProps) {
  return (
    <ReactFlowProvider>
      <CausalGraphInner highlightedService={highlightedService} />
    </ReactFlowProvider>
  )
}
