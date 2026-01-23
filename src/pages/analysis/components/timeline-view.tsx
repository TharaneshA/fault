import { useState, useMemo, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  Activity,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommit,
  GitMerge,
  Clock,
  ExternalLink,
  Filter,
} from "lucide-react"

interface TimelineViewProps {
  highlightedService?: string | null
}

// Timeline events with parent-child relationships (like git commits)
const timelineEvents = [
  {
    id: "evt-001",
    time: "14:31:45",
    timestamp: 0,
    service: "ts-gateway",
    title: "Request Received",
    message: "HTTP POST /api/orders - Initial request received",
    severity: "info" as const,
    type: "trace" as const,
    parentId: null,
    children: ["evt-002"],
  },
  {
    id: "evt-002",
    time: "14:31:47",
    timestamp: 2,
    service: "ts-order-service",
    title: "Order Processing Started",
    message: "createOrder() initiated, spawning downstream calls",
    severity: "info" as const,
    type: "trace" as const,
    parentId: "evt-001",
    children: ["evt-003", "evt-004", "evt-005"],
  },
  {
    id: "evt-003",
    time: "14:31:50",
    timestamp: 5,
    service: "ts-order-service",
    title: "CPU Usage Warning",
    message: "CPU usage increased to 75% - approaching threshold",
    severity: "warning" as const,
    type: "metric" as const,
    parentId: "evt-002",
    children: ["evt-006"],
  },
  {
    id: "evt-004",
    time: "14:31:52",
    timestamp: 7,
    service: "ts-config-service",
    title: "Config Fetch Started",
    message: "getOrderConfig() - fetching order configuration",
    severity: "info" as const,
    type: "trace" as const,
    parentId: "evt-002",
    children: ["evt-008"],
  },
  {
    id: "evt-005",
    time: "14:31:55",
    timestamp: 10,
    service: "ts-travel-service",
    title: "Availability Check",
    message: "checkAvailability() - querying seat availability",
    severity: "info" as const,
    type: "trace" as const,
    parentId: "evt-002",
    children: ["evt-009"],
  },
  {
    id: "evt-006",
    time: "14:32:05",
    timestamp: 20,
    service: "ts-order-service",
    title: "CPU Spike - Critical",
    message: "CPU usage spike to 98.7% - service degradation imminent",
    severity: "critical" as const,
    type: "metric" as const,
    parentId: "evt-003",
    children: ["evt-007", "evt-010"],
  },
  {
    id: "evt-007",
    time: "14:32:08",
    timestamp: 23,
    service: "ts-order-service",
    title: "Thread Contention",
    message: "High thread contention detected in OrderProcessor - 47 blocked threads",
    severity: "critical" as const,
    type: "log" as const,
    parentId: "evt-006",
    children: [] as string[],
  },
  {
    id: "evt-008",
    time: "14:32:15",
    timestamp: 30,
    service: "ts-config-service",
    title: "Connection Pool Exhausted",
    message: "Connection pool exhausted - 0/50 connections available",
    severity: "error" as const,
    type: "log" as const,
    parentId: "evt-004",
    children: [] as string[],
  },
  {
    id: "evt-009",
    time: "14:32:12",
    timestamp: 27,
    service: "ts-travel-service",
    title: "Upstream Timeout",
    message: "Downstream call timeout from ts-order-service after 5000ms",
    severity: "error" as const,
    type: "trace" as const,
    parentId: "evt-005",
    children: ["evt-011"],
  },
  {
    id: "evt-010",
    time: "14:32:22",
    timestamp: 37,
    service: "ts-gateway",
    title: "Circuit Breaker Opened",
    message: "Circuit breaker activated for ts-order-service - 50% failure rate",
    severity: "critical" as const,
    type: "trace" as const,
    parentId: "evt-006",
    children: [] as string[],
  },
  {
    id: "evt-011",
    time: "14:32:30",
    timestamp: 45,
    service: "ts-route-service",
    title: "Cascade Failure",
    message: "Error rate increased to 12.5% due to upstream failures",
    severity: "error" as const,
    type: "metric" as const,
    parentId: "evt-009",
    children: [] as string[],
  },
  {
    id: "evt-012",
    time: "14:32:45",
    timestamp: 60,
    service: "ts-order-service",
    title: "GC Pause",
    message: "Full GC pause detected: 1.2s - stop-the-world event",
    severity: "critical" as const,
    type: "metric" as const,
    parentId: null,
    children: ["evt-013"],
  },
  {
    id: "evt-013",
    time: "14:33:00",
    timestamp: 75,
    service: "ts-order-service",
    title: "Memory Pressure",
    message: "Memory usage at 94% - approaching OOM threshold",
    severity: "critical" as const,
    type: "metric" as const,
    parentId: "evt-012",
    children: [] as string[],
  },
  {
    id: "evt-014",
    time: "14:33:15",
    timestamp: 90,
    service: "ts-payment-service",
    title: "Retry Storm",
    message: "Retry storm detected: 42 retries/sec from failed upstream calls",
    severity: "error" as const,
    type: "trace" as const,
    parentId: null,
    children: [] as string[],
  },
]

