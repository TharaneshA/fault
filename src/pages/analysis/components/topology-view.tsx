import { useState, useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
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
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip-simple"

interface TopologyViewProps {
  highlightedService?: string | null
}

// Service types for different styling
type ServiceType = "gateway" | "core" | "data" | "external"

const serviceTypeColors: Record<ServiceType, { bg: string; border: string; text: string; lightBg: string; lightBorder: string; lightText: string }> = {
  gateway: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", lightBg: "bg-blue-500/15", lightBorder: "border-blue-500/40", lightText: "text-blue-600" },
  core: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", lightBg: "bg-emerald-500/15", lightBorder: "border-emerald-500/40", lightText: "text-emerald-600" },
  data: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", lightBg: "bg-violet-500/15", lightBorder: "border-violet-500/40", lightText: "text-violet-600" },
  external: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", lightBg: "bg-orange-500/15", lightBorder: "border-orange-500/40", lightText: "text-orange-600" },
}

function TopologyNode({
  data,
}: {
  data: { label: string; type: ServiceType; status: "healthy" | "degraded" | "error"; isHighlighted?: boolean; isDark?: boolean }
}) {
  const colors = serviceTypeColors[data.type]
  const isDark = data.isDark ?? true
  const statusColors = {
    healthy: "bg-emerald-500",
    degraded: "bg-yellow-500",
    error: "bg-red-500",
  }

  return (
    <div
      className={cn(
        "min-w-[100px] rounded-lg border px-3 py-2 text-center shadow-lg transition-all",
        data.isHighlighted
          ? "border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50 animate-pulse"
          : isDark
            ? cn(colors.bg, colors.border)
            : cn(colors.lightBg, colors.lightBorder)
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
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!h-2 !w-2 !border-2",
          isDark ? "!border-[#0a0a0b] !bg-white/30" : "!border-white !bg-black/20"
        )}
      />
      <div className="flex items-center justify-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", statusColors[data.status])} />
        <span className={cn(
          "font-mono text-[10px]",
          data.isHighlighted
            ? "text-blue-500 font-bold"
            : isDark ? colors.text : colors.lightText
        )}>
          {data.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "!h-2 !w-2 !border-2",
          isDark ? "!border-[#0a0a0b] !bg-white/30" : "!border-white !bg-black/20"
        )}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!h-2 !w-2 !border-2",
          isDark ? "!border-[#0a0a0b] !bg-white/30" : "!border-white !bg-black/20"
        )}
      />
    </div>
  )
}

const nodeTypes = {
  topology: TopologyNode,
}

// Train-Ticket microservice topology
const topologyNodes: Node[] = [
  // Gateway layer
  { id: "gateway", type: "topology", position: { x: 300, y: 0 }, data: { label: "ts-gateway", type: "gateway", status: "healthy" } },

  // Core services layer
  { id: "order", type: "topology", position: { x: 100, y: 100 }, data: { label: "ts-order", type: "core", status: "error" } },
  { id: "travel", type: "topology", position: { x: 300, y: 100 }, data: { label: "ts-travel", type: "core", status: "healthy" } },
  { id: "auth", type: "topology", position: { x: 500, y: 100 }, data: { label: "ts-auth", type: "core", status: "healthy" } },

  // Business services layer
  { id: "station", type: "topology", position: { x: 50, y: 200 }, data: { label: "ts-station", type: "core", status: "degraded" } },
  { id: "route", type: "topology", position: { x: 200, y: 200 }, data: { label: "ts-route", type: "core", status: "healthy" } },
  { id: "config", type: "topology", position: { x: 350, y: 200 }, data: { label: "ts-config", type: "core", status: "healthy" } },
  { id: "price", type: "topology", position: { x: 500, y: 200 }, data: { label: "ts-price", type: "core", status: "healthy" } },

  // Data services layer
  { id: "seat", type: "topology", position: { x: 100, y: 300 }, data: { label: "ts-seat", type: "data", status: "healthy" } },
  { id: "user", type: "topology", position: { x: 250, y: 300 }, data: { label: "ts-user", type: "data", status: "healthy" } },
  { id: "payment", type: "topology", position: { x: 400, y: 300 }, data: { label: "ts-payment", type: "data", status: "healthy" } },

  // External services
  { id: "mysql", type: "topology", position: { x: 150, y: 400 }, data: { label: "MySQL", type: "external", status: "healthy" } },
  { id: "redis", type: "topology", position: { x: 350, y: 400 }, data: { label: "Redis", type: "external", status: "healthy" } },
]

