"use client"

import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Search, HelpCircle, Info, Sun, Moon } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip-simple"
import { BackendStatusIndicator } from "./backend-status"

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/cases": "Cases",
  "/analysis": "Analysis",
  "/comparison": "Benchmarks",
  "/settings": "Settings",
}

interface TopbarProps {
  onOpenCommandPalette: () => void
  onOpenAbout: () => void
}

export function Topbar({ onOpenCommandPalette, onOpenAbout }: TopbarProps) {
  const location = useLocation()
  const [isMaximized, setIsMaximized] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const currentPage =
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] || "Fault.ai"

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const window = getCurrentWindow()
        setIsMaximized(await window.isMaximized())
      } catch (e) {
        console.error("Failed to check maximized state:", e)
      }
    }
    checkMaximized()

    // Listen for window resize events to update maximized state
    const handleResize = () => {
      checkMaximized()
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow()
      await window.minimize()
    } catch (e) {
      console.error("Failed to minimize:", e)
    }
  }

  const handleMaximize = async () => {
    try {
      const window = getCurrentWindow()
      const maximized = await window.isMaximized()
      if (maximized) {
        await window.unmaximize()
        setIsMaximized(false)
      } else {
        await window.maximize()
        setIsMaximized(true)
      }
    } catch (e) {
      console.error("Failed to maximize:", e)
    }
  }

  const handleClose = async () => {
    try {
      const window = getCurrentWindow()
      await window.close()
    } catch (e) {
      console.error("Failed to close:", e)
    }
  }

  const handleStartDrag = async (e: React.MouseEvent) => {
    // Only start drag if clicking on the drag region itself, not on buttons
    if ((e.target as HTMLElement).closest("button")) return
    try {
      const window = getCurrentWindow()
      await window.startDragging()
    } catch (e) {
      console.error("Failed to start dragging:", e)
    }
  }

  return (
    <div
      className="flex h-9 items-center border-b border-app bg-app"
      onMouseDown={handleStartDrag}
    >
      {/* Left: Page title */}
      <div className="flex w-52 items-center px-4">
        <span className="text-[12px] font-medium text-app-secondary">
          {currentPage}
        </span>
      </div>

      {/* Center: Search (absolutely centered) */}
      <div className="flex flex-1 justify-center">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-md border border-app-light bg-app-surface px-3 py-1 transition-all hover:border-app hover:bg-app-tertiary"
        >
          <Search className="h-3 w-3 text-app-muted" />
          <span className="text-[11px] text-app-muted">Search or jump to...</span>
          <kbd className="ml-6 rounded bg-app-tertiary px-1.5 py-0.5 text-[10px] text-app-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Actions + Window controls */}
      <div className="flex items-center gap-0.5 pr-1">
        {/* Backend Status Indicator */}
        <BackendStatusIndicator />

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-app-tertiary" />

        <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"}>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-7 w-7 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-tertiary hover:text-app-secondary"
          >
            {mounted && (
              theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )
            )}
          </button>
        </Tooltip>

        <Tooltip content="About Fault.ai">
          <button
            onClick={onOpenAbout}
            className="flex h-7 w-7 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-tertiary hover:text-app-secondary"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip>

        <Tooltip content="Help">
          <button className="flex h-7 w-7 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-tertiary hover:text-app-secondary">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </Tooltip>

        {/* Separator */}
        <div className="mx-1 h-4 w-px bg-app-tertiary" />

        {/* Windows-style window controls */}
        <button
          onClick={handleMinimize}
          className="flex h-9 w-11 items-center justify-center text-app-secondary transition-colors hover:bg-app-tertiary"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-9 w-11 items-center justify-center text-app-secondary transition-colors hover:bg-app-tertiary"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M2 0h6v6H2z M0 2v6h6" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="flex h-9 w-11 items-center justify-center text-app-secondary transition-colors hover:bg-[#c42b1c] hover:text-white"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M0 0L10 10M10 0L0 10" />
          </svg>
        </button>
      </div>
    </div>
  )
}
