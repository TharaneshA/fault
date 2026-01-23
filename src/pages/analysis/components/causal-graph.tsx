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
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip-simple"

interface CausalGraphProps {
  highlightedService?: string | null
}

// Custom node component for services
function ServiceNode({
  data,
}: {
  data: { label: string; isRootCause: boolean; confidence?: number; isHighlighted?: boolean }
}) {
  return (
    <div
      className={cn(
        "min-w-[120px] rounded-lg border px-3 py-2 text-center shadow-lg transition-all",
        data.isHighlighted
          ? "border-blue-500 bg-blue-500/20 shadow-blue-500/40 ring-2 ring-blue-500/50 animate-pulse"
          : data.isRootCause
            ? "border-red-500/50 bg-red-500/10 shadow-red-500/20"
            : "border-white/10 bg-[#151518] shadow-black/20"
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
      <div
        className={cn(
          "font-mono text-[11px]",
          data.isHighlighted ? "text-blue-400 font-bold" : data.isRootCause ? "text-red-400" : "text-white/80"
        )}
      >
        {data.label}
      </div>
      {data.confidence !== undefined && (
        <div
          className={cn(
            "mt-0.5 text-[10px] tabular-nums",
            data.confidence >= 0.9
              ? "text-emerald-400"
              : data.confidence >= 0.7
                ? "text-yellow-400"
                : "text-white/40"
          )}
        >
          {(data.confidence * 100).toFixed(0)}%
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-[#0a0a0b] !bg-white/30"
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

function GraphLegend() {
  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-4 rounded-lg border border-white/10 bg-[#0a0a0b]/90 px-3 py-2 text-[11px] backdrop-blur-xl">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-white/50">Root Cause</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-red-500" />
        <span className="text-white/50">Critical Path</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-white/20" />
        <span className="text-white/50">Dependency</span>
      </div>
    </div>
  )
}

function CausalGraphInner({ highlightedService }: CausalGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const { fitView, setCenter } = useReactFlow()

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
            || serviceNameLower.includes(nodeLabel.replace("ts-", "").replace("-service", ""))

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
      const matchedNode = nodes.find((node) => {
        const nodeLabel = (node.data as { label: string }).label.toLowerCase()
        return nodeLabel.includes(serviceNameLower.replace("ts-", "").replace("-service", ""))
          || serviceNameLower.includes(nodeLabel.replace("ts-", "").replace("-service", ""))
      })

      if (matchedNode) {
        setTimeout(() => {
          setCenter(matchedNode.position.x + 60, matchedNode.position.y + 30, { zoom: 1.2, duration: 500 })
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0b]"
      >
        <Background color="rgba(255,255,255,0.03)" gap={24} size={1} />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) =>
              node.data.isRootCause ? "#ef4444" : "rgba(255,255,255,0.3)"
            }
            maskColor="rgba(0,0,0,0.8)"
            className="!bottom-4 !right-4 !h-24 !w-36 !rounded-lg !border !border-white/10 !bg-[#0a0a0b]/90"
          />
        )}
      </ReactFlow>
      <GraphControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
      />
      <GraphLegend />
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
