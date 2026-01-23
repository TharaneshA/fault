import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

const cases = [
  {
    id: "RE2-047",
    service: "ts-order-service",
    faultType: "CPU Stress",
    confidence: 0.94,
    time: "2m ago",
  },
  {
    id: "RE2-048",
    service: "ts-travel-service",
    faultType: "Memory Leak",
    confidence: 0.87,
    time: "15m ago",
  },
  {
    id: "RE2-049",
    service: "ts-auth-service",
    faultType: "Network Delay",
    confidence: null,
    time: "32m ago",
  },
  {
    id: "RE2-050",
    service: "ts-payment-service",
    faultType: "Pod Failure",
    confidence: null,
    time: "1h ago",
  },
  {
    id: "RE2-051",
    service: "ts-station-service",
    faultType: "CPU Stress",
    confidence: 0.91,
    time: "2h ago",
  },
]

const faultColors: Record<string, string> = {
  "CPU Stress": "bg-orange-500/20 text-orange-500",
  "Memory Leak": "bg-violet-500/20 text-violet-500",
  "Network Delay": "bg-blue-500/20 text-blue-500",
  "Pod Failure": "bg-red-500/20 text-red-500",
}

export function RecentCases() {
  const navigate = useNavigate()

  return (
    <div className="space-y-0.5">
      {cases.map((c) => (
        <button
          key={c.id}
          onClick={() => navigate(`/analysis/${c.id}`)}
          className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-app-surface-hover"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-app">{c.id}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  faultColors[c.faultType]
                )}
              >
                {c.faultType}
              </span>
            </div>
            <p className="truncate text-[11px] text-app-muted">{c.service}</p>
          </div>
          <div className="text-right">
            {c.confidence ? (
              <p
                className={cn(
                  "text-[12px] font-medium tabular-nums",
                  c.confidence >= 0.9
                    ? "text-emerald-500"
                    : c.confidence >= 0.8
                      ? "text-yellow-500"
                      : "text-orange-500"
                )}
              >
                {(c.confidence * 100).toFixed(0)}%
              </p>
            ) : (
              <p className="text-[12px] text-app-muted">--</p>
            )}
            <p className="text-[10px] text-app-muted">{c.time}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
