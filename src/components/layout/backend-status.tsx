"use client"

import { useBackendStatus, BackendStatus } from "@/hooks/use-backend-status"
import { Tooltip } from "@/components/ui/tooltip-simple"
import { cn } from "@/lib/utils"

const statusConfig: Record<BackendStatus, {
  label: string
  dotClass: string
  pulseClass?: string
  tooltipText: string
}> = {
  connected: {
    label: "Backend",
    dotClass: "bg-emerald-500",
    tooltipText: "Backend connected",
  },
  connecting: {
    label: "Backend",
    dotClass: "bg-amber-500",
    pulseClass: "animate-pulse",
    tooltipText: "Connecting to backend...",
  },
  disconnected: {
    label: "Backend",
    dotClass: "bg-red-500",
    tooltipText: "Backend disconnected",
  },
}

export function BackendStatusIndicator() {
  const { status, lastError, refresh } = useBackendStatus({
    interval: 5000,
    showToasts: true,
  })

  const config = statusConfig[status]
  const tooltipContent = lastError
    ? `${config.tooltipText}\n${lastError}`
    : config.tooltipText

  return (
    <Tooltip content={tooltipContent}>
      <button
        onClick={refresh}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded px-2",
          "text-app-muted transition-colors",
          "hover:bg-app-tertiary hover:text-app-secondary",
          status === "disconnected" && "text-red-400 hover:text-red-300"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full flex-shrink-0",
            config.dotClass,
            config.pulseClass
          )}
        />
        <span className="text-[11px] font-medium translate-y-[1.5px]">{config.label}</span>
      </button>
    </Tooltip>
  )
}
