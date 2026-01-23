import { cn } from "@/lib/utils"
import { Search, SlidersHorizontal, Plus, Check, Clock, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"

const cases = [
  {
    id: "RE2-047",
    service: "ts-order-service",
    faultType: "CPU Stress",
    timestamp: "Jan 15, 14:32",
    status: "analyzed",
    rootCause: "ts-order-service",
    confidence: 0.94,
  },
  {
    id: "RE2-048",
    service: "ts-travel-service",
    faultType: "Memory Leak",
    timestamp: "Jan 15, 15:45",
    status: "analyzed",
    rootCause: "ts-config-service",
    confidence: 0.87,
  },
  {
    id: "RE2-049",
    service: "ts-auth-service",
    faultType: "Network Delay",
    timestamp: "Jan 15, 16:22",
    status: "pending",
    rootCause: null,
    confidence: null,
  },
  {
    id: "RE2-050",
    service: "ts-payment-service",
    faultType: "Pod Failure",
    timestamp: "Jan 15, 17:08",
    status: "analyzing",
    rootCause: null,
    confidence: null,
  },
  {
    id: "RE2-051",
    service: "ts-station-service",
    faultType: "CPU Stress",
    timestamp: "Jan 15, 18:15",
    status: "analyzed",
    rootCause: "ts-station-service",
    confidence: 0.91,
  },
  {
    id: "RE2-052",
    service: "ts-route-service",
    faultType: "Network Delay",
    timestamp: "Jan 15, 19:30",
    status: "analyzed",
    rootCause: "ts-travel-service",
    confidence: 0.78,
  },
  {
    id: "RE2-053",
    service: "ts-basic-service",
    faultType: "Memory Leak",
    timestamp: "Jan 16, 08:12",
    status: "analyzed",
    rootCause: "ts-basic-service",
    confidence: 0.92,
  },
  {
    id: "RE2-054",
    service: "ts-seat-service",
    faultType: "CPU Stress",
    timestamp: "Jan 16, 09:45",
    status: "analyzed",
    rootCause: "ts-order-service",
    confidence: 0.88,
  },
]

const faultColors: Record<string, string> = {
  "CPU Stress": "text-orange-500",
  "Memory Leak": "text-violet-500",
  "Network Delay": "text-blue-500",
  "Pod Failure": "text-red-500",
}

const faultDots: Record<string, string> = {
  "CPU Stress": "bg-orange-500",
  "Memory Leak": "bg-violet-500",
  "Network Delay": "bg-blue-500",
  "Pod Failure": "bg-red-500",
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "analyzed":
      return <Check className="h-3.5 w-3.5 text-emerald-500" />
    case "analyzing":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
    default:
      return <Clock className="h-3.5 w-3.5 text-app-muted" />
  }
}

export default function CasesPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-black tracking-normal text-app">Cases</h1>
          <p className="text-[13px] text-app-secondary">
            270 failure cases from GAIA + RCAEval datasets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-3 py-1.5 text-[12px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>
          <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" />
            Import
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-6 text-[12px]">
        <span className="text-app-muted">
          <span className="font-medium text-app">264</span> analyzed
        </span>
        <span className="text-app-muted">
          <span className="font-medium text-app">4</span> pending
        </span>
        <span className="text-app-muted">
          <span className="font-medium text-app">89.3%</span> avg confidence
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
        <input
          type="text"
          placeholder="Search cases by ID, service, or fault type..."
          className="w-full rounded-md border border-app bg-app-surface py-2 pl-10 pr-4 text-[13px] text-app placeholder:text-app-muted outline-none transition-colors focus:border-blue-500 focus:bg-app-secondary"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-app bg-app-surface">
        {/* Header */}
        <div className="grid grid-cols-[80px_1fr_140px_120px_60px_1fr_80px] gap-4 border-b border-app px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-app-muted">
          <div>ID</div>
          <div>Service</div>
          <div>Fault Type</div>
          <div>Time</div>
          <div className="text-center">Status</div>
          <div>Root Cause</div>
          <div className="text-right">Score</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-app">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/analysis/${c.id}`)}
              className="grid w-full grid-cols-[80px_1fr_140px_120px_60px_1fr_80px] gap-4 px-4 py-3 text-left transition-colors hover:bg-app-surface-hover"
            >
              <div className="text-[13px] font-medium text-app">{c.id}</div>
              <div className="truncate font-mono text-[12px] text-app-secondary">
                {c.service}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", faultDots[c.faultType])} />
                <span className={cn("text-[12px]", faultColors[c.faultType])}>
                  {c.faultType}
                </span>
              </div>
              <div className="text-[12px] text-app-muted">{c.timestamp}</div>
              <div className="flex justify-center">
                <StatusIcon status={c.status} />
              </div>
              <div className="truncate font-mono text-[12px] text-app-secondary">
                {c.rootCause || "—"}
              </div>
              <div className="text-right">
                {c.confidence ? (
                  <span
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
                  </span>
                ) : (
                  <span className="text-[12px] text-app-muted">—</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pagination hint */}
      <div className="mt-4 text-center text-[11px] text-app-muted">
        Showing 8 of 270 cases
      </div>
    </div>
  )
}
