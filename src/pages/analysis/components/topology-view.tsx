import { useState, useCallback, useEffect } from "react"
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
  Map,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip-simple"

interface TopologyViewProps {
  highlightedService?: string | null
}

// Service types for different styling
type ServiceType = "gateway" | "core" | "data" | "external"

const serviceTypeColors: Record<ServiceType, { bg: string; border: string; text: string }> = {
  gateway: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  core: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  data: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400" },
  external: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
}

function TopologyNode({
  data,
}: {
  data: { label: string; type: ServiceType; status: "healthy" | "degraded" | "error"; isHighlighted?: boolean }
}) {
  const colors = serviceTypeColors[data.type]
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
          : cn(colors.bg, colors.border)
      )}
      style={data.isHighlighted ? {
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)"
      } : undefined}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-[#0a0a0b] !bg-white/30"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-[#0a0a0b] !bg-white/30"
      />
      <div className="flex items-center justify-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", statusColors[data.status])} />
        <span className={cn(
          "font-mono text-[10px]",
          data.isHighlighted ? "text-blue-400 font-bold" : colors.text
        )}>
          {data.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-[#0a0a0b] !bg-white/30"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-[#0a0a0b] !bg-white/30"
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
}: {
  isFullscreen: boolean
  onToggleFullscreen: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0a0a0b]/90 p-1 backdrop-blur-xl">
      <Tooltip content="Zoom in">
        <button
          onClick={() => zoomIn()}
          className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Zoom out">
        <button
          onClick={() => zoomOut()}
          className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Fit view">
        <button
          onClick={() => fitView({ padding: 0.2 })}
          className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Target className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <div className="mx-1 h-4 w-px bg-white/10" />
      <Tooltip content={showMinimap ? "Hide minimap" : "Show minimap"}>
        <button
          onClick={onToggleMinimap}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            showMinimap
              ? "bg-white/10 text-white"
              : "text-white/50 hover:bg-white/10 hover:text-white"
          )}
        >
          <Map className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
        <button
          onClick={onToggleFullscreen}
          className="flex h-7 w-7 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
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

function TopologyLegend() {
  return (
    <div className="absolute right-4 top-4 z-10 space-y-2 rounded-lg border border-white/10 bg-[#0a0a0b]/90 p-3 text-[10px] backdrop-blur-xl">
      <div className="mb-2 text-[11px] font-medium text-white/60">Service Types</div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded bg-blue-500/30" />
        <span className="text-white/50">Gateway</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded bg-emerald-500/30" />
        <span className="text-white/50">Core Service</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded bg-violet-500/30" />
        <span className="text-white/50">Data Service</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded bg-orange-500/30" />
        <span className="text-white/50">External</span>
      </div>
      <div className="mt-3 border-t border-white/10 pt-2 text-[11px] font-medium text-white/60">
        Status
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-white/50">Healthy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        <span className="text-white/50">Degraded</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-white/50">Error</span>
      </div>
    </div>
  )
}

function TopologyViewInner({ highlightedService }: TopologyViewProps) {
  const [nodes, setNodes] = useNodesState(topologyNodes)
  const [edges] = useEdgesState(topologyEdges)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const { setCenter } = useReactFlow()

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // Handle highlighting when a service is selected
  useEffect(() => {
    if (highlightedService) {
      // Find the node that matches the service name
      const serviceNameLower = highlightedService.toLowerCase()

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const nodeLabel = (node.data as { label: string }).label.toLowerCase()
          const isMatch = nodeLabel.includes(serviceNameLower.replace("ts-", "").replace("-service", ""))
            || serviceNameLower.includes(nodeLabel.replace("ts-", ""))

          return {
            ...node,
            data: {
              ...node.data,
              isHighlighted: isMatch,
            },
          }
        })
      )

      // Center on the highlighted node
      const matchedNode = topologyNodes.find((node) => {
        const nodeLabel = (node.data as { label: string }).label.toLowerCase()
        return nodeLabel.includes(serviceNameLower.replace("ts-", "").replace("-service", ""))
          || serviceNameLower.includes(nodeLabel.replace("ts-", ""))
      })

      if (matchedNode) {
        setTimeout(() => {
          setCenter(matchedNode.position.x + 50, matchedNode.position.y + 20, { zoom: 1.5, duration: 500 })
        }, 100)
      }
    } else {
      // Clear all highlights
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isHighlighted: false,
          },
        }))
      )
    }
  }, [highlightedService, setNodes, setCenter, nodes])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-app bg-[#0a0a0b]",
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
        className="bg-[#0a0a0b]"
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="rgba(255,255,255,0.03)" gap={24} size={1} />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const status = node.data.status as string
              if (status === "error") return "#ef4444"
              if (status === "degraded") return "#eab308"
              return "rgba(255,255,255,0.3)"
            }}
            maskColor="rgba(0,0,0,0.8)"
            className="!bottom-4 !right-4 !h-24 !w-36 !rounded-lg !border !border-white/10 !bg-[#0a0a0b]/90"
          />
        )}
      </ReactFlow>
      <TopologyControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
      />
      <TopologyLegend />
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
