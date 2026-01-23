import { Brain, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react"

export function ExplanationView() {
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
            Causal Chain Reasoning Explanation powered by GPT-4
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
                The primary root cause of this failure is <span className="font-mono text-app">ts-order-service</span> experiencing
                a <strong className="text-orange-500">CPU stress event</strong>. Analysis of metrics shows CPU utilization spiking to 98.7%
                at 14:32:05, coinciding with increased request latency and thread contention.
              </p>
            </div>

            <div className="h-px bg-app-tertiary" />

            <div>
              <h4 className="font-medium mb-2 flex items-center text-[13px] text-app">
                <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                Failure Propagation Chain
              </h4>
              <p className="text-[12px] text-app-secondary leading-relaxed">
                The failure propagated through the service dependency chain as follows:
              </p>
              <ol className="text-[12px] text-app-secondary mt-2 space-y-2 list-decimal list-inside">
                <li>
                  <span className="font-mono text-app">ts-order-service</span> CPU saturation caused request processing delays
                </li>
                <li>
                  Downstream calls to <span className="font-mono text-app">ts-config-service</span> timed out,
                  exhausting its connection pool
                </li>
                <li>
                  <span className="font-mono text-app">ts-travel-service</span> experienced cascading timeouts
                  due to blocked upstream dependencies
                </li>
                <li>
                  <span className="font-mono text-app">ts-gateway</span> circuit breaker activated after
                  detecting repeated failures
                </li>
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
                    <li>• CPU: 98.7% peak</li>
                    <li>• Latency: +340%</li>
                    <li>• Error rate: 12.5%</li>
                  </ul>
                </div>
                <div className="rounded-md border border-app bg-app-surface p-3">
                  <div className="text-[10px] text-app-muted mb-1">Traces</div>
                  <ul className="text-[12px] text-app-secondary space-y-1">
                    <li>• Anomaly score: 0.89</li>
                    <li>• Timeout count: 47</li>
                    <li>• Retry storm detected</li>
                  </ul>
                </div>
                <div className="rounded-md border border-app bg-app-surface p-3">
                  <div className="text-[10px] text-app-muted mb-1">Logs</div>
                  <ul className="text-[12px] text-app-secondary space-y-1">
                    <li>• 127 errors in 30s</li>
                    <li>• GC pause: 1.2s</li>
                    <li>• Pool exhaustion</li>
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
              <span className="text-[12px] font-medium text-app">42%</span>
            </div>
            <div className="h-1.5 rounded-full bg-app-tertiary overflow-hidden">
              <div className="h-full w-[42%] bg-blue-500 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-app-secondary">INGD (Traces)</span>
              <span className="text-[12px] font-medium text-app">35%</span>
            </div>
            <div className="h-1.5 rounded-full bg-app-tertiary overflow-hidden">
              <div className="h-full w-[35%] bg-emerald-500 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-app-secondary">CCRE (Logs + LLM)</span>
              <span className="text-[12px] font-medium text-app">23%</span>
            </div>
            <div className="h-1.5 rounded-full bg-app-tertiary overflow-hidden">
              <div className="h-full w-[23%] bg-violet-500 rounded-full" />
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
            <li className="flex items-start space-x-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span className="text-app-secondary">
                Implement CPU-based autoscaling for <span className="font-mono text-app">ts-order-service</span> with
                threshold at 70%
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span className="text-app-secondary">
                Add request rate limiting to prevent traffic spikes from overwhelming the service
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
              <span className="text-app-secondary">
                Review GC settings - consider switching to G1GC with lower pause targets
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
              <span className="text-app-secondary">
                Increase connection pool size for downstream services to handle burst traffic
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
