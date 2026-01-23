import { useState } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

const tabs = [
  { id: "model", label: "Model" },
  { id: "thresholds", label: "Thresholds" },
  { id: "data", label: "Data Sources" },
  { id: "appearance", label: "Appearance" },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("model")

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-black tracking-normal text-app">Settings</h1>
        <p className="text-[13px] text-app-muted">
          Configure model parameters and preferences
        </p>
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
      <div className="max-w-3xl">
        {activeTab === "model" && <ModelSettings />}
        {activeTab === "thresholds" && <ThresholdSettings />}
        {activeTab === "data" && <DataSettings />}
        {activeTab === "appearance" && <AppearanceSettings />}
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center gap-3">
        <button className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-700">
          Save Changes
        </button>
        <button className="rounded-md border border-app bg-app-surface px-3 py-1.5 text-[12px] font-medium text-app-secondary transition-colors hover:bg-app-tertiary hover:text-app">
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}

function ModelSettings() {
  return (
    <div className="space-y-6">
      <SettingsSection title="CMEA Configuration" description="Contrastive Metric Embedding Analysis">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsSelect label="Embedding Dimension" options={["64", "128", "256", "512"]} defaultValue="128" />
          <SettingsInput label="Time Window (s)" type="number" defaultValue="30" />
          <SettingsSlider label="Contrastive Temperature" min={0.01} max={0.2} step={0.01} defaultValue={0.07} />
          <SettingsSelect label="Metric Types" options={["All Types", "CPU + Memory", "Custom"]} defaultValue="All Types" />
        </div>
      </SettingsSection>

      <SettingsSection title="INGD Configuration" description="Invocation-level Noise Graph Diffusion">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsInput label="Diffusion Steps" type="number" defaultValue="100" />
          <SettingsSelect label="Noise Schedule" options={["Linear", "Cosine", "Sigmoid"]} defaultValue="Cosine" />
          <SettingsSelect label="Graph Construction" options={["Service-level", "Instance-level", "Hybrid"]} defaultValue="Service-level" />
          <SettingsSlider label="Edge Weight Threshold" min={0} max={1} step={0.05} defaultValue={0.3} />
        </div>
      </SettingsSection>

      <SettingsSection title="CCRE Configuration" description="Causal Chain Reasoning Explanation">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsSelect label="LLM Model" options={["GPT-4", "GPT-4 Turbo", "Claude 3", "LLaMA 2"]} defaultValue="GPT-4" />
          <SettingsInput label="API Key" type="password" placeholder="sk-..." />
          <SettingsInput label="Max Tokens" type="number" defaultValue="1024" />
          <SettingsSlider label="Temperature" min={0} max={1} step={0.1} defaultValue={0.3} />
        </div>
        <SettingsToggle label="Generate natural language explanations" defaultChecked />
      </SettingsSection>
    </div>
  )
}

function ThresholdSettings() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Detection Thresholds" description="Configure sensitivity for anomaly detection">
        <div className="space-y-4">
          <SettingsSlider label="Confidence Threshold" min={0} max={1} step={0.05} defaultValue={0.7} hint="Minimum confidence score to report a root cause" />
          <SettingsSlider label="Anomaly Sensitivity" min={0} max={1} step={0.05} defaultValue={0.85} hint="Higher values detect more anomalies" />
          <SettingsSlider label="Propagation Depth" min={1} max={10} step={1} defaultValue={3} hint="Maximum hops in service graph" />
          <SettingsSlider label="Top-K Results" min={1} max={10} step={1} defaultValue={5} hint="Number of candidates to return" />
        </div>
      </SettingsSection>

      <SettingsSection title="Alert Thresholds" description="Configure when to trigger alerts">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsInput label="CPU Usage Alert (%)" type="number" defaultValue="80" />
          <SettingsInput label="Memory Usage Alert (%)" type="number" defaultValue="85" />
          <SettingsInput label="Latency Alert (ms)" type="number" defaultValue="500" />
          <SettingsInput label="Error Rate Alert (%)" type="number" defaultValue="5" />
        </div>
      </SettingsSection>
    </div>
  )
}

