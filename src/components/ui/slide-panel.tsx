import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: "sm" | "md" | "lg" | "xl"
}

const widthClasses = {
  sm: "w-80",
  md: "w-96",
  lg: "w-[480px]",
  xl: "w-[640px]",
}

export function SlidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = "md",
}: SlidePanelProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full border-l border-app bg-app-secondary shadow-2xl transition-transform duration-300 ease-out",
          widthClasses[width],
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-app px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-app">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-app-muted">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-tertiary hover:text-app"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-60px)] overflow-auto">
          {children}
        </div>
      </div>
    </>
  )
}
