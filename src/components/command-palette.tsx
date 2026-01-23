import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Search,
  LayoutDashboard,
  AlertTriangle,
  Network,
  BarChart3,
  Settings,
  FileText,
  ArrowRight,
} from "lucide-react"

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const pages = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, path: "/dashboard" },
  { id: "cases", label: "Cases", icon: AlertTriangle, path: "/cases" },
  { id: "analysis", label: "Analysis", icon: Network, path: "/analysis" },
  { id: "comparison", label: "Benchmarks", icon: BarChart3, path: "/comparison" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
]

const recentCases = [
  { id: "RE2-047", service: "ts-order-service", faultType: "CPU Stress" },
  { id: "RE2-048", service: "ts-travel-service", faultType: "Memory Leak" },
  { id: "RE2-051", service: "ts-station-service", faultType: "CPU Stress" },
]

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()

  const filteredPages = pages.filter((page) =>
    page.label.toLowerCase().includes(query.toLowerCase())
  )

  const filteredCases = recentCases.filter(
    (c) =>
      c.id.toLowerCase().includes(query.toLowerCase()) ||
      c.service.toLowerCase().includes(query.toLowerCase()) ||
      c.faultType.toLowerCase().includes(query.toLowerCase())
  )

  const allResults = [
    ...filteredPages.map((p) => ({ type: "page" as const, ...p })),
    ...filteredCases.map((c) => ({ type: "case" as const, ...c })),
  ]

  const handleSelect = useCallback(
    (index: number) => {
      const item = allResults[index]
      if (!item) return

      if (item.type === "page") {
        navigate(item.path)
      } else {
        navigate(`/analysis/${item.id}`)
      }
      onClose()
      setQuery("")
    },
    [allResults, navigate, onClose]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          handleSelect(selectedIndex)
          break
        case "Escape":
          onClose()
          setQuery("")
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, allResults.length, handleSelect, onClose])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={() => {
          onClose()
          setQuery("")
        }}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-app bg-app-secondary shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-app px-4 py-3">
          <Search className="h-4 w-4 text-app-muted" />
          <input
            type="text"
            placeholder="Search pages, cases, or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-app placeholder:text-app-muted outline-none"
            autoFocus
          />
          <kbd className="rounded bg-app-tertiary px-1.5 py-0.5 text-[10px] text-app-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-auto p-2">
          {filteredPages.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-app-muted">
                Pages
              </div>
              {filteredPages.map((page, i) => (
                <button
                  key={page.id}
                  onClick={() => handleSelect(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    selectedIndex === i
                      ? "bg-app-tertiary text-app"
                      : "text-app-secondary hover:bg-app-surface-hover"
                  )}
                >
                  <page.icon className="h-4 w-4" />
                  <span className="flex-1 text-[13px]">{page.label}</span>
                  <ArrowRight className="h-3 w-3 opacity-40" />
                </button>
              ))}
            </div>
          )}

          {filteredCases.length > 0 && (
            <div>
              <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-app-muted">
                Recent Cases
              </div>
              {filteredCases.map((c, i) => {
                const index = filteredPages.length + i
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      selectedIndex === index
                        ? "bg-app-tertiary text-app"
                        : "text-app-secondary hover:bg-app-surface-hover"
                    )}
                  >
                    <FileText className="h-4 w-4" />
                    <div className="flex-1">
                      <span className="text-[13px]">{c.id}</span>
                      <span className="ml-2 text-[11px] text-app-muted">
                        {c.service}
                      </span>
                    </div>
                    <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] text-orange-400">
                      {c.faultType}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {allResults.length === 0 && (
            <div className="py-8 text-center text-[13px] text-app-muted">
              No results found for "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-app px-4 py-2 text-[10px] text-app-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-app-tertiary px-1 py-0.5">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-app-tertiary px-1 py-0.5">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-app-tertiary px-1 py-0.5">ESC</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}
