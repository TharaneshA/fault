import { Overview } from "@/dashboard/components/overview"
import { RecentCases } from "@/dashboard/components/recent-cases"
import {
  TrendingUp,
  Activity,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"

function StatItem({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string
  value: string
  trend?: string
  trendUp?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-app-muted">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums tracking-normal text-app">
          {value}
        </span>
        {trend && (
          <span
            className={`flex items-center text-xs font-medium ${trendUp ? "text-emerald-500" : "text-red-500"}`}
          >
            {trendUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="min-h-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-black tracking-normal text-app">Overview</h1>
        <p className="text-[13px] text-app-secondary">
          Multi-modal root cause analysis performance
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-8 flex items-center gap-8 border-b border-app pb-6">
        <StatItem label="Total Cases" value="270" />
        <div className="h-8 w-px bg-app-tertiary" />
        <StatItem label="Analyzed" value="264" trend="+12" trendUp />
        <div className="h-8 w-px bg-app-tertiary" />
        <StatItem label="Top@1 Accuracy" value="89.3%" trend="+4.1%" trendUp />
        <div className="h-8 w-px bg-app-tertiary" />
        <StatItem label="Avg. Time" value="2.3s" trend="-0.8s" trendUp />
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Chart Section */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-app bg-app-surface">
            <div className="flex items-center justify-between border-b border-app px-4 py-3">
              <h2 className="text-[13px] font-semibold text-app">Accuracy by Fault Type</h2>
              <div className="flex items-center gap-4 text-[11px] text-app-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  CMEA
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  INGD
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  CCRE
                </span>
              </div>
            </div>
            <div className="p-4">
              <Overview />
            </div>
          </div>

          {/* Component Contribution */}
          <div className="mt-6 rounded-lg border border-app bg-app-surface">
            <div className="border-b border-app px-4 py-3">
              <h2 className="text-[13px] font-semibold text-app">Component Contribution</h2>
            </div>
            <div className="space-y-3 p-4">
              <ContributionBar label="CMEA" sublabel="Metrics" value={42} color="bg-blue-500" />
              <ContributionBar label="INGD" sublabel="Traces" value={35} color="bg-emerald-500" />
              <ContributionBar label="CCRE" sublabel="Logs + LLM" value={23} color="bg-violet-500" />
            </div>
          </div>
        </div>

        {/* Recent Cases */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-app bg-app-surface">
            <div className="flex items-center justify-between border-b border-app px-4 py-3">
              <h2 className="text-[13px] font-semibold text-app">Recent Cases</h2>
              <button className="text-[11px] text-app-muted hover:text-app-secondary">
                View all
              </button>
            </div>
            <div className="p-2">
              <RecentCases />
            </div>
          </div>

          {/* Dataset Stats */}
          <div className="mt-6 rounded-lg border border-app bg-app-surface">
            <div className="border-b border-app px-4 py-3">
              <h2 className="text-[13px] font-semibold text-app">Dataset Statistics</h2>
            </div>
            <div className="divide-y divide-app">
              <DatasetRow name="GAIA (D1)" system="Train-Ticket" count={135} accuracy={91.2} />
              <DatasetRow name="GAIA (D2)" system="Train-Ticket" count={135} accuracy={87.4} />
              <DatasetRow name="RCAEval" system="Various" count={180} accuracy={84.8} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContributionBar({
  label,
  sublabel,
  value,
  color,
}: {
  label: string
  sublabel: string
  value: number
  color: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-app">
          {label} <span className="text-app-muted">({sublabel})</span>
        </span>
        <span className="tabular-nums text-app-secondary">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-app-tertiary">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function DatasetRow({
  name,
  system,
  count,
  accuracy,
}: {
  name: string
  system: string
  count: number
  accuracy: number
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div>
        <p className="text-[13px] font-medium text-app">{name}</p>
        <p className="text-[11px] text-app-muted">{system}</p>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-medium tabular-nums text-app">{count}</p>
        <p className="text-[11px] tabular-nums text-emerald-500">{accuracy}%</p>
      </div>
    </div>
  )
}
