import { useState } from "react"
import { cn } from "@/lib/utils"
import { Download, ArrowUpRight, ArrowDownRight } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"

const benchmarkData = [
  { algorithm: "INGD (Ours)", top1: 82.5, top3: 93.0, top5: 96.5, avgTime: 2.3 },
  { algorithm: "DiagFusion", top1: 85.2, top3: 90.4, top5: 93.8, avgTime: 3.1 },
  { algorithm: "MicroRCA", top1: 78.6, top3: 85.2, top5: 89.1, avgTime: 4.7 },
  { algorithm: "CloudRanger", top1: 72.4, top3: 79.8, top5: 84.5, avgTime: 5.2 },
  { algorithm: "MonitorRank", top1: 68.9, top3: 75.3, top5: 80.2, avgTime: 2.8 },
  { algorithm: "Microscope", top1: 65.1, top3: 71.6, top5: 76.9, avgTime: 6.1 },
]

const chartData = benchmarkData.map((d) => ({
  name: d.algorithm,
  "Top@1": d.top1,
  "Top@3": d.top3,
  "Top@5": d.top5,
}))

const radarData = [
  { metric: "Top@1", "INGD (Ours)": 82.5, DiagFusion: 85.2, MicroRCA: 78.6 },
  { metric: "Top@3", "INGD (Ours)": 93.0, DiagFusion: 90.4, MicroRCA: 85.2 },
  { metric: "Top@5", "INGD (Ours)": 96.5, DiagFusion: 93.8, MicroRCA: 89.1 },
  { metric: "Speed", "INGD (Ours)": 95, DiagFusion: 85, MicroRCA: 70 },
  { metric: "Precision", "INGD (Ours)": 86.4, DiagFusion: 87.5, MicroRCA: 80.3 },
]

const tabs = [
  { id: "algorithms", label: "Algorithms" },
  { id: "datasets", label: "Datasets" },
  { id: "ablation", label: "Ablation" },
]

