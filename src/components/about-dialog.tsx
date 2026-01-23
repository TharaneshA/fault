import { useEffect, useState } from "react"
import { getVersion, getTauriVersion } from "@tauri-apps/plugin-app"
import { arch, platform } from "@tauri-apps/plugin-os"
import { X, ExternalLink } from "lucide-react"
import { FaultLogo } from "@/components/ui/fault-logo"

interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const [version, setVersion] = useState("")
  const [tauriVersion, setTauriVersion] = useState("")
  const [systemInfo, setSystemInfo] = useState("")

  useEffect(() => {
    if (isOpen) {
      getVersion().then(setVersion).catch(() => setVersion("0.1.0"))
      getTauriVersion().then(setTauriVersion).catch(() => setTauriVersion("2.x"))
      try {
        const archInfo = arch()
        const platformInfo = platform()
        setSystemInfo(`${platformInfo} (${archInfo})`)
      } catch {
        setSystemInfo("Windows")
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-app bg-app-secondary shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-tertiary hover:text-app"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center px-6 py-8">
          {/* Logo */}
          <div className="mb-4">
            <FaultLogo size={64} />
          </div>

          {/* Title */}
          <h2 className="font-display text-xl font-black tracking-normal text-app">Fault.ai</h2>
          <p className="mt-1 text-[12px] text-app-muted">
            Version {version} · {systemInfo}
          </p>

          {/* Description */}
          <p className="mt-4 text-center text-[13px] text-app-secondary">
            Multi-Modal Root Cause Analysis for Microservices
          </p>

          {/* Info grid */}
          <div className="mt-6 w-full space-y-2 rounded-lg bg-app-tertiary p-4">
            <div className="flex justify-between text-[12px]">
              <span className="text-app-muted">Tauri Version</span>
              <span className="font-mono text-app-secondary">{tauriVersion}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-app-muted">Components</span>
              <span className="font-mono text-app-secondary">CMEA + INGD + CCRE</span>
            </div>
          </div>

          {/* Links */}
          <div className="mt-6 flex items-center gap-4">
            <a
              href="#"
              className="flex items-center gap-1.5 text-[11px] text-app-muted transition-colors hover:text-app-secondary"
            >
              <ExternalLink className="h-3 w-3" />
              Documentation
            </a>
            <a
              href="#"
              className="flex items-center gap-1.5 text-[11px] text-app-muted transition-colors hover:text-app-secondary"
            >
              <ExternalLink className="h-3 w-3" />
              GitHub
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-app px-6 py-3 text-center text-[10px] text-app-muted">
          © 2024 Fault.ai · Built with Tauri + React
        </div>
      </div>
    </div>
  )
}