type Severity = "critical" | "error" | "warning" | "info"
type EventType = "metric" | "trace" | "log"

const severityConfig: Record<Severity, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: "text-red-500", bg: "bg-red-500", icon: "bg-red-500/20 border-red-500/50", label: "Critical" },
  error: { color: "text-orange-500", bg: "bg-orange-500", icon: "bg-orange-500/20 border-orange-500/50", label: "Error" },
  warning: { color: "text-yellow-500", bg: "bg-yellow-500", icon: "bg-yellow-500/20 border-yellow-500/50", label: "Warning" },
  info: { color: "text-blue-500", bg: "bg-blue-500", icon: "bg-blue-500/20 border-blue-500/50", label: "Info" },
}

const typeConfig: Record<EventType, { icon: typeof Activity; color: string; label: string }> = {
  metric: { icon: Activity, color: "text-blue-400", label: "Metric" },
  trace: { icon: GitBranch, color: "text-emerald-400", label: "Trace" },
  log: { icon: FileText, color: "text-violet-400", label: "Log" },
}

export function TimelineView({ highlightedService }: TimelineViewProps = {}) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set(["evt-001", "evt-002", "evt-006"]))
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(
    new Set(["critical", "error", "warning", "info"])
  )
  const [selectedTypes, setSelectedTypes] = useState<Set<EventType>>(
    new Set(["metric", "trace", "log"])
  )
  const [highlightedEventIds, setHighlightedEventIds] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Handle highlighting when a service is selected
  useEffect(() => {
    if (highlightedService) {
      const serviceNameLower = highlightedService.toLowerCase()

      // Find all events from this service
      const matchingEventIds = new Set<string>()
      timelineEvents.forEach((event) => {
        const eventServiceLower = event.service.toLowerCase()
        if (
          eventServiceLower.includes(serviceNameLower.replace("ts-", "").replace("-service", "")) ||
          serviceNameLower.includes(eventServiceLower.replace("ts-", ""))
        ) {
          matchingEventIds.add(event.id)

          // Also expand parent chain to make the event visible
          let currentEvent = event
          while (currentEvent.parentId) {
            setExpandedEvents((prev) => {
              const next = new Set(prev)
              next.add(currentEvent.parentId!)
              return next
            })
            currentEvent = timelineEvents.find((e) => e.id === currentEvent.parentId) || currentEvent
            if (!currentEvent.parentId) break
          }
        }
      })

      setHighlightedEventIds(matchingEventIds)

      // Scroll to first matching event
      if (matchingEventIds.size > 0 && scrollContainerRef.current) {
        setTimeout(() => {
          const firstEventId = Array.from(matchingEventIds)[0]
          const element = document.getElementById(`timeline-event-${firstEventId}`)
          if (element && scrollContainerRef.current) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 100)
      }
    } else {
      setHighlightedEventIds(new Set())
    }
  }, [highlightedService])

  // Get root events (no parent)
  const rootEvents = useMemo(() => {
    return timelineEvents.filter((e) => e.parentId === null)
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSeverity = (severity: Severity) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev)
      if (next.has(severity)) {
        if (next.size > 1) next.delete(severity)
      } else {
        next.add(severity)
      }
      return next
    })
  }

  const toggleType = (type: EventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const isEventVisible = (event: typeof timelineEvents[0]) => {
    return selectedSeverities.has(event.severity) && selectedTypes.has(event.type)
  }

  // Recursive render function for tree structure
  const renderEvent = (event: typeof timelineEvents[0], depth: number = 0, isLast: boolean = false) => {
    if (!isEventVisible(event)) return null

    const config = severityConfig[event.severity]
    const typeConf = typeConfig[event.type]
    const TypeIcon = typeConf.icon
    const isExpanded = expandedEvents.has(event.id)
    const hasChildren = event.children.length > 0
    const childEvents = timelineEvents.filter((e) => event.children.includes(e.id))
    const visibleChildren = childEvents.filter(isEventVisible)
    const isHighlighted = highlightedEventIds.has(event.id)

    return (
      <div key={event.id} id={`timeline-event-${event.id}`} className="relative">
        {/* Vertical line connecting to parent */}
        {depth > 0 && (
          <div
            className="absolute left-[19px] top-0 w-px bg-app-tertiary"
            style={{ height: "20px", marginLeft: `${(depth - 1) * 24}px` }}
          />
        )}

        {/* Event row */}
        <div
          className={cn(
            "relative flex items-start gap-3 py-2 px-3 rounded-lg transition-all",
            isHighlighted
              ? "bg-blue-500/20 ring-2 ring-blue-500/50 animate-pulse"
              : "hover:bg-app-tertiary/50"
          )}
          style={{
            marginLeft: `${depth * 24}px`,
            ...(isHighlighted ? { boxShadow: "0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)" } : {})
          }}
        >
          {/* Branch indicator and node */}
          <div className="relative flex items-center shrink-0">
            {/* Horizontal branch line */}
            {depth > 0 && (
              <div className="absolute right-full w-4 h-px bg-app-tertiary top-1/2" />
            )}

            {/* Node circle */}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2",
                config.icon
              )}
            >
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(event.id)}
                  className="flex h-full w-full items-center justify-center"
                >
                  {isExpanded ? (
                    <GitMerge className={cn("h-4 w-4", config.color)} />
                  ) : (
                    <GitCommit className={cn("h-4 w-4", config.color)} />
                  )}
                </button>
              ) : (
                <GitCommit className={cn("h-4 w-4", config.color)} />
              )}
            </div>

            {/* Vertical line to children */}
            {hasChildren && isExpanded && visibleChildren.length > 0 && (
              <div
                className="absolute left-1/2 top-full w-px bg-app-tertiary"
                style={{ height: "16px", transform: "translateX(-50%)" }}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-1">
              {/* Time */}
              <span className="font-mono text-[10px] text-app-muted">
                {event.time}
              </span>

              {/* Service */}
              <span className={cn(
                "font-mono text-[11px] font-medium",
                isHighlighted ? "text-blue-400 font-bold" : "text-app"
              )}>
                {event.service}
              </span>

              {/* Type badge */}
              <span className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
                "bg-app-tertiary"
              )}>
                <TypeIcon className={cn("h-2.5 w-2.5", typeConf.color)} />
                <span className={typeConf.color}>{typeConf.label}</span>
              </span>

              {/* Severity badge */}
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                config.color,
                event.severity === "critical" && "bg-red-500/10",
                event.severity === "error" && "bg-orange-500/10",
                event.severity === "warning" && "bg-yellow-500/10",
                event.severity === "info" && "bg-blue-500/10"
              )}>
                {config.label}
              </span>

              {/* Expand/collapse for children */}
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(event.id)}
                  className="ml-auto flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary"
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      <span>Hide {visibleChildren.length}</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      <span>Show {visibleChildren.length}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Title */}
            <h4 className={cn("text-[12px] font-medium", config.color)}>
              {event.title}
            </h4>

            {/* Message */}
            <p className="text-[11px] text-app-secondary mt-0.5">
              {event.message}
            </p>

            {/* Quick actions on hover */}
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary">
                <ExternalLink className="h-3 w-3" />
                View Details
              </button>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {visibleChildren.map((child, idx) =>
              renderEvent(child, depth + 1, idx === visibleChildren.length - 1)
            )}
          </div>
        )}
      </div>
    )
  }

  const criticalCount = timelineEvents.filter((e) => e.severity === "critical").length
  const errorCount = timelineEvents.filter((e) => e.severity === "error").length
  const warningCount = timelineEvents.filter((e) => e.severity === "warning").length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-medium text-app">Event Timeline</h2>
          <p className="text-[11px] text-app-muted">
            Branching view showing event causality and propagation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Type filters */}
          <div className="flex items-center gap-1 rounded-lg border border-app bg-app-surface p-1">
            {(Object.entries(typeConfig) as [EventType, typeof typeConfig.metric][]).map(
              ([type, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                      selectedTypes.has(type)
                        ? "bg-app-tertiary text-app"
                        : "text-app-muted hover:text-app-secondary"
                    )}
                  >
                    <Icon className={cn("h-3 w-3", selectedTypes.has(type) && config.color)} />
                    {config.label}
                  </button>
                )
              }
            )}
          </div>

          {/* Severity filters */}
          <div className="flex items-center gap-1 rounded-lg border border-app bg-app-surface p-1">
            {(["critical", "error", "warning", "info"] as Severity[]).map((severity) => {
              const config = severityConfig[severity]
              return (
                <button
                  key={severity}
                  onClick={() => toggleSeverity(severity)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                    selectedSeverities.has(severity)
                      ? "bg-app-tertiary text-app"
                      : "text-app-muted hover:text-app-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      selectedSeverities.has(severity) ? config.bg : "bg-app-muted"
                    )}
                  />
                  {config.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Timeline container */}
      <div className="rounded-lg border border-app bg-app-surface overflow-hidden">
        <div ref={scrollContainerRef} className="max-h-[500px] overflow-auto p-4">
          {rootEvents.map((event, idx) => renderEvent(event, 0, idx === rootEvents.length - 1))}
        </div>

        {/* Legend */}
        <div className="border-t border-app bg-app-tertiary px-4 py-2 flex items-center gap-6 text-[10px]">
          <span className="flex items-center gap-1.5 text-app-muted">
            <GitMerge className="h-3.5 w-3.5" />
            Branch point (expandable)
          </span>
          <span className="flex items-center gap-1.5 text-app-muted">
            <GitCommit className="h-3.5 w-3.5" />
            Leaf event
          </span>
          <span className="ml-auto text-app-muted">
            Click nodes to expand/collapse branches
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-6 text-[11px] text-app-muted">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Duration: <span className="font-mono text-app-secondary">14:31:45 - 14:33:15</span> (1m 30s)
        </span>
        <span>
          <span className="font-medium text-red-500">{criticalCount}</span> critical
        </span>
        <span>
          <span className="font-medium text-orange-500">{errorCount}</span> errors
        </span>
        <span>
          <span className="font-medium text-yellow-500">{warningCount}</span> warnings
        </span>
        <span className="ml-auto">
          <span className="font-medium text-app-secondary">{timelineEvents.length}</span> total events
        </span>
      </div>
    </div>
  )
}