export default function ComparisonPage() {
  const [activeTab, setActiveTab] = useState("algorithms")

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-black tracking-normal text-app">Benchmarks</h1>
          <p className="text-[13px] text-app-muted">
            Algorithm comparison across 270 test cases
          </p>
        </div>
        <button className="flex items-center gap-1.5 rounded-md border border-app bg-app-surface px-3 py-1.5 text-[12px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Stats Row */}
      <div className="mb-6 flex items-center gap-8 border-b border-app pb-6">
        <StatItem label="Top@1" value="82.5%" trend="-2.7%" trendUp={false} />
        <div className="h-8 w-px bg-app-tertiary" />
        <StatItem label="Top@3" value="93.0%" trend="+2.6%" trendUp />
        <div className="h-8 w-px bg-app-tertiary" />
        <StatItem label="Avg Time" value="2.3s" trend="-26%" trendUp />
        <div className="h-8 w-px bg-app-tertiary" />
        <StatItem label="Test Cases" value="270" />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-app">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-3 py-2 text-[13px] font-medium transition-colors",
              activeTab === tab.id
                ? "text-app"
                : "text-app-muted hover:text-app-secondary"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "algorithms" && <AlgorithmsTab />}
      {activeTab === "datasets" && <DatasetsTab />}
      {activeTab === "ablation" && <AblationTab />}
    </div>
  )
}

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
        <span className="text-xl font-black tabular-nums tracking-normal text-app">{value}</span>
        {trend && (
          <span
            className={cn(
              "flex items-center text-[11px] font-medium",
              trendUp ? "text-emerald-500" : "text-red-500"
            )}
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

function AlgorithmsTab() {
  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-app bg-app-surface">
          <div className="border-b border-app px-4 py-3">
            <h2 className="text-[13px] font-medium text-app">Accuracy Comparison</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={1} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} domain={[50, 100]} />
                <Tooltip
                  cursor={{ fill: "var(--chart-cursor)" }}
                  contentStyle={{
                    backgroundColor: "var(--chart-tooltip-bg)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: "6px",
                    fontSize: "11px",
                  }}
                />
                <Bar dataKey="Top@1" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Top@3" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Top@5" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-app bg-app-surface">
          <div className="border-b border-app px-4 py-3">
            <h2 className="text-[13px] font-medium text-app">Multi-Metric Radar</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--chart-grid)" />
                <PolarAngleAxis dataKey="metric" stroke="var(--chart-axis)" fontSize={10} />
                <PolarRadiusAxis stroke="var(--chart-axis-secondary)" fontSize={9} domain={[0, 100]} />
                <Radar name="Ours" dataKey="Ours" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Radar name="DiagFusion" dataKey="DiagFusion" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                <Radar name="MicroRCA" dataKey="MicroRCA" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-app bg-app-surface">
        <div className="border-b border-app px-4 py-3">
          <h2 className="text-[13px] font-medium text-app">Detailed Results</h2>
        </div>
        <div className="divide-y divide-app">
          <div className="grid grid-cols-6 gap-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-app-muted">
            <div>Algorithm</div>
            <div className="text-right">Top@1</div>
            <div className="text-right">Top@3</div>
            <div className="text-right">Top@5</div>
            <div className="text-right">Time</div>
            <div className="text-right">Status</div>
          </div>
          {benchmarkData.map((row, i) => (
            <div key={row.algorithm} className="grid grid-cols-6 gap-4 px-4 py-2.5 text-[12px]">
              <div className="font-medium text-app">{row.algorithm}</div>
              <div className={cn("text-right tabular-nums", i === 0 ? "text-emerald-500 font-medium" : "text-app-secondary")}>
                {row.top1.toFixed(1)}%
              </div>
              <div className={cn("text-right tabular-nums", i === 0 ? "text-emerald-500 font-medium" : "text-app-secondary")}>
                {row.top3.toFixed(1)}%
              </div>
              <div className={cn("text-right tabular-nums", i === 0 ? "text-emerald-500 font-medium" : "text-app-secondary")}>
                {row.top5.toFixed(1)}%
              </div>
              <div className="text-right tabular-nums text-app-secondary">{row.avgTime}s</div>
              <div className="text-right">
                {i === 0 ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                    Best
                  </span>
                ) : (
                  <span className="text-app-muted">Baseline</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DatasetsTab() {
  const datasets = [
    { name: "GAIA (D1)", system: "Train-Ticket", cases: 135, top1: 91.2, top3: 95.6 },
    { name: "GAIA (D2)", system: "Train-Ticket", cases: 135, top1: 87.4, top3: 92.6 },
    { name: "RCAEval", system: "Various", cases: 180, top1: 84.8, top3: 91.2 },
  ]

  return (
    <div className="space-y-4">
      {datasets.map((d) => (
        <div key={d.name} className="rounded-lg border border-app bg-app-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-medium text-app">{d.name}</h3>
              <p className="text-[11px] text-app-muted">{d.system} · {d.cases} cases</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[18px] font-black tabular-nums tracking-normal text-emerald-500">{d.top1}%</p>
                <p className="text-[10px] text-app-muted">Top@1</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-black tabular-nums tracking-normal text-blue-500">{d.top3}%</p>
                <p className="text-[10px] text-app-muted">Top@3</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AblationTab() {
  const ablation = [
    { config: "INGD (Ours)", desc: "Traces Only Optimization", top1: 82.5, delta: null },
    { config: "CMEA (Prior)", desc: "Metrics Only Baseline", top1: 71.3, delta: -11.2 },
    { config: "CCRE (Prior)", desc: "Logs Only Baseline", top1: 68.9, delta: -13.6 },
  ]

  return (
    <div className="rounded-lg border border-app bg-app-surface">
      <div className="border-b border-app px-4 py-3">
        <h2 className="text-[13px] font-medium text-app">Component Contribution</h2>
        <p className="text-[11px] text-app-muted">Impact of removing each module</p>
      </div>
      <div className="divide-y divide-app">
        {ablation.map((row, i) => (
          <div key={row.config} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-app">{row.config}</p>
              <p className="text-[11px] text-app-muted">{row.desc}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn(
                "text-[16px] font-black tabular-nums tracking-normal",
                i === 0 ? "text-emerald-500" : "text-app"
              )}>
                {row.top1}%
              </span>
              {row.delta !== null && (
                <span className="w-16 text-right text-[12px] tabular-nums text-red-500">
                  {row.delta > 0 ? "+" : ""}{row.delta}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