function DataSettings() {
  const sources = [
    { name: "Prometheus", desc: "Metrics collection", status: "connected", color: "bg-blue-500/20 text-blue-500" },
    { name: "Jaeger", desc: "Distributed tracing", status: "connected", color: "bg-yellow-500/20 text-yellow-500" },
    { name: "Elasticsearch", desc: "Log aggregation", status: "disconnected", color: "bg-emerald-500/20 text-emerald-500" },
  ]

  return (
    <div className="space-y-6">
      <SettingsSection title="Data Sources" description="Configure connections to monitoring systems">
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-md border border-app bg-app-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded text-[12px] font-bold", s.color)}>
                  {s.name[0]}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-app">{s.name}</p>
                  <p className="text-[11px] text-app-muted">{s.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  s.status === "connected" ? "bg-emerald-500/20 text-emerald-500" : "bg-yellow-500/20 text-yellow-500"
                )}>
                  {s.status}
                </span>
                <button className="text-[11px] text-app-muted hover:text-app-secondary">Configure</button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Dataset Import" description="Import pre-collected dataset for analysis">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsSelect label="Dataset" options={["GAIA (Train-Ticket)", "RCAEval", "Custom"]} defaultValue="GAIA (Train-Ticket)" />
          <SettingsInput label="Data Path" placeholder="/data/gaia/" />
        </div>
        <button className="mt-4 rounded-md bg-app-tertiary px-3 py-1.5 text-[12px] font-medium text-app-secondary transition-colors hover:bg-app-surface-hover hover:text-app">
          Import Dataset
        </button>
      </SettingsSection>
    </div>
  )
}

function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <SettingsSection title="Theme" description="Customize the application appearance">
        <SettingsSelect label="Color Theme" options={["Dark", "Light", "System"]} defaultValue="Dark" />
      </SettingsSection>

      <SettingsSection title="Graph View" description="Configure visualization options">
        <div className="space-y-3">
          <SettingsToggle label="Show Minimap in Graph View" hint="Display a minimap for easier navigation" defaultChecked />
          <SettingsToggle label="Animate Graph Edges" hint="Show animated edges for high-impact paths" defaultChecked />
          <SettingsToggle label="Compact Table View" hint="Use smaller row height in data tables" />
        </div>
      </SettingsSection>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-app bg-app-surface">
      <div className="border-b border-app px-4 py-3">
        <h2 className="text-[13px] font-medium text-app">{title}</h2>
        <p className="text-[11px] text-app-muted">{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SettingsInput({
  label,
  type = "text",
  placeholder,
  defaultValue,
}: {
  label: string
  type?: string
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-app-secondary">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-app bg-app-tertiary px-3 py-1.5 text-[13px] text-app placeholder-app-muted outline-none transition-colors focus:border-blue-500"
      />
    </div>
  )
}

function SettingsSelect({
  label,
  options,
  defaultValue,
}: {
  label: string
  options: string[]
  defaultValue: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-app-secondary">{label}</label>
      <select
        defaultValue={defaultValue}
        className="w-full rounded-md border border-app bg-app-tertiary px-3 py-1.5 text-[13px] text-app outline-none transition-colors focus:border-blue-500"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-app-bg-secondary">
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function SettingsSlider({
  label,
  min,
  max,
  step,
  defaultValue,
  hint,
}: {
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-app-secondary">{label}</label>
        <span className="text-[11px] tabular-nums text-app-muted">{defaultValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        className="w-full accent-blue-500"
      />
      {hint && <p className="text-[10px] text-app-muted">{hint}</p>}
    </div>
  )
}

function SettingsToggle({
  label,
  hint,
  defaultChecked,
}: {
  label: string
  hint?: string
  defaultChecked?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[12px] font-medium text-app">{label}</p>
        {hint && <p className="text-[10px] text-app-muted">{hint}</p>}
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={cn(
          "flex h-5 w-9 items-center rounded-full px-0.5 transition-colors",
          checked ? "bg-emerald-500" : "bg-app-tertiary"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
    </div>
  )
}
