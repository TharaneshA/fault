import { useEffect, useState } from "react"
import { Brain, CheckCircle2, AlertTriangle, Lightbulb, Loader2, AlertCircle } from "lucide-react"
import { getExplanation, ExplanationResult } from "@/lib/api"

interface ExplanationViewProps {
  analysisReady?: boolean
}

export function ExplanationView({ analysisReady = false }: ExplanationViewProps) {
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (analysisReady) {
      fetchExplanation()
    }
  }, [analysisReady])

  const fetchExplanation = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getExplanation(true)
      setExplanation(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate explanation")
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto" />
          <p className="text-[13px] text-app-muted">Generating CCRE explanation...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-[13px] text-red-400">{error}</p>
          <button
            onClick={fetchExplanation}
            className="text-[12px] text-purple-400 hover:text-purple-300 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Not ready state
  if (!analysisReady || !explanation) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <Brain className="h-8 w-8 text-app-muted mx-auto" />
          <p className="text-[13px] text-app-muted">Run analysis first to generate explanation</p>
        </div>
      </div>
    )
  }

  const { root_cause_summary, failure_chain, evidence, recommendations, confidence_breakdown } = explanation

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* LLM-Generated Explanation */}
      <div className="md:col-span-2 rounded-lg border border-app bg-app-surface">
        <div className="border-b border-app px-4 py-3">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <h2 className="text-[14px] font-semibold text-app">CCRE Analysis</h2>
            <span className="rounded border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-medium text-purple-500">
              LLM-Generated
            </span>
          </div>
          <p className="text-[11px] text-app-muted mt-0.5">
            Causal Chain Reasoning Explanation powered by Gemini
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-app bg-app-tertiary p-4 space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center text-[13px] text-app">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Root Cause Identification
              </h4>
              <p className="text-[12px] text-app-secondary leading-relaxed">
                {root_cause_summary}
              </p>
            </div>

            <div className="h-px bg-app-tertiary" />

            <div>
              <h4 className="font-medium mb-2 flex items-center text-[13px] text-app">
                <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                Failure Propagation Chain
              </h4>
              <ol className="text-[12px] text-app-secondary mt-2 space-y-2 list-decimal list-inside">
                {failure_chain.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="h-px bg-app-tertiary" />

            <div>
              <h4 className="font-medium mb-2 flex items-center text-[13px] text-app">
                <Lightbulb className="h-4 w-4 mr-2 text-blue-500" />
                Supporting Evidence
              </h4>
              <div className="grid gap-3 md:grid-cols-3 mt-2">
                <div className="rounded-md border border-app bg-app-surface p-3">
                  <div className="text-[10px] text-app-muted mb-1">Metrics</div>
                  <ul className="text-[12px] text-app-secondary space-y-1">
                    {evidence.metrics.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-app bg-app-surface p-3">
                  <div className="text-[10px] text-app-muted mb-1">Traces</div>
                  <ul className="text-[12px] text-app-secondary space-y-1">
                    {evidence.traces.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-app bg-app-surface p-3">
                  <div className="text-[10px] text-app-muted mb-1">Logs</div>
                  <ul className="text-[12px] text-app-secondary space-y-1">
                    {evidence.logs.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div className="rounded-lg border border-app bg-app-surface">
        <div className="border-b border-app px-4 py-3">
          <h2 className="text-[13px] font-semibold text-app">Confidence Breakdown</h2>
          <p className="text-[11px] text-app-muted">
            How each data modality contributed to the diagnosis
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-app-secondary">CMEA (Metrics)</span>
              <span className="text-[12px] font-medium text-app">{Math.round(confidence_breakdown.cmea * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-app-tertiary overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${confidence_breakdown.cmea * 100}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-app-secondary">INGD (Traces)</span>
              <span className="text-[12px] font-medium text-app">{Math.round(confidence_breakdown.ingd * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-app-tertiary overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${confidence_breakdown.ingd * 100}%` }} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-app-secondary">CCRE (Logs + LLM)</span>
              <span className="text-[12px] font-medium text-app">{Math.round(confidence_breakdown.ccre * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-app-tertiary overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${confidence_breakdown.ccre * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-lg border border-app bg-app-surface">
        <div className="border-b border-app px-4 py-3">
          <h2 className="text-[13px] font-semibold text-app">Recommendations</h2>
          <p className="text-[11px] text-app-muted">
            Suggested actions to prevent recurrence
          </p>
        </div>
        <div className="p-4">
          <ul className="space-y-3 text-[12px]">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start space-x-2">
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                  rec.priority === "high" ? "bg-emerald-500" :
                  rec.priority === "medium" ? "bg-yellow-500" : "bg-gray-500"
                }`} />
                <span className="text-app-secondary">{rec.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
