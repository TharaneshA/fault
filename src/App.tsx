import { useState, useEffect, useCallback } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Topbar } from "@/components/layout/topbar"
import { Sidebar } from "@/components/layout/sidebar"
import { CommandPalette } from "@/components/command-palette"
import { AboutDialog } from "@/components/about-dialog"
import { SplashScreen } from "@/components/splash-screen"
import { TailwindIndicator } from "./components/tailwind-indicator"
import { ThemeProvider } from "./components/theme-provider"
import DashboardPage from "./dashboard/page"
import CasesPage from "./pages/cases/page"
import AnalysisPage from "./pages/analysis/page"
import ComparisonPage from "./pages/comparison/page"
import SettingsPage from "./pages/settings/page"
import { cn } from "./lib/utils"

function AppContent() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const location = useLocation()

  // Close dialogs on route change
  useEffect(() => {
    setIsCommandPaletteOpen(false)
  }, [location.pathname])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K for command palette
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app">
      {/* Top bar */}
      <Topbar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content with page transition */}
        <main
          key={location.pathname}
          className={cn(
            "flex-1 overflow-auto",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10",
            "animate-in fade-in-0 duration-200"
          )}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/analysis/:caseId" element={<AnalysisPage />} />
            <Route path="/comparison" element={<ComparisonPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* About Dialog */}
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  )
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [contentVisible, setContentVisible] = useState(false)

  const handleSplashComplete = useCallback(() => {
    // First make content visible with fade
    setContentVisible(true)
    // Then remove splash overlay after content starts appearing
    setTimeout(() => setShowSplash(false), 100)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {/* Solid background layer */}
      <div className="fixed inset-0 bg-[#09090b] -z-10" />

      {/* App content - starts invisible, fades in after splash */}
      <div
        className={cn(
          "transition-opacity duration-300",
          contentVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <AppContent />
      </div>

      {/* Splash screen overlay with solid background to fully cover content */}
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-[#09090b]">
          <SplashScreen onComplete={handleSplashComplete} duration={2500} />
        </div>
      )}

      <TailwindIndicator />
    </ThemeProvider>
  )
}

export default App