const topologyEdges: Edge[] = [
  // Gateway connections
  { id: "e1", source: "gateway", target: "order", style: { stroke: "rgba(255,255,255,0.15)" } },
  { id: "e2", source: "gateway", target: "travel", style: { stroke: "rgba(255,255,255,0.15)" } },
  { id: "e3", source: "gateway", target: "auth", style: { stroke: "rgba(255,255,255,0.15)" } },

  // Order connections
  { id: "e4", source: "order", target: "station", style: { stroke: "rgba(255,255,255,0.15)" } },
  { id: "e5", source: "order", target: "config", style: { stroke: "rgba(255,255,255,0.15)" } },

  // Travel connections
  { id: "e6", source: "travel", target: "route", style: { stroke: "rgba(255,255,255,0.15)" } },
  { id: "e7", source: "travel", target: "price", style: { stroke: "rgba(255,255,255,0.15)" } },

  // Station/Route connections
  { id: "e8", source: "station", target: "seat", style: { stroke: "rgba(255,255,255,0.15)" } },
  { id: "e9", source: "route", target: "user", style: { stroke: "rgba(255,255,255,0.15)" } },

  // Price connections
  { id: "e10", source: "price", target: "payment", style: { stroke: "rgba(255,255,255,0.15)" } },

  // Data layer connections
  { id: "e11", source: "seat", target: "mysql", style: { stroke: "rgba(255,255,255,0.1)" } },
  { id: "e12", source: "user", target: "mysql", style: { stroke: "rgba(255,255,255,0.1)" } },
  { id: "e13", source: "payment", target: "mysql", style: { stroke: "rgba(255,255,255,0.1)" } },
  { id: "e14", source: "config", target: "redis", style: { stroke: "rgba(255,255,255,0.1)" } },
]

function TopologyControls({
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

function TopologyLegend({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      "absolute right-4 top-4 z-10 space-y-2 rounded-lg border p-3 text-[10px] backdrop-blur-xl",
      isDark ? "border-white/10 bg-[#0a0a0b]/90" : "border-black/10 bg-white/90"
    )}>
      <div className={cn("mb-2 text-[11px] font-medium", isDark ? "text-white/60" : "text-black/60")}>Service Types</div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded", isDark ? "bg-blue-500/30" : "bg-blue-500/50")} />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Gateway</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded", isDark ? "bg-emerald-500/30" : "bg-emerald-500/50")} />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Core Service</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded", isDark ? "bg-violet-500/30" : "bg-violet-500/50")} />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Data Service</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded", isDark ? "bg-orange-500/30" : "bg-orange-500/50")} />
        <span className={isDark ? "text-white/50" : "text-black/60"}>External</span>
      </div>
      <div className={cn("mt-3 border-t pt-2 text-[11px] font-medium", isDark ? "border-white/10 text-white/60" : "border-black/10 text-black/60")}>
        Status
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Healthy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Degraded</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className={isDark ? "text-white/50" : "text-black/60"}>Error</span>
      </div>
    </div>
  )
}

function TopologyViewInner({ highlightedService }: TopologyViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [nodes, setNodes] = useNodesState(topologyNodes)
  const [edges, setEdges] = useEdgesState(topologyEdges)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const { setCenter } = useReactFlow()

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

  // Update edge colors when theme changes
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        style: {
          ...edge.style,
          stroke: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)",
        },
      }))
    )
  }, [isDark, setEdges])

  // Handle highlighting when a service is selected and update isDark on nodes
  useEffect(() => {
    if (highlightedService) {
      // Find the node that matches the service name
      const serviceNameLower = highlightedService.toLowerCase()

      // Find matching node from the constant (positions don't change)
      const matchedNode = topologyNodes.find((node) => {
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
          setCenter(matchedNode.position.x + 50, matchedNode.position.y + 20, { zoom: 1.5, duration: 500 })
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
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className={isDark ? "bg-[#0a0a0b]" : "bg-[#f8f9fa]"}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} gap={24} size={1} />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const status = node.data.status as string
              if (status === "error") return "#ef4444"
              if (status === "degraded") return "#eab308"
              return isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"
            }}
            maskColor={isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)"}
            className={cn(
              "!bottom-4 !right-4 !h-24 !w-36 !rounded-lg !border",
              isDark ? "!border-white/10 !bg-[#0a0a0b]/90" : "!border-black/10 !bg-white/90"
            )}
          />
        )}
      </ReactFlow>
      <TopologyControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        isDark={isDark}
      />
      <TopologyLegend isDark={isDark} />
    </div>
  )
}

export function TopologyView({ highlightedService }: TopologyViewProps) {
  return (
    <ReactFlowProvider>
      <TopologyViewInner highlightedService={highlightedService} />
    </ReactFlowProvider>
  )
}
